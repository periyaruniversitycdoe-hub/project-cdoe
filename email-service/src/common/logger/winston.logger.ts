import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// ── Pretty format for console (development) ──────────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, context, stack, ...meta }) => {
    const ctx  = context ? `[${context}]` : '';
    const body = stack   ? `${message}\n${stack}` : message;
    const extra = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} ${level} ${ctx} ${body} ${extra}`.trim();
  }),
);

// ── JSON format for file / production ────────────────────────
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

const isProduction = process.env.NODE_ENV === 'production';

export function createWinstonOptions(): WinstonModuleOptions {
  return {
    transports: [
      // ── Console ──────────────────────────────────────────
      new winston.transports.Console({
        format: isProduction ? prodFormat : devFormat,
        silent: process.env.NODE_ENV === 'test',
      }),

      // ── Rotating file — all levels ───────────────────────
      new (winston.transports as any).DailyRotateFile({
        filename:     'logs/app-%DATE%.log',
        datePattern:  'YYYY-MM-DD',
        zippedArchive: true,
        maxSize:      '20m',
        maxFiles:     '30d',
        format:       prodFormat,
      }),

      // ── Rotating file — errors only ──────────────────────
      new (winston.transports as any).DailyRotateFile({
        level:        'error',
        filename:     'logs/error-%DATE%.log',
        datePattern:  'YYYY-MM-DD',
        zippedArchive: true,
        maxSize:      '20m',
        maxFiles:     '90d',
        format:       prodFormat,
      }),
    ],
  };
}
