import { GcpLogger } from 'src';

describe('Gcp log test', () => {
  it('should log', () => {
    GcpLogger.init({ serviceName: 'Test' });
    GcpLogger.log('test');
  });
});
