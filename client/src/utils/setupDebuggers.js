/**
 * Utility to conditionally import and set up debugging tools
 * This file is automatically imported by main.jsx and will
 * only load the debugging tools in development mode
 */

import logger from './logger';

const log = logger.create('SetupDebuggers');

/**
 * Initializes debuggers only in development mode
 */
export function setupDebuggers() {
  // Check if we're in development mode
  if (process.env.NODE_ENV !== 'production') {
    log.info('Setting up development debugging tools...');
    
    // Dynamically import the API debugger only in development
    import('./apiDebugger').then(module => {
      // Module is loaded, apiDebugger is already initialized via its singleton pattern
      log.info('API debugger initialized for development mode');
    }).catch(err => {
      log.error('Failed to load API debugger', err);
    });
    
    // You can add more development-only tools here in the future
  } else {
    // In production, we don't load any debuggers
    log.info('Running in production mode, debuggers disabled');
  }
}

export default setupDebuggers;