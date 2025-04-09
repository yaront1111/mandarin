// diagnostic.js - Tool to diagnose 502 Bad Gateway errors and connectivity issues
import http from 'http';
import net from 'net';
import { exec } from 'child_process';
import util from 'util';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from './logger.js';

// Convert exec to promise-based
const execPromise = util.promisify(exec);

// Get server config
import config from './config.js';

const PORT = process.env.PORT || config.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper function to check if a port is in use
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

// Check if the Node.js server process is running
async function checkServerProcess() {
  logger.info('Checking if server process is running...');
  try {
    const { stdout } = await execPromise(`ps aux | grep 'node.*server.js' | grep -v grep`);
    if (stdout.trim()) {
      logger.info('✅ Server process is running:');
      logger.info(stdout.trim());
      return true;
    } else {
      logger.warn('❌ Server process not found!');
      return false;
    }
  } catch (error) {
    logger.warn('❌ Server process not found or error checking process!');
    logger.error(error.message);
    return false;
  }
}

// Check if the port is in use
async function checkPort() {
  logger.info(`Checking if port ${PORT} is in use...`);
  const inUse = await isPortInUse(PORT);
  if (inUse) {
    logger.info(`✅ Port ${PORT} is in use (something is listening)`);
    try {
      const { stdout } = await execPromise(`lsof -i :${PORT} | grep LISTEN`);
      logger.info(`Process listening on port ${PORT}:`);
      logger.info(stdout.trim());
    } catch (error) {
      logger.warn(`Could not determine which process is using port ${PORT}`);
    }
    return true;
  } else {
    logger.warn(`❌ Port ${PORT} is not in use (nothing is listening)`);
    return false;
  }
}

// Test API endpoint connectivity
async function testApiEndpoint(endpoint) {
  const url = `${BASE_URL}${endpoint}`;
  logger.info(`Testing API endpoint: ${url}`);
  
  try {
    const response = await axios.get(url, {
      timeout: 5000, // 5 second timeout
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    logger.info(`✅ API endpoint ${url} is accessible:`);
    logger.info(`Status: ${response.status} ${response.statusText}`);
    logger.info(`Response: ${JSON.stringify(response.data, null, 2)}`);
    return true;
  } catch (error) {
    logger.error(`❌ Error accessing API endpoint ${url}:`);
    if (error.response) {
      // Server responded with non-2xx status
      logger.error(`Status: ${error.response.status} ${error.response.statusText}`);
      logger.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.request) {
      // No response received
      logger.error(`No response received. Request details: ${error.request._currentUrl}`);
      logger.error(`Is the server running and accessible?`);
    } else {
      // Request setup error
      logger.error(`Error setting up request: ${error.message}`);
    }
    return false;
  }
}

// Test connection to specific routes that have issues
async function testSpecificRoutes() {
  logger.info('Testing specific routes:');
  
  const endpoints = [
    '/api/users/connection-test',
    '/api/auth/test-connection',
    '/api/health'
  ];
  
  const results = {};
  
  for (const endpoint of endpoints) {
    results[endpoint] = await testApiEndpoint(endpoint);
  }
  
  return results;
}

// Test CORS preflight requests
async function testCorsHeaders() {
  logger.info('Testing CORS preflight headers...');
  
  const url = `${BASE_URL}/api/users/connection-test`;
  
  try {
    // First try a preflight OPTIONS request
    const optionsResponse = await axios({
      method: 'OPTIONS',
      url,
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization,Content-Type'
      }
    });
    
    logger.info('✅ CORS Preflight response:');
    logger.info(`Status: ${optionsResponse.status} ${optionsResponse.statusText}`);
    
    // Check for CORS headers
    const corsHeaders = [
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Methods',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Credentials'
    ];
    
    const missingHeaders = corsHeaders.filter(header => !optionsResponse.headers[header.toLowerCase()]);
    
    if (missingHeaders.length === 0) {
      logger.info('✅ All expected CORS headers are present');
      logger.info('CORS Headers:');
      corsHeaders.forEach(header => {
        logger.info(`${header}: ${optionsResponse.headers[header.toLowerCase()]}`);
      });
      return true;
    } else {
      logger.warn(`❌ Missing CORS headers: ${missingHeaders.join(', ')}`);
      logger.info('Present CORS Headers:');
      corsHeaders.forEach(header => {
        if (optionsResponse.headers[header.toLowerCase()]) {
          logger.info(`${header}: ${optionsResponse.headers[header.toLowerCase()]}`);
        }
      });
      return false;
    }
  } catch (error) {
    logger.error('❌ Error testing CORS preflight:');
    if (error.response) {
      logger.error(`Status: ${error.response.status} ${error.response.statusText}`);
    } else {
      logger.error(`Error: ${error.message}`);
    }
    return false;
  }
}

// Check Nginx configuration
async function checkNginxConfig() {
  logger.info('Checking Nginx configuration...');
  
  try {
    // First check if nginx is installed
    const { stdout: nginxVersion } = await execPromise('nginx -v 2>&1');
    logger.info(`Nginx version: ${nginxVersion.trim()}`);
    
    // Check for Nginx configuration file
    const nginxConfigPath = path.resolve('../nginx-mandarin.conf');
    
    if (fs.existsSync(nginxConfigPath)) {
      logger.info(`✅ Nginx configuration file found: ${nginxConfigPath}`);
      
      // Look for proxy settings in the config
      const configContent = fs.readFileSync(nginxConfigPath, 'utf8');
      
      if (configContent.includes('proxy_pass') && configContent.includes('location /api/')) {
        logger.info('✅ Nginx configuration contains API proxy settings');
        
        // Check for common Nginx settings that prevent 502 errors
        const goodSettings = [
          'proxy_connect_timeout',
          'proxy_read_timeout', 
          'proxy_send_timeout',
          'proxy_buffer_size',
          'proxy_http_version 1.1',
          'proxy_set_header Connection "upgrade"'
        ];
        
        const presentSettings = goodSettings.filter(setting => configContent.includes(setting));
        
        if (presentSettings.length === goodSettings.length) {
          logger.info('✅ Nginx configuration contains all recommended settings to prevent 502 errors');
        } else {
          const missingSettings = goodSettings.filter(setting => !configContent.includes(setting));
          logger.warn(`⚠️ Nginx configuration is missing some recommended settings: ${missingSettings.join(', ')}`);
        }
        
        return true;
      } else {
        logger.warn('⚠️ Nginx configuration does not contain API proxy settings or /api/ location block');
        return false;
      }
    } else {
      logger.warn(`⚠️ Nginx configuration file not found at ${nginxConfigPath}`);
      return false;
    }
  } catch (error) {
    logger.info('Nginx not found or error checking configuration');
    logger.error(error.message);
    return false;
  }
}

// Check network connectivity
async function checkNetworkConnectivity() {
  logger.info('Checking network connectivity...');
  
  // Get network interfaces
  const interfaces = os.networkInterfaces();
  
  logger.info('Network interfaces:');
  Object.keys(interfaces).forEach(interfaceName => {
    interfaces[interfaceName].forEach(iface => {
      if (!iface.internal) {
        logger.info(`${interfaceName}: ${iface.address} (${iface.family})`);
      }
    });
  });
  
  // Check if server is bound to localhost only instead of all interfaces
  try {
    const { stdout } = await execPromise(`netstat -an | grep ${PORT} | grep LISTEN`);
    logger.info(`Listening on port ${PORT}:`);
    logger.info(stdout.trim());
    
    if (stdout.includes('127.0.0.1') && !stdout.includes('0.0.0.0') && !stdout.includes('::')) {
      logger.warn('⚠️ Server appears to be listening only on localhost (127.0.0.1)');
      logger.warn('This may prevent connections from nginx if it is running in a different container');
      logger.warn('Consider binding to 0.0.0.0 (all interfaces) instead');
      return false;
    } else {
      logger.info('✅ Server is listening on all interfaces or a specific IP');
      return true;
    }
  } catch (error) {
    logger.warn('Could not determine listening interfaces');
    return false;
  }
}

// Provide overall diagnosis and recommendations
function provideDiagnosis(results) {
  logger.info('\n=== CONNECTIVITY DIAGNOSIS ===\n');
  
  if (!results.serverRunning) {
    logger.error('CRITICAL ISSUE: Node.js server process is not running!');
    logger.info('RECOMMENDATION: Start the server with "node server.js" or "npm start"');
    return;
  }
  
  if (!results.portInUse) {
    logger.error(`CRITICAL ISSUE: Nothing is listening on port ${PORT}!`);
    logger.info(`RECOMMENDATION: Make sure the server is correctly binding to port ${PORT}`);
    return;
  }
  
  if (!results.apiAccessible) {
    logger.error('CRITICAL ISSUE: Cannot access API endpoints directly!');
    
    if (results.networkBindingOk) {
      logger.info('RECOMMENDATION: Check server error logs for application errors');
    } else {
      logger.info('RECOMMENDATION: Update server.js to listen on all interfaces: server.listen(PORT, "0.0.0.0", ...)');
    }
    return;
  }
  
  // If we reached here, basic connectivity works
  
  const connectionIssues = Object.values(results.specificRoutes).some(success => !success);
  
  if (connectionIssues) {
    logger.warn('ISSUE: Some specific API routes are not accessible');
    logger.info('RECOMMENDATION: Check server logs for errors related to specific routes');
  }
  
  if (!results.corsHeadersOk) {
    logger.warn('ISSUE: CORS headers may not be properly configured');
    logger.info('RECOMMENDATION: Update CORS configuration in cors.js middleware to include:');
    logger.info('  - Access-Control-Allow-Origin: * or specific origin');
    logger.info('  - Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    logger.info('  - Access-Control-Allow-Headers: Authorization, Content-Type, etc.');
  }
  
  if (!results.nginxConfigOk) {
    logger.warn('ISSUE: Nginx configuration may be incomplete or missing');
    logger.info('RECOMMENDATION: Verify nginx-mandarin.conf file includes:');
    logger.info('  - Correct proxy_pass to the Node.js server');
    logger.info('  - Extended timeouts (proxy_read_timeout, proxy_connect_timeout)');
    logger.info('  - WebSocket support if needed (proxy_http_version 1.1, etc.)');
  }
  
  // If everything is OK
  if (
    !connectionIssues && 
    results.corsHeadersOk && 
    results.nginxConfigOk &&
    results.networkBindingOk
  ) {
    logger.info('✅ DIAGNOSIS: All checks passed! The server appears to be configured correctly.');
    logger.info('If you are still experiencing 502 errors, the issue might be:');
    logger.info('  - A specific API endpoint is timing out or crashing');
    logger.info('  - The server process is crashing when handling certain requests');
    logger.info('  - Nginx server_name or listen directives are incorrect');
    logger.info('  - The client-side API request configuration has issues');
  } else {
    logger.info('⚠️ Some issues were identified that could contribute to 502 errors');
  }
}

// Main diagnostic function
async function runDiagnostics() {
  logger.info('Starting API connectivity diagnostics...');
  
  // Store diagnostic results
  const results = {
    serverRunning: false,
    portInUse: false,
    apiAccessible: false,
    specificRoutes: {},
    corsHeadersOk: false,
    nginxConfigOk: false,
    networkBindingOk: false
  };
  
  // 1. Check server process
  results.serverRunning = await checkServerProcess();
  
  // 2. Check port
  results.portInUse = await checkPort();
  
  // 3. Test basic API connectivity
  if (results.portInUse) {
    results.apiAccessible = await testApiEndpoint('/api/health');
    
    // 4. Test specific routes
    if (results.apiAccessible) {
      results.specificRoutes = await testSpecificRoutes();
    }
    
    // 5. Test CORS headers
    results.corsHeadersOk = await testCorsHeaders();
  }
  
  // 6. Check Nginx configuration
  results.nginxConfigOk = await checkNginxConfig();
  
  // 7. Check network binding
  results.networkBindingOk = await checkNetworkConnectivity();
  
  // 8. Provide overall diagnosis
  provideDiagnosis(results);
  
  return results;
}

// Only run diagnostics if this script is executed directly
if (process.argv[1].includes('diagnostic.js')) {
  runDiagnostics()
    .catch(error => {
      logger.error('Error running diagnostics:', error);
    });
}

export { runDiagnostics };