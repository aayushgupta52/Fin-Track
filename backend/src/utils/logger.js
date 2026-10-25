import winston from 'winston';
import { isProd } from '../config/env.js';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack }) => {
    return `${ts} ${level}: ${stack || message}`;
  })
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: isProd ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
});
