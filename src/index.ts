import { LoggingWinston } from '@google-cloud/logging-winston';
import { Request } from 'express';
import winston from 'winston';

let loggingWinston: LoggingWinston;
let logger: winston.Logger;

// Consente di estrarre l'utente richiedente dalla request e scriverlo nei log
let _extractUserFromRequest: (req: Request) => any | undefined;

// Inizializzazione del logger
const _initLogger = () => {
  // serviceContext se è valorizzato riporta gli errori anche su Error Reporting
  const serviceContext = process.env.SERVICE_NAME ? { service: process.env.SERVICE_NAME } : undefined;

  loggingWinston = new LoggingWinston({
    serviceContext,
  });

  // Transports - se in debug scriviamo anche nella console
  const transports: winston.transport[] = [];
  if (process.env.NODE_ENV === 'development') {
    transports.push(new winston.transports.Console());
  }
  transports.push(loggingWinston);

  logger = winston.createLogger({
    level: 'info',
    transports,
  });
};

// Metodo principale
// Formatta e scrive i log
const _handleLog = (log: Object | string | Error, severity: 'ERROR' | 'WARNING' | 'INFO', req?: Request, reqUser?: any) => {
  if (!logger) {
    _initLogger();
  }

  let message = '';
  let metadata: any = {};

  if (log instanceof Error || log instanceof Object) {
    metadata = log;
  }

  if (req) {
    message += `${req.method} ${req.protocol}://${req.hostname}${req.originalUrl} - `;

    // Http request info
    metadata.httpRequest = {
      status: severity === 'ERROR' ? 500 : severity === 'WARNING' ? 400 : 200,
      requestUrl: `${req.protocol}://${req.hostname}${req.originalUrl}`,
      requestMethod: req.method,
      remoteIp: req.socket.remoteAddress,
      requestSize: req.socket.bytesRead,
      userAgent: req.headers && req.headers['user-agent'],
    };

    // Tracing
    if (req.headers && req.headers['X-Cloud-Trace-Context']) {
      const [trace] = `${req.headers['X-Cloud-Trace-Context']}`.split('/');
      metadata.httpRequest[LoggingWinston.LOGGING_TRACE_KEY] = `projects/${process.env.PROJECT_ID}/traces/${trace}`;
    }
  }

  if (reqUser) {
    metadata.reqUser = reqUser;
  } else if (_extractUserFromRequest) {
    metadata.reqUser = _extractUserFromRequest(req);
  }

  if (typeof log === 'string') {
    message += log;
  } else if (log instanceof Error) {
    message += log.message;
  } else {
    message += JSON.stringify(log, Object.getOwnPropertyNames(log));
  }

  switch (severity) {
    case 'ERROR':
      logger.error(message, metadata);
      break;
    case 'WARNING':
      logger.warn(message, metadata);
      break;
    default:
      logger.info(message, metadata);
      break;
  }
};

// exported - per chiamare il logger coome se fosse static
export const GcpLogger = {
  log(log: Object | string, req?: Request, reqUser?: any): void {
    _handleLog(log, 'INFO', req, reqUser);
  },
  warn(log: Object | string | Error, req?: Request, reqUser?: any): void {
    _handleLog(log, 'WARNING', req, reqUser);
  },
  error(log: Error | Object, req?: Request, reqUser?: any): void {
    _handleLog(log, 'ERROR', req, reqUser);
  },
  init(config: { extractUserFromRequest: (req: Request) => any }): void {
    if (config.extractUserFromRequest) {
      _extractUserFromRequest = config.extractUserFromRequest;
    }
  },
};
