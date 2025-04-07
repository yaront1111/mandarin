/**
 * Web Vitals optimization utilities
 * This file contains utilities for measuring and reporting Core Web Vitals metrics
 */

// Constants for performance metrics
const METRICS = {
  CLS: 'CLS', // Cumulative Layout Shift
  FID: 'FID', // First Input Delay
  LCP: 'LCP', // Largest Contentful Paint
  FCP: 'FCP', // First Contentful Paint
  TTFB: 'TTFB', // Time to First Byte
  INP: 'INP',  // Interaction to Next Paint
};

// Track if metrics have been already reported to avoid duplicates
const reportedMetrics = {};

/**
 * Report a Web Vitals metric to the server
 * @param {Object} metric - The Web Vitals metric object
 * @param {Object} options - Additional reporting options
 */
const reportWebVitals = (metric, options = {}) => {
  // Ensure we don't report the same metric multiple times
  if (reportedMetrics[metric.name]) return;
  reportedMetrics[metric.name] = true;

  // Add to performance marks for debugging in devtools
  if (window.performance && window.performance.mark) {
    try {
      window.performance.mark(`${metric.name}-${Math.round(metric.value)}`);
    } catch (e) {
      // Silently catch errors in case browser doesn't support this
    }
  }

  // Format the metric data
  const metricData = {
    name: metric.name,
    value: Math.round(metric.value * 100) / 100, // Round to 2 decimal places
    rating: metric.rating, // 'good', 'needs-improvement', or 'poor'
    delta: Math.round(metric.delta * 100) / 100,
    id: metric.id,
    navigationType: getNavigationType(),
    url: window.location.href,
    timestamp: new Date().toISOString(),
    connection: getConnectionInfo(),
    device: {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      userAgent: navigator.userAgent,
    },
    ...options
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    const color = metric.rating === 'good' ? 'green' : 
                  metric.rating === 'poor' ? 'red' : 'orange';
    console.log(`%c${metric.name}: ${metricData.value} (${metric.rating})`, `color: ${color}; font-weight: bold;`);
  }

  // Send analytics data to server (only if endpoint exists)
  if (navigator.sendBeacon && window.location.hostname !== 'flirtss.com') {
    try {
      const blob = new Blob([JSON.stringify({ webVitals: metricData })], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/web-vitals', blob);
    } catch (e) {
      // Silently fail if beacon is not available
    }
  } else {
    // Just log in console for now until analytics API is implemented
    console.debug('Web Vital:', metricData.name, metricData.value);
  }
};

/**
 * Get information about the user's connection
 * @returns {Object} Connection information
 */
const getConnectionInfo = () => {
  // Check if Network Information API is available
  const connection = navigator.connection || 
                     navigator.mozConnection || 
                     navigator.webkitConnection;
  
  if (!connection) return { type: 'unknown' };
  
  return {
    type: connection.effectiveType || connection.type || 'unknown',
    downlink: connection.downlink,
    rtt: connection.rtt,
    saveData: connection.saveData,
  };
};

/**
 * Get navigation type information
 * @returns {string} Navigation type
 */
const getNavigationType = () => {
  const navigation = window.performance?.getEntriesByType?.('navigation')?.[0];
  if (navigation) {
    return navigation.type;
  }
  return 'navigate';
};

/**
 * Initialize web vitals tracking
 * This sets up event listeners and imports the web-vitals library
 * to track and report Core Web Vitals metrics
 */
export const initWebVitals = () => {
  // Skip in non-browser environments
  if (typeof window === 'undefined') return;

  // Only load web-vitals in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('Web Vitals tracking disabled in development mode.');
    return;
  }

  // Dynamically import web-vitals library
  import('web-vitals').then((webVitals) => {
    try {
      // Access functions safely with error handling
      const { getCLS, getFID, getLCP, getFCP, getTTFB } = webVitals;
      
      // Register core web vitals
      if (typeof getCLS === 'function') getCLS(metric => reportWebVitals(metric));
      if (typeof getFID === 'function') getFID(metric => reportWebVitals(metric));
      if (typeof getLCP === 'function') getLCP(metric => reportWebVitals(metric));
      if (typeof getFCP === 'function') getFCP(metric => reportWebVitals(metric));
      if (typeof getTTFB === 'function') getTTFB(metric => reportWebVitals(metric));
      
      // Safely try to use INP if available
      if (typeof webVitals.getINP === 'function') {
        webVitals.getINP(metric => reportWebVitals(metric));
      }
    } catch (error) {
      console.warn('Error initializing Web Vitals:', error);
    }
  }).catch(error => {
    console.warn('Failed to load web-vitals library:', error);
  });

  // Add custom performance timing for route changes
  setupRouteChangeTracking();
};

/**
 * Track performance for route changes in a SPA
 */
const setupRouteChangeTracking = () => {
  let routeChangeStart = 0;

  // Create custom event listeners for route changes
  // These events should be dispatched manually in your router
  window.addEventListener('routeChangeStart', () => {
    routeChangeStart = performance.now();
  });

  window.addEventListener('routeChangeComplete', () => {
    if (routeChangeStart === 0) return;
    
    const routeChangeTime = performance.now() - routeChangeStart;
    
    reportWebVitals({
      name: 'route-change',
      value: routeChangeTime,
      rating: routeChangeTime < 100 ? 'good' : 
              routeChangeTime < 300 ? 'needs-improvement' : 'poor',
      delta: routeChangeTime,
      id: `route-${Date.now()}`,
    });
    
    routeChangeStart = 0;
  });
};

export const dispatchRouteChangeStart = () => {
  window.dispatchEvent(new CustomEvent('routeChangeStart'));
};

export const dispatchRouteChangeComplete = () => {
  window.dispatchEvent(new CustomEvent('routeChangeComplete'));
};

export default {
  initWebVitals,
  reportWebVitals,
  dispatchRouteChangeStart,
  dispatchRouteChangeComplete
};