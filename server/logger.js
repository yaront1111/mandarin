// server/logger.js
import { createLogger, format, transports } from 'winston'
import 'winston-daily-rotate-file'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import config from './config.js'  // assume you can add LOG_DIR, LOG_MAX_FILES, etc.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logsDir = path.join(__dirname, config.LOG_DIR || 'logs')

// ensure log directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// common formats
const baseFormat = format.combine(
  format.errors({ stack: true }),           // include stack trace if present
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.label({ label: config.SERVICE_NAME || 'mandarin-api' })
)

const consoleFormat = format.combine(
  baseFormat,
  format.colorize(),
  format.printf(({ timestamp, level, message, label, stack, ...meta }) => {
    const msg = stack || message
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
    return `${timestamp} [${label}] ${level}: ${msg}${metaStr}`
  })
)

const fileFormat = format.combine(
  baseFormat,
  format.json()
)

// daily rotating file transport (all levels)
const rotateOpts = {
  datePattern: 'YYYY-MM-DD',
  dirname: logsDir,
  filename: `%DATE%-server.log`,
  zippedArchive: true,                 // compress rotated files
  maxSize: config.LOG_MAX_SIZE || '20m',
  maxFiles: config.LOG_MAX_FILES || '14d',
  format: fileFormat
}

const fileRotateTransport = new transports.DailyRotateFile(rotateOpts)
const errorRotateTransport = new transports.DailyRotateFile({
  ...rotateOpts,
  level: 'error',
  filename: `%DATE%-error.log`,
})

// create Winston logger
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    new transports.Console({ format: consoleFormat }),
    fileRotateTransport,
    errorRotateTransport
  ],
  exceptionHandlers: [
    new transports.Console({ format: consoleFormat }),
    new transports.DailyRotateFile({ ...rotateOpts, filename: `%DATE%-exceptions.log` })
  ],
  rejectionHandlers: [
    new transports.Console({ format: consoleFormat }),
    new transports.DailyRotateFile({ ...rotateOpts, filename: `%DATE%-rejections.log` })
  ],
  exitOnError: false,
})

// request‐logging middleware
export const requestLogger = (req, res, next) => {
  if (req.url.startsWith('/uploads/')) return next()

  const start = Date.now()
  const child = logger.child({ requestId: req.headers['x-request-id'] || null })

  res.on('finish', () => {
    const duration = Date.now() - start
    const meta = { ip: req.ip, method: req.method, url: req.originalUrl, duration }
    if (req.user?.id) meta.userId = req.user._id

    if (res.statusCode >= 500) child.error(`HTTP ${res.statusCode}`, meta)
    else if (res.statusCode >= 400) child.warn(`HTTP ${res.statusCode}`, meta)
    else child.info(`HTTP ${res.statusCode}`, meta)
  })

  next()
}

// graceful shutdown for transports
export const gracefulShutdown = () => {
  logger.info('Shutting down logger...')
  return Promise.all(
    logger.transports.map(t =>
      typeof t.close === 'function' ? new Promise(r => t.close(r)) : Promise.resolve()
    )
  )
}

export default logger
