// debug-middleware.js - Client-side debug middleware for API connectivity
import logger from './utils/logger';

// Create a dedicated logger for API debugging
const apiDebugLogger = logger.create('APIDebugMiddleware');

// Configuration
const API_DEBUG = true; // Set to false in production
const LOG_REQUESTS = true;
const LOG_RESPONSES = true;
const LOG_ERRORS = true;
const AUTO_RETRY_502 = true;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 500; // Base delay in milliseconds

// Tracking state
let requestCount = 0;
let errorCount = 0;
let lastError = null;
let apiLatencies = [];

// Legacy admin debug functions
export const logUserRoleToConsole = (user) => {
  if (process.env.NODE_ENV !== 'production') {
    console.group('Admin Route Debug Info');
    console.log('User ID:', user?._id);
    console.log('Username:', user?.username);
    console.log('Role:', user?.role);
    console.log('Has admin access:', user?.role === 'admin' || user?.roles?.includes('admin'));
    console.groupEnd();
  }
};

export const hasAdminPrivileges = (user) => {
  return user?.role === 'admin' || user?.roles?.includes('admin');
};

// Create middleware that will be applied to fetch
export const applyAPIDebugMiddleware = () => {
  if (!API_DEBUG) return; // Don't apply in production
  
  apiDebugLogger.info('Initializing API Debug Middleware');
  
  // Store original fetch
  const originalFetch = window.fetch;
  
  // Override fetch with our instrumented version
  window.fetch = async function(resource, options = {}) {
    const requestId = ++requestCount;
    const startTime = Date.now();
    const url = typeof resource === 'string' ? resource : resource.url;
    
    // Only log API requests
    if (!url.includes('/api/')) {
      return originalFetch(resource, options);
    }
    
    // Create retry state
    let retryCount = 0;
    let lastError = null;
    
    // Log the request
    if (LOG_REQUESTS) {
      apiDebugLogger.debug(
        `[${requestId}] 🚀 Request: ${options?.method || 'GET'} ${url}`
      );
    }
    
    // Retry logic for 502 errors
    while (retryCount <= MAX_RETRIES) {
      try {
        const response = await originalFetch(resource, options);
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        // Track latency
        apiLatencies.push(latency);
        if (apiLatencies.length > 100) apiLatencies.shift();
        
        // Check for 502 error
        if (response.status === 502 && AUTO_RETRY_502 && retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount - 1); // Exponential backoff
          
          apiDebugLogger.warn(
            `[${requestId}] ⚠️ 502 Bad Gateway detected. Retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`
          );
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Log the response
        if (LOG_RESPONSES) {
          const responseStatus = `${response.status} ${response.statusText}`;
          
          if (response.ok) {
            apiDebugLogger.debug(
              `[${requestId}] ✅ Response: ${responseStatus} (${latency}ms)`
            );
          } else {
            apiDebugLogger.warn(
              `[${requestId}] ❌ Response: ${responseStatus} (${latency}ms)`
            );
            
            // Increment error count for non-successful responses
            errorCount++;
            
            // Attempt to log response body for errors
            try {
              const clonedResponse = response.clone();
              const bodyText = await clonedResponse.text();
              apiDebugLogger.warn(`[${requestId}] Response body: ${bodyText}`);
            } catch (e) {
              apiDebugLogger.error(`[${requestId}] Could not read response body: ${e.message}`);
            }
          }
        }
        
        return response;
      } catch (error) {
        // Save last error
        lastError = error;
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        // Retry on network errors if retry is enabled
        if (AUTO_RETRY_502 && retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount - 1); // Exponential backoff
          
          apiDebugLogger.warn(
            `[${requestId}] 🔄 Network error: ${error.message}. Retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`
          );
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Log the error
        if (LOG_ERRORS) {
          errorCount++;
          apiDebugLogger.error(
            `[${requestId}] 💥 Fetch error: ${error.message} (${latency}ms)`
          );
          
          // Additional diagnostics for specific error types
          if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            apiDebugLogger.error(`[${requestId}] This could be a CORS or network connectivity issue`);
            runConnectionDiagnostics(url);
          }
        }
        
        throw error;
      }
    }
    
    // If all retries failed, throw the last error
    throw lastError;
  };
  
  // Override XMLHttpRequest for axios and other libraries
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._debugMethod = method;
    this._debugUrl = url;
    this._debugRequestId = ++requestCount;
    this._debugStartTime = Date.now();
    
    if (url.includes('/api/') && LOG_REQUESTS) {
      apiDebugLogger.debug(`[${this._debugRequestId}] 🚀 XHR Request: ${method} ${url}`);
    }
    
    return originalXHROpen.apply(this, [method, url, ...args]);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    if (this._debugUrl && this._debugUrl.includes('/api/')) {
      const requestId = this._debugRequestId;
      
      // Log request body if it exists
      if (body && LOG_REQUESTS) {
        let bodyPreview = body;
        if (typeof body === 'string' && body.length > 100) {
          bodyPreview = body.substring(0, 100) + '...';
        }
        apiDebugLogger.debug(`[${requestId}] XHR Request Body: ${bodyPreview}`);
      }
      
      // Add listeners for response
      this.addEventListener('load', function() {
        const endTime = Date.now();
        const latency = endTime - this._debugStartTime;
        
        // Track latency
        apiLatencies.push(latency);
        if (apiLatencies.length > 100) apiLatencies.shift();
        
        if (LOG_RESPONSES) {
          const status = this.status;
          
          if (status >= 200 && status < 300) {
            apiDebugLogger.debug(
              `[${requestId}] ✅ XHR Response: ${status} (${latency}ms)`
            );
          } else {
            apiDebugLogger.warn(
              `[${requestId}] ❌ XHR Response: ${status} (${latency}ms)`
            );
            
            // Increment error count for non-successful responses
            errorCount++;
            
            // Log response for errors
            if (status === 502) {
              apiDebugLogger.error(`[${requestId}] 502 Bad Gateway Error. This indicates a proxy/server communication issue.`);
              runConnectionDiagnostics(this._debugUrl);
            }
            
            try {
              apiDebugLogger.warn(`[${requestId}] XHR Response Text: ${this.responseText}`);
            } catch (e) {
              apiDebugLogger.error(`[${requestId}] Could not read XHR response: ${e.message}`);
            }
          }
        }
      });
      
      this.addEventListener('error', function() {
        const endTime = Date.now();
        const latency = endTime - this._debugStartTime;
        
        if (LOG_ERRORS) {
          errorCount++;
          apiDebugLogger.error(
            `[${requestId}] 💥 XHR Error (${latency}ms)`
          );
          runConnectionDiagnostics(this._debugUrl);
        }
      });
      
      this.addEventListener('timeout', function() {
        const endTime = Date.now();
        const latency = endTime - this._debugStartTime;
        
        if (LOG_ERRORS) {
          errorCount++;
          apiDebugLogger.error(
            `[${requestId}] ⏱️ XHR Timeout after ${this.timeout}ms (${latency}ms)`
          );
        }
      });
    }
    
    return originalXHRSend.apply(this, arguments);
  };
  
  apiDebugLogger.info('API Debug Middleware initialized successfully');
};

// Connection diagnostics function
async function runConnectionDiagnostics(url) {
  apiDebugLogger.info('Running connection diagnostics...');
  
  try {
    // Test basic connectivity to the server
    apiDebugLogger.info('Testing server connectivity...');
    
    // Use these test endpoints to determine where the issue is
    const testEndpoints = [
      { name: 'Auth Test', url: '/api/auth/test-connection' },
      { name: 'User Test', url: '/api/users/connection-test' },
      { name: 'CORS Test', url: '/api/cors-diagnostic' }
    ];
    
    for (const endpoint of testEndpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          },
          // Very important to include credentials
          credentials: 'same-origin'
        });
        
        if (response.ok) {
          apiDebugLogger.info(`✅ ${endpoint.name}: Success (${response.status})`);
          try {
            const data = await response.json();
            apiDebugLogger.debug(`${endpoint.name} Response: ${JSON.stringify(data)}`);
          } catch (e) {
            apiDebugLogger.warn(`${endpoint.name}: Could not parse response JSON: ${e.message}`);
          }
        } else {
          apiDebugLogger.error(`❌ ${endpoint.name}: Failed with status ${response.status}`);
          if (response.status === 502) {
            apiDebugLogger.error(`502 Bad Gateway detected on ${endpoint.name}. This indicates a server connectivity issue.`);
          }
        }
      } catch (error) {
        apiDebugLogger.error(`❌ ${endpoint.name}: Error - ${error.message}`);
      }
    }
    
    // Log network info
    apiDebugLogger.info('Network Information:');
    apiDebugLogger.info(`- Online: ${navigator.onLine}`);
    
    if ('connection' in navigator) {
      const conn = navigator.connection;
      apiDebugLogger.info(`- Effective Type: ${conn.effectiveType}`);
      apiDebugLogger.info(`- Downlink: ${conn.downlink} Mbps`);
      apiDebugLogger.info(`- RTT: ${conn.rtt} ms`);
    }
    
    // Log API performance
    if (apiLatencies.length > 0) {
      const avgLatency = apiLatencies.reduce((sum, val) => sum + val, 0) / apiLatencies.length;
      const maxLatency = Math.max(...apiLatencies);
      apiDebugLogger.info(`API Performance: Avg=${avgLatency.toFixed(2)}ms, Max=${maxLatency}ms, Errors=${errorCount}/${requestCount}`);
    }
    
    apiDebugLogger.info('Connection diagnostics complete');
    
    // Provide recommendations based on diagnostics
    if (errorCount > 0) {
      apiDebugLogger.info('Recommendations:');
      apiDebugLogger.info('1. Check if the server is running');
      apiDebugLogger.info('2. Verify Nginx proxy configuration');
      apiDebugLogger.info('3. Check CORS settings in both client and server');
      apiDebugLogger.info('4. Look for server-side errors in the logs');
      apiDebugLogger.info('5. Run the server/diagnostic.js script for more detailed server-side diagnostics');
    }
  } catch (error) {
    apiDebugLogger.error(`Error running diagnostics: ${error.message}`);
  }
}

// Global error handler to catch unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
  if (API_DEBUG && event.reason && (
      event.reason.message?.includes('network') || 
      event.reason.message?.includes('fetch') ||
      event.reason.message?.includes('axios')
    )) {
    apiDebugLogger.error(`Unhandled API Promise Rejection: ${event.reason.message}`);
    lastError = event.reason;
  }
});

// API for manually triggering diagnostics or accessing debug info
export const APIDebugTools = {
  runDiagnostics: (url = '/api/auth/test-connection') => runConnectionDiagnostics(url),
  getStats: () => ({
    requestCount,
    errorCount,
    lastError: lastError?.message,
    errorRate: requestCount > 0 ? (errorCount / requestCount) * 100 : 0,
    avgLatency: apiLatencies.length > 0 ? (apiLatencies.reduce((sum, val) => sum + val, 0) / apiLatencies.length).toFixed(2) : 0,
    maxLatency: apiLatencies.length > 0 ? Math.max(...apiLatencies) : 0
  }),
  clearStats: () => {
    requestCount = 0;
    errorCount = 0;
    lastError = null;
    apiLatencies = [];
    apiDebugLogger.info('API Debug stats cleared');
  },
  setLogLevel: (level) => {
    // level: 0 = none, 1 = errors only, 2 = warnings+errors, 3 = all
    switch(level) {
      case 0:
        LOG_REQUESTS = false;
        LOG_RESPONSES = false;
        LOG_ERRORS = false;
        break;
      case 1:
        LOG_REQUESTS = false;
        LOG_RESPONSES = false;
        LOG_ERRORS = true;
        break;
      case 2:
        LOG_REQUESTS = false;
        LOG_RESPONSES = true;
        LOG_ERRORS = true;
        break;
      case 3:
        LOG_REQUESTS = true;
        LOG_RESPONSES = true;
        LOG_ERRORS = true;
        break;
      default:
        break;
    }
    apiDebugLogger.info(`API Debug log level set to ${level}`);
  }
};

// Automatically initialize if enabled
if (API_DEBUG) {
  applyAPIDebugMiddleware();
}

export default applyAPIDebugMiddleware;