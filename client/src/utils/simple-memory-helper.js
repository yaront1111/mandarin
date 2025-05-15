// client/src/utils/simple-memory-helper.js
// Simple memory management helper for React components

export class MemoryHelper {
  constructor() {
    this.cleanupFuncs = new Set();
  }
  
  // Add a cleanup function
  add(cleanupFunc) {
    if (typeof cleanupFunc === 'function') {
      this.cleanupFuncs.add(cleanupFunc);
    }
    return cleanupFunc;
  }
  
  // Add multiple cleanup functions
  addAll(cleanupFuncs) {
    cleanupFuncs.forEach(func => this.add(func));
  }
  
  // Cleanup all
  cleanup() {
    this.cleanupFuncs.forEach(func => {
      try {
        func();
      } catch (err) {
        console.error('Cleanup error:', err);
      }
    });
    this.cleanupFuncs.clear();
  }
  
  // Create a managed timeout
  setTimeout(callback, delay) {
    const id = setTimeout(callback, delay);
    const cleanup = () => clearTimeout(id);
    this.add(cleanup);
    return cleanup;
  }
  
  // Create a managed interval
  setInterval(callback, delay) {
    const id = setInterval(callback, delay);
    const cleanup = () => clearInterval(id);
    this.add(cleanup);
    return cleanup;
  }
  
  // Add socket subscription
  addSubscription(name, unsubscribe) {
    this.add(unsubscribe);
    return unsubscribe;
  }
}

export default MemoryHelper;