import { Logger } from '../types';

export function createLogger(requestId: string): Logger {
  const log = (level: string, message: string, meta?: Record<string, unknown>) => {
    process.stdout.write(
      JSON.stringify({ level, requestId, timestamp: new Date().toISOString(), message, ...meta }) + '\n'
    );
  };

  return {
    info: (message, meta) => log('INFO', message, meta),
    warn: (message, meta) => log('WARN', message, meta),
    error: (message, meta) => log('ERROR', message, meta),
  };
}
