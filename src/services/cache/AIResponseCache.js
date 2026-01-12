/**
 * AI Response Cache with LRU eviction and TTL
 * Caches semantic matching results to reduce API calls
 * @module services/cache/AIResponseCache
 */

/**
 * Generate a cache key from patient term and criterion term
 * @param {string} patientTerm - Patient's term
 * @param {string} criterionTerm - Criterion term to match against
 * @param {string} [context=''] - Additional context
 * @returns {string} Cache key
 */
export function generateCacheKey(patientTerm, criterionTerm, context = '') {
  const normalized = [
    patientTerm.toLowerCase().trim(),
    criterionTerm.toLowerCase().trim(),
    context.toLowerCase().trim(),
  ].join('|');
  return normalized;
}

/**
 * AI Response Cache class
 * Implements LRU (Least Recently Used) eviction with TTL (Time To Live)
 */
export class AIResponseCache {
  #cache;
  #maxSize;
  #ttlMs;
  #hits;
  #misses;
  #storageKey;

  /**
   * Create an AI Response Cache
   * @param {Object} options - Cache options
   * @param {number} [options.maxSize=1000] - Maximum cache entries
   * @param {number} [options.ttlMinutes=60] - Time to live in minutes
   * @param {string} [options.storageKey='ai_response_cache'] - localStorage key
   * @param {boolean} [options.persistToStorage=true] - Whether to persist to localStorage
   */
  constructor(options = {}) {
    this.#maxSize = options.maxSize || 1000;
    this.#ttlMs = (options.ttlMinutes || 60) * 60 * 1000;
    this.#storageKey = options.storageKey || 'ai_response_cache';
    this.#hits = 0;
    this.#misses = 0;
    this.#cache = new Map();

    // Load from localStorage if available
    if (options.persistToStorage !== false) {
      this.#loadFromStorage();
    }
  }

  /**
   * Get a cached response
   * @param {string} patientTerm - Patient term
   * @param {string} criterionTerm - Criterion term
   * @param {string} [context=''] - Context
   * @returns {Object|null} Cached result or null if not found/expired
   */
  get(patientTerm, criterionTerm, context = '') {
    const key = generateCacheKey(patientTerm, criterionTerm, context);
    const entry = this.#cache.get(key);

    if (!entry) {
      this.#misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.#cache.delete(key);
      this.#misses++;
      return null;
    }

    // Move to end for LRU (most recently used)
    this.#cache.delete(key);
    this.#cache.set(key, entry);
    this.#hits++;

    return entry.value;
  }

  /**
   * Set a cached response
   * @param {string} patientTerm - Patient term
   * @param {string} criterionTerm - Criterion term
   * @param {Object} value - Value to cache
   * @param {string} [context=''] - Context
   */
  set(patientTerm, criterionTerm, value, context = '') {
    const key = generateCacheKey(patientTerm, criterionTerm, context);

    // Evict if at max size (LRU - remove first/oldest entry)
    if (this.#cache.size >= this.#maxSize) {
      const firstKey = this.#cache.keys().next().value;
      this.#cache.delete(firstKey);
    }

    this.#cache.set(key, {
      value,
      expiresAt: Date.now() + this.#ttlMs,
      createdAt: Date.now(),
    });

    // Persist to storage
    this.#saveToStorage();
  }

  /**
   * Check if cache has a valid entry
   * @param {string} patientTerm - Patient term
   * @param {string} criterionTerm - Criterion term
   * @param {string} [context=''] - Context
   * @returns {boolean} True if valid entry exists
   */
  has(patientTerm, criterionTerm, context = '') {
    const key = generateCacheKey(patientTerm, criterionTerm, context);
    const entry = this.#cache.get(key);
    
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.#cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Clear expired entries
   * @returns {number} Number of entries removed
   */
  cleanExpired() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.#cache.entries()) {
      if (now > entry.expiresAt) {
        this.#cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.#saveToStorage();
    }

    return removed;
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.#cache.clear();
    this.#hits = 0;
    this.#misses = 0;
    this.#saveToStorage();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const total = this.#hits + this.#misses;
    return {
      size: this.#cache.size,
      maxSize: this.#maxSize,
      hits: this.#hits,
      misses: this.#misses,
      hitRate: total > 0 ? (this.#hits / total * 100).toFixed(1) + '%' : '0%',
      ttlMinutes: this.#ttlMs / 60000,
    };
  }

  /**
   * Load cache from localStorage
   */
  #loadFromStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      
      const stored = localStorage.getItem(this.#storageKey);
      if (!stored) return;

      const data = JSON.parse(stored);
      const now = Date.now();

      // Restore non-expired entries
      for (const [key, entry] of Object.entries(data)) {
        if (entry.expiresAt > now) {
          this.#cache.set(key, entry);
        }
      }
    } catch (error) {
      console.warn('Failed to load AI cache from storage:', error);
    }
  }

  /**
   * Save cache to localStorage
   */
  #saveToStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      
      const data = Object.fromEntries(this.#cache.entries());
      localStorage.setItem(this.#storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save AI cache to storage:', error);
    }
  }

  /**
   * Export cache for debugging
   * @returns {Object} Cache data
   */
  toJSON() {
    return {
      stats: this.getStats(),
      entries: Array.from(this.#cache.entries()).map(([key, entry]) => ({
        key,
        expiresIn: Math.round((entry.expiresAt - Date.now()) / 1000) + 's',
        value: entry.value,
      })),
    };
  }
}

// Singleton instance for app-wide use
let defaultCache = null;

/**
 * Get the default cache instance
 * @returns {AIResponseCache} Default cache
 */
export function getDefaultCache() {
  if (!defaultCache) {
    defaultCache = new AIResponseCache();
  }
  return defaultCache;
}

export default AIResponseCache;
