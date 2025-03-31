# Client Code Refactoring Plan

## 1. Create Reusable Custom Hooks

### API Call Wrapper Hook

```jsx
// hooks/useApi.js
import { useState, useCallback } from 'react';
import apiService from '../services/apiService';

/**
 * Hook for making standardized API calls
 * @param {Object} options - Configuration options
 * @returns {Object} - API call methods and state
 */
export const useApi = (options = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  /**
   * Execute API call with standard error handling
   * @param {Function} apiCall - Function that returns Promise from apiService
   * @param {Function} onSuccess - Success callback
   * @param {Function} onError - Error callback
   */
  const execute = useCallback(async (apiCall, onSuccess, onError) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiCall();
      
      if (!response.success) {
        throw new Error(response.error || 'API request failed');
      }
      
      if (onSuccess) {
        onSuccess(response.data);
      }
      
      return response.data;
    } catch (err) {
      const errorMsg = err.error || err.message || 'An error occurred';
      setError(errorMsg);
      
      if (onError) {
        onError(errorMsg);
      }
      
      if (options.logErrors) {
        console.error(`API error: ${errorMsg}`);
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [options.logErrors]);
  
  /**
   * GET request with standard handling
   */
  const get = useCallback((endpoint, params, callbacks) => {
    return execute(
      () => apiService.get(endpoint, params),
      callbacks?.onSuccess,
      callbacks?.onError
    );
  }, [execute]);
  
  /**
   * POST request with standard handling
   */
  const post = useCallback((endpoint, data, callbacks) => {
    return execute(
      () => apiService.post(endpoint, data),
      callbacks?.onSuccess,
      callbacks?.onError
    );
  }, [execute]);
  
  // Add other methods (put, delete, upload)
  
  return {
    loading,
    error,
    get,
    post,
    // Other methods
  };
};
```

### Socket Connection Hook

```jsx
// hooks/useSocketConnection.js
import { useState, useEffect, useCallback } from 'react';
import socketService from '../services/socketService';

/**
 * Hook to manage socket connection and event handling
 * @param {Object} options - Configuration options
 * @returns {Object} - Socket connection state and helpers
 */
export const useSocketConnection = (options = {}) => {
  const [connected, setConnected] = useState(socketService.isConnected());
  const [connectionError, setConnectionError] = useState(null);
  
  // Initialize socket connection
  useEffect(() => {
    const initSocket = async () => {
      if (!options.userId || !options.token) {
        return;
      }
      
      try {
        if (!socketService.isConnected()) {
          await socketService.init(options.userId, options.token);
          setConnected(true);
          setConnectionError(null);
        }
      } catch (err) {
        setConnectionError(err.message || 'Failed to connect');
        setConnected(false);
      }
    };
    
    initSocket();
    
    // Listen for connection state changes
    const handleConnect = () => {
      setConnected(true);
      setConnectionError(null);
    };
    
    const handleDisconnect = () => {
      setConnected(false);
    };
    
    const handleError = (err) => {
      setConnectionError(err?.message || 'Connection error');
    };
    
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('error', handleError);
    
    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('error', handleError);
    };
  }, [options.userId, options.token]);
  
  /**
   * Register event listener with auto-cleanup
   */
  const useSocketEvent = useCallback((event, callback) => {
    useEffect(() => {
      const removeListener = socketService.on(event, callback);
      return () => removeListener();
    }, [event, callback]);
  }, []);
  
  /**
   * Emit event with error handling
   */
  const emit = useCallback((event, data, ackCallback) => {
    if (!socketService.isConnected()) {
      if (options.autoReconnect) {
        socketService.reconnect();
      }
      return false;
    }
    
    return socketService.emit(event, data, ackCallback);
  }, [options.autoReconnect]);
  
  return {
    connected,
    connectionError,
    useSocketEvent,
    emit,
    reconnect: socketService.reconnect,
    getStatus: socketService.getStatus
  };
};
```

### Settings Management Hook

```jsx
// hooks/useSettings.js
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../context';
import settingsService from '../services/settingsService';

/**
 * Hook for managing user settings
 * @returns {Object} - Settings state and methods
 */
export const useSettings = () => {
  const { currentUser, updateProfile } = useUser();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Load settings from server
  useEffect(() => {
    if (!currentUser) return;
    
    const loadSettings = async () => {
      setLoading(true);
      try {
        const response = await settingsService.getUserSettings();
        if (response.success) {
          setSettings(response.data);
        } else {
          throw new Error(response.error || 'Failed to load settings');
        }
      } catch (err) {
        setError(err.message);
        // Fall back to user object settings
        if (currentUser.settings) {
          setSettings(currentUser.settings);
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, [currentUser]);
  
  /**
   * Update a specific setting
   * @param {string} section - Settings section (notifications, privacy, etc)
   * @param {string} name - Setting name
   * @param {any} value - New value
   */
  const updateSetting = useCallback((section, name, value) => {
    setSettings(prev => {
      if (!prev) return null;
      
      const newSettings = {
        ...prev,
        [section]: {
          ...prev[section],
          [name]: value
        }
      };
      
      setHasChanges(true);
      return newSettings;
    });
  }, []);
  
  /**
   * Save all settings to server
   */
  const saveSettings = useCallback(async () => {
    if (!settings) return { success: false };
    
    setLoading(true);
    try {
      // Normalize settings to ensure correct boolean values
      const normalizedSettings = {
        notifications: Object.entries(settings.notifications || {}).reduce((acc, [key, value]) => {
          acc[key] = value === false ? false : !!value;
          return acc;
        }, {}),
        privacy: { ...settings.privacy },
        theme: { ...settings.theme }
      };
      
      const response = await settingsService.updateSettings(normalizedSettings);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to save settings');
      }
      
      // Update user profile
      if (currentUser) {
        await updateProfile({ settings: normalizedSettings });
      }
      
      setHasChanges(false);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [settings, currentUser, updateProfile]);
  
  return {
    settings,
    loading,
    error,
    hasChanges,
    updateSetting,
    saveSettings
  };
};
```

## 2. Refactor Component Structure

### Before:

```jsx
const SomeComponent = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await apiService.get('/some-endpoint');
        if (response.success) {
          setData(response.data);
        } else {
          setError(response.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchData();
    }
  }, [user]);
  
  // Component implementation...
};
```

### After:

```jsx
const SomeComponent = () => {
  const { get, loading, error } = useApi();
  const { user } = useAuth();
  const [data, setData] = useState([]);
  
  useEffect(() => {
    if (!user) return;
    
    get('/some-endpoint', {}, {
      onSuccess: (responseData) => setData(responseData)
    });
  }, [user, get]);
  
  // Component implementation...
};
```

## 3. Create Component Composability Pattern

```jsx
// components/common/withErrorBoundary.jsx
import { ErrorBoundary } from '../ErrorBoundary';

/**
 * HOC that wraps component with error boundary
 * @param {React.Component} Component - Component to wrap
 * @param {Object} options - Error handling options
 * @returns {React.Component} - Wrapped component
 */
export const withErrorBoundary = (Component, options = {}) => {
  const { fallback, onError } = options;
  
  return (props) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );
};

// components/common/withSuspense.jsx
import { Suspense } from 'react';
import LoadingState from './LoadingState';

/**
 * HOC that wraps component with suspense
 * @param {React.Component} Component - Component to wrap
 * @param {React.Component} Fallback - Loading fallback
 * @returns {React.Component} - Wrapped component
 */
export const withSuspense = (Component, Fallback = LoadingState) => {
  return (props) => (
    <Suspense fallback={<Fallback />}>
      <Component {...props} />
    </Suspense>
  );
};

// Example usage
const EnhancedComponent = withErrorBoundary(
  withSuspense(MyComponent),
  { fallback: <ErrorDisplay /> }
);
```

## 4. Create Shared Context Utilities

```jsx
// context/utils.js

/**
 * Create a context with error handling for missing Provider
 * @param {string} name - Context name for error messages
 * @returns {React.Context} - Context object
 */
export const createNamedContext = (name) => {
  const Context = React.createContext(undefined);
  
  Context.displayName = name;
  
  const useContextSafely = () => {
    const context = React.useContext(Context);
    if (context === undefined) {
      throw new Error(`use${name} must be used within a ${name}Provider`);
    }
    return context;
  };
  
  return [Context, useContextSafely];
};

/**
 * Create a standard state initialization effect
 * @param {Function} initialize - Init function
 * @param {Array} deps - Effect dependencies
 * @returns {Function} - Effect setup function
 */
export const createInitEffect = (initialize, deps = []) => {
  return (setState, setLoading, setError) => {
    React.useEffect(() => {
      let isMounted = true;
      
      const init = async () => {
        setLoading(true);
        try {
          const data = await initialize();
          if (isMounted) {
            setState(data);
          }
        } catch (err) {
          if (isMounted) {
            setError(err.message);
            console.error(`Initialization error:`, err);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };
      
      init();
      
      return () => {
        isMounted = false;
      };
    }, deps);
  };
};
```

## 5. Service Cleanup

### Socket Service Refactoring

Create a consistent pattern for services to follow:

```jsx
// Template for service classes
class BaseService {
  constructor() {
    this.initialized = false;
    this.listeners = new Map();
  }
  
  /**
   * Initialize service
   * @param {Object} options - Init options
   * @returns {Promise} - Initialization result
   */
  async initialize(options = {}) {
    if (this.initialized) {
      console.log(`${this.constructor.name} already initialized`);
      return this;
    }
    
    // Service-specific initialization logic
    this.initialized = true;
    return this;
  }
  
  /**
   * Register event listener with cleanup function
   * @param {string} event - Event name
   * @param {Function} callback - Listener callback
   * @returns {Function} - Cleanup function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event).add(callback);
    
    return () => {
      if (this.listeners.has(event)) {
        this.listeners.get(event).delete(callback);
      }
    };
  }
  
  /**
   * Emit event to listeners
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  emit(event, data) {
    if (!this.listeners.has(event)) return;
    
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    this.listeners.clear();
    this.initialized = false;
  }
}
```

## 6. Remove Console.log Statements

Create a logging utility:

```jsx
// utils/logger.js

/**
 * Logging levels
 * @type {Object}
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

/**
 * Logger configuration
 * @type {Object}
 */
const config = {
  level: process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG,
  enabled: true
};

/**
 * Log message if level is enabled
 * @param {string} level - Log level
 * @param {string} message - Message to log
 * @param {any} data - Additional data
 */
const log = (level, message, ...data) => {
  const levels = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3
  };
  
  if (!config.enabled || levels[level] < levels[config.level]) {
    return;
  }
  
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(`[DEBUG] ${message}`, ...data);
      break;
    case LogLevel.INFO:
      console.info(`[INFO] ${message}`, ...data);
      break;
    case LogLevel.WARN:
      console.warn(`[WARN] ${message}`, ...data);
      break;
    case LogLevel.ERROR:
      console.error(`[ERROR] ${message}`, ...data);
      break;
    default:
      console.log(message, ...data);
  }
};

export const logger = {
  debug: (message, ...data) => log(LogLevel.DEBUG, message, ...data),
  info: (message, ...data) => log(LogLevel.INFO, message, ...data),
  warn: (message, ...data) => log(LogLevel.WARN, message, ...data),
  error: (message, ...data) => log(LogLevel.ERROR, message, ...data),
  setLevel: (level) => { config.level = level; },
  enable: () => { config.enabled = true; },
  disable: () => { config.enabled = false; },
  isEnabled: () => config.enabled
};
```

## 7. Cleanup Plan

1. Replace direct API calls with the useApi hook
2. Refactor socket event handling using useSocketConnection
3. Standardize settings management with useSettings
4. Apply HOCs for error boundaries and suspense
5. Remove duplicate notification handling code
6. Create a consistent service initialization pattern
7. Replace all console.log statements with the logger utility
8. Remove unused imports and dead code
9. Apply consistent prop validation with PropTypes
10. Create reusable UI components for common patterns

This refactoring will significantly reduce code duplication, improve error handling, and make the codebase more maintainable while preserving all existing functionality.