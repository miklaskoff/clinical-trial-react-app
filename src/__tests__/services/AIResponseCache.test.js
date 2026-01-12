/**
 * Tests for AI Response Cache
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  AIResponseCache, 
  generateCacheKey,
  getDefaultCache 
} from '../../services/cache/AIResponseCache.js';

describe('generateCacheKey', () => {
  it('should generate consistent keys for same inputs', () => {
    const key1 = generateCacheKey('diabetes', 'type 2 diabetes');
    const key2 = generateCacheKey('diabetes', 'type 2 diabetes');
    expect(key1).toBe(key2);
  });

  it('should normalize case', () => {
    const key1 = generateCacheKey('Diabetes', 'TYPE 2 DIABETES');
    const key2 = generateCacheKey('diabetes', 'type 2 diabetes');
    expect(key1).toBe(key2);
  });

  it('should trim whitespace', () => {
    const key1 = generateCacheKey('  diabetes  ', 'type 2 diabetes  ');
    const key2 = generateCacheKey('diabetes', 'type 2 diabetes');
    expect(key1).toBe(key2);
  });

  it('should include context in key', () => {
    const key1 = generateCacheKey('diabetes', 'condition', 'medical term');
    const key2 = generateCacheKey('diabetes', 'condition', 'drug');
    expect(key1).not.toBe(key2);
  });
});

describe('AIResponseCache', () => {
  let cache;

  beforeEach(() => {
    // Create cache without localStorage persistence for testing
    cache = new AIResponseCache({
      maxSize: 5,
      ttlMinutes: 1,
      persistToStorage: false,
    });
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      const value = { match: true, confidence: 0.9, reasoning: 'test' };
      cache.set('patient', 'criterion', value);
      
      const result = cache.get('patient', 'criterion');
      expect(result).toEqual(value);
    });

    it('should return null for missing keys', () => {
      const result = cache.get('nonexistent', 'key');
      expect(result).toBeNull();
    });

    it('should check existence with has()', () => {
      cache.set('a', 'b', { test: true });
      expect(cache.has('a', 'b')).toBe(true);
      expect(cache.has('x', 'y')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('a', 'b', { test: 1 });
      cache.set('c', 'd', { test: 2 });
      cache.clear();
      
      expect(cache.has('a', 'b')).toBe(false);
      expect(cache.has('c', 'd')).toBe(false);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when max size reached', () => {
      // Fill cache to max (5)
      cache.set('a', '1', { n: 1 });
      cache.set('b', '2', { n: 2 });
      cache.set('c', '3', { n: 3 });
      cache.set('d', '4', { n: 4 });
      cache.set('e', '5', { n: 5 });
      
      // Add one more - should evict first
      cache.set('f', '6', { n: 6 });
      
      // First entry should be gone
      expect(cache.has('a', '1')).toBe(false);
      // Last entry should exist
      expect(cache.has('f', '6')).toBe(true);
    });

    it('should update LRU order on get()', () => {
      cache.set('a', '1', { n: 1 });
      cache.set('b', '2', { n: 2 });
      cache.set('c', '3', { n: 3 });
      
      // Access 'a' to make it recently used
      cache.get('a', '1');
      
      // Fill to trigger eviction
      cache.set('d', '4', { n: 4 });
      cache.set('e', '5', { n: 5 });
      cache.set('f', '6', { n: 6 });
      
      // 'a' should still exist (was accessed)
      expect(cache.has('a', '1')).toBe(true);
      // 'b' should be evicted (oldest unused)
      expect(cache.has('b', '2')).toBe(false);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      // Create cache with very short TTL
      const shortCache = new AIResponseCache({
        ttlMinutes: 0.001, // ~60ms
        persistToStorage: false,
      });
      
      shortCache.set('test', 'key', { data: 'value' });
      
      // Should exist immediately
      expect(shortCache.has('test', 'key')).toBe(true);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should be expired
      expect(shortCache.get('test', 'key')).toBeNull();
    });

    it('should clean expired entries', async () => {
      const shortCache = new AIResponseCache({
        ttlMinutes: 0.001,
        persistToStorage: false,
      });
      
      shortCache.set('a', 'b', { test: 1 });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const removed = shortCache.cleanExpired();
      expect(removed).toBeGreaterThan(0);
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      cache.set('exists', 'key', { data: 'value' });
      
      // Hit
      cache.get('exists', 'key');
      cache.get('exists', 'key');
      
      // Miss
      cache.get('missing', 'key');
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('66.7%');
    });

    it('should report correct size', () => {
      cache.set('a', '1', { n: 1 });
      cache.set('b', '2', { n: 2 });
      
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
    });
  });

  describe('toJSON', () => {
    it('should export cache state', () => {
      cache.set('test', 'key', { match: true });
      
      const json = cache.toJSON();
      expect(json.stats).toBeDefined();
      expect(json.entries).toBeInstanceOf(Array);
      expect(json.entries.length).toBe(1);
    });
  });
});

describe('getDefaultCache', () => {
  it('should return singleton instance', () => {
    const cache1 = getDefaultCache();
    const cache2 = getDefaultCache();
    expect(cache1).toBe(cache2);
  });
});
