import winston from 'winston';
import { LoggingWinston } from '@google-cloud/logging-winston';
import { Response } from 'express';

let loggingWinston: LoggingWinston;
let logger: winston.Logger;

const _initLogger = () => {

  // serviceContext se è valorizzato riporta gli errori anche su Error Reporting
  const serviceContext = process.env.SERVICE_NAME ? { service: process.env.SERVICE_NAME } : undefined;

  loggingWinston = new LoggingWinston({
    serviceContext
  });

  // Transports - se in debug scriviamo anche nella console
  const transports: winston.transport[] = [];
  if (process.env.NODE_ENV === 'development') { transports.push(new winston.transports.Console()); }
  transports.push(loggingWinston);

  logger = winston.createLogger({
    level: 'info',
    transports
  });
};

// Metodo principale
// Formatta e scrive i log
const _handleLog = (log: Object | string | Error, severity: 'ERROR' | 'WARNING' | 'INFO', res?: Response)  => {

  if (!logger) { _initLogger(); }

  let message = '';
  let metadata: any = {};

  if (log instanceof Error || log instanceof Object) { metadata = log; }
  
  if (res) {
    if (res.req) {
      message += `${res.req.method} ${res.req.protocol}://${res.req.get('host')}${res.req.originalUrl} - `;
      metadata.httpRequest = {
        status: severity === 'ERROR' ? 500 : severity === 'WARNING' ? 400 : 200,
        requestUrl: `${res.req.protocol}://${res.req.get('host')}${res.req.originalUrl}`,
        requestMethod: res.req.method,
        remoteIp: res.req.socket.remoteAddress,
        requestSize: res.req.socket.bytesRead
      };
      
      if (res.req.headers) {
        if (res.req.headers['user-agent']) { metadata.httpRequest.userAgent = res.req.headers['user-agent']; }
        if (res.req.headers['baw-user']) {
          const reqUser = Buffer.from(res.req.headers['baw-user'].toString(), 'base64').toString();
          metadata.bawUser = JSON.parse(reqUser);
        }
        if (res.req.header('X-Cloud-Trace-Context')) {
          const [trace] = res.req.header('X-Cloud-Trace-Context').split('/');
          metadata.httpRequest[LoggingWinston.LOGGING_TRACE_KEY] = `projects/${process.env.PROJECT_ID}/traces/${trace}`;
        }
      }
    }
  }

  if (typeof(log) === 'string') { message += log; }
  else if (log instanceof Error) { message += log.message; }
  else { message += JSON.stringify(log, Object.getOwnPropertyNames(log)); }

  switch (severity) {
    case 'ERROR': logger.error(message, metadata); break;
    case 'WARNING': logger.warn(message, metadata); break;
    default: logger.info(message, metadata); break;
  }
  
};

// exported - per chiamare il logger coome se fosse static
export const GcpLogger = {
  log(err: Object | string, res?: Response): void {
    _handleLog(err, 'INFO', res);
  },
  warn(err: Object | string | Error, res?: Response): void {
    _handleLog(err, 'WARNING', res);
  },
  error(err: Error, res?: Response): void {
    _handleLog(err, 'ERROR', res);
  }
};
