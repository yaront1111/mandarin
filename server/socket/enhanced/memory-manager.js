// server/socket/enhanced/memory-manager.js
// Comprehensive memory management solution

/**
 * Enhanced memory manager with multiple strategies
 */
class MemoryManager {
  constructor(options = {}) {
    this.maxAge = options.maxAge || 30 * 60 * 1000; // 30 minutes
    this.maxSize = options.maxSize || 10000; // max items
    this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 5 minutes
    this.useWeakRefs = options.useWeakRefs || false;
    
    // Primary storage
    this.data = new Map();
    this.timestamps = new Map();
    this.references = new Map();
    
    // Weak reference storage for suitable data
    this.weakData = new WeakMap();
    
    // LRU tracking
    this.accessOrder = [];
    
    // Start cleanup timer
    this.startCleanupTimer();
  }
  
  /**
   * Set a value with automatic expiry and reference tracking
   */
  set(key, value, options = {}) {
    const now = Date.now();
    
    // Handle weak references when applicable
    if (this.useWeakRefs && typeof value === 'object' && value !== null) {
      this.weakData.set(key, new WeakRef(value));
    }
    
    // Standard storage
    this.data.set(key, value);
    this.timestamps.set(key, now);
    
    // Track references
    if (options.references) {
      this.references.set(key, options.references);
    }
    
    // Update LRU
    this.updateLRU(key);
    
    // Enforce size limit
    if (this.data.size > this.maxSize) {
      this.evictLRU();
    }
    
    // Schedule expiry if needed
    if (options.ttl) {
      setTimeout(() => this.delete(key), options.ttl);
    }
  }
  
  /**
   * Get a value and update access time
   */
  get(key) {
    // Check weak reference first
    if (this.useWeakRefs && this.weakData.has(key)) {
      const ref = this.weakData.get(key);
      const value = ref.deref();
      if (value !== undefined) {
        this.updateLRU(key);
        return value;
      } else {
        // Reference was garbage collected
        this.delete(key);
        return undefined;
      }
    }
    
    // Standard get
    if (this.data.has(key)) {
      this.updateLRU(key);
      return this.data.get(key);
    }
    
    return undefined;
  }
  
  /**
   * Delete a key and cleanup references
   */
  delete(key) {
    this.data.delete(key);
    this.timestamps.delete(key);
    this.references.delete(key);
    this.weakData.delete(key);
    
    // Remove from LRU
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
  
  /**
   * Update LRU access order
   */
  updateLRU(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }
  
  /**
   * Evict least recently used items
   */
  evictLRU(count = 1) {
    const toEvict = this.accessOrder.slice(0, count);
    toEvict.forEach(key => this.delete(key));
  }
  
  /**
   * Event-based cleanup - call on disconnect
   */
  handleDisconnect(key, references = []) {
    // Immediate cleanup if no other references
    const hasReferences = this.checkReferences(key, references);
    if (!hasReferences) {
      this.delete(key);
    } else {
      // Mark for cleanup after timeout
      this.timestamps.set(key, Date.now());
    }
  }
  
  /**
   * Check if item has active references
   */
  checkReferences(key, excludeRefs = []) {
    const refs = this.references.get(key) || [];
    return refs.some(ref => !excludeRefs.includes(ref));
  }
  
  /**
   * Periodic cleanup of stale data
   */
  cleanup() {
    const now = Date.now();
    const toDelete = [];
    
    // Time-based cleanup
    for (const [key, timestamp] of this.timestamps.entries()) {
      if (now - timestamp > this.maxAge) {
        // Double-check references before deletion
        if (!this.checkReferences(key)) {
          toDelete.push(key);
        }
      }
    }
    
    // Delete stale entries
    toDelete.forEach(key => this.delete(key));
    
    // Size-based cleanup if needed
    if (this.data.size > this.maxSize * 0.9) {
      const toEvict = Math.floor(this.data.size * 0.1);
      this.evictLRU(toEvict);
    }
    
    return toDelete.length;
  }
  
  /**
   * Start periodic cleanup timer
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      const cleaned = this.cleanup();
      if (cleaned > 0) {
        console.log(`[MemoryManager] Cleaned ${cleaned} stale entries`);
      }
    }, this.cleanupInterval);
    
    // Ensure timer doesn't prevent process exit
    this.cleanupTimer.unref();
  }
  
  /**
   * Stop cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
  
  /**
   * Get memory usage statistics
   */
  getStats() {
    return {
      size: this.data.size,
      maxSize: this.maxSize,
      weakRefs: this.weakData.size || 'unknown',
      oldestEntry: Math.min(...Array.from(this.timestamps.values())),
      memoryUsage: process.memoryUsage().heapUsed
    };
  }
  
  /**
   * Clear all data
   */
  clear() {
    this.data.clear();
    this.timestamps.clear();
    this.references.clear();
    this.accessOrder = [];
    // WeakMap clears automatically
  }
  
  /**
   * Destroy the manager
   */
  destroy() {
    this.stopCleanupTimer();
    this.clear();
  }
}

export default MemoryManager;