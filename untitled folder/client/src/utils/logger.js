/**
 * Logger utility for standardized and controllable logging
 */

/**
 * Logging levels
 * @enum {string}
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  NONE: 'none'
};

/**
 * Logger configuration
 * @type {Object}
 */
const config = {
  level: process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG,
  enabled: process.env.NODE_ENV !== 'production',
  includeTimestamp: true,
  groupByContext: true,
};

/**
 * Log level hierarchy for filtering
 * @type {Object}
 */
const logLevels = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.NONE]: 4
};

/**
 * Format a log message
 * @param {string} context - Logging context
 * @param {string} message - Message to log
 * @returns {string} Formatted message
 */
const formatMessage = (context, message) => {
  let formatted = '';
  
  if (context) {
    formatted += `[${context}] `;
  }
  
  if (config.includeTimestamp) {
    const now = new Date();
    const time = now.toLocaleTimeString();
    formatted += `${time} `;
  }
  
  formatted += message;
  return formatted;
};

/**
 * Log a message if level is enabled
 * @param {string} level - Log level
 * @param {string} context - Logging context
 * @param {string} message - Message to log
 * @param {any[]} args - Additional arguments
 */
const log = (level, context, message, ...args) => {
  // Skip logging if disabled or level is below threshold
  if (!config.enabled || logLevels[level] < logLevels[config.level]) {
    return;
  }
  
  const formattedMessage = formatMessage(context, message);
  
  // Use grouping for context if enabled
  const shouldGroup = config.groupByContext && 
                     context && 
                     args.length > 0 && 
                     typeof args[0] === 'object';
  
  if (shouldGroup) {
    console.groupCollapsed(formattedMessage);
    args.forEach(arg => {
      if (arg !== null && typeof arg === 'object') {
        console.dir(arg);
      } else {
        console.log(arg);
      }
    });
    console.groupEnd();
    return;
  }
  
  // Standard logging
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(formattedMessage, ...args);
      break;
    case LogLevel.INFO:
      console.info(formattedMessage, ...args);
      break;
    case LogLevel.WARN:
      console.warn(formattedMessage, ...args);
      break;
    case LogLevel.ERROR:
      console.error(formattedMessage, ...args);
      break;
    default:
      console.log(formattedMessage, ...args);
  }
};

/**
 * Create a logger instance for a specific context
 * @param {string} context - Logging context
 * @returns {Object} Logger object
 */
export const createLogger = (context) => ({
  debug: (message, ...args) => log(LogLevel.DEBUG, context, message, ...args),
  info: (message, ...args) => log(LogLevel.INFO, context, message, ...args),
  warn: (message, ...args) => log(LogLevel.WARN, context, message, ...args),
  error: (message, ...args) => log(LogLevel.ERROR, context, message, ...args),
  log: (message, ...args) => log(LogLevel.INFO, context, message, ...args)
});

/**
 * Default logger (without context)
 */
export const logger = {
  debug: (message, ...args) => log(LogLevel.DEBUG, '', message, ...args),
  info: (message, ...args) => log(LogLevel.INFO, '', message, ...args),
  warn: (message, ...args) => log(LogLevel.WARN, '', message, ...args),
  error: (message, ...args) => log(LogLevel.ERROR, '', message, ...args),
  log: (message, ...args) => log(LogLevel.INFO, '', message, ...args),
  
  // Create a context-specific logger
  create: (context) => createLogger(context),
  
  // Configuration methods
  setLevel: (level) => { 
    if (LogLevel[level]) {
      config.level = level;
    }
  },
  getLevel: () => config.level,
  enable: () => { config.enabled = true; },
  disable: () => { config.enabled = false; },
  isEnabled: () => config.enabled,
  
  // Configure timestamp inclusion
  includeTimestamp: (include = true) => { config.includeTimestamp = include; },
  
  // Configure context grouping
  groupByContext: (group = true) => { config.groupByContext = group; }
};

export default logger;