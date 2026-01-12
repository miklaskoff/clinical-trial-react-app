/**
 * Tests for Claude API Client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeAPIClient } from '../../services/api/claudeClient.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('ClaudeAPIClient', () => {
  let client;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ClaudeAPIClient('sk-test-api-key', 'claude-sonnet-4-5-20250929', {
      persistToStorage: false,
    });
  });

  describe('constructor', () => {
    it('should require API key', () => {
      expect(() => new ClaudeAPIClient()).toThrow('API key is required');
      expect(() => new ClaudeAPIClient('')).toThrow('API key is required');
    });

    it('should use default model if not specified', () => {
      const c = new ClaudeAPIClient('test-key');
      expect(c.getModel()).toBe('claude-sonnet-4-5-20250929');
    });

    it('should accept custom model', () => {
      const c = new ClaudeAPIClient('test-key', 'custom-model');
      expect(c.getModel()).toBe('custom-model');
    });
  });

  describe('setModel', () => {
    it('should update model', () => {
      client.setModel('new-model');
      expect(client.getModel()).toBe('new-model');
    });
  });

  describe('semanticMatch', () => {
    it('should return cached result on cache hit', async () => {
      // First call - will hit API
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '{"match": true, "confidence": 0.9, "reasoning": "test"}' }],
        }),
      });

      const result1 = await client.semanticMatch('diabetes', 'type 2 diabetes', 'condition');
      expect(result1.match).toBe(true);
      expect(result1.confidence).toBe(0.9);

      // Second call - should use cache
      const result2 = await client.semanticMatch('diabetes', 'type 2 diabetes', 'condition');
      expect(result2.fromCache).toBe(true);
      expect(result2.match).toBe(true);

      // fetch should only be called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.semanticMatch('test', 'test');
      expect(result.error).toBe(true);
      expect(result.match).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should handle non-ok responses', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      });

      const result = await client.semanticMatch('test', 'test');
      expect(result.error).toBe(true);
      expect(result.reasoning).toContain('API error');
    });

    it('should handle malformed JSON responses', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'This is not JSON' }],
        }),
      });

      const result = await client.semanticMatch('test', 'test');
      expect(result.error).toBe(true);
    });

    it('should clamp confidence to valid range', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '{"match": true, "confidence": 1.5, "reasoning": "over 1"}' }],
        }),
      });

      const result = await client.semanticMatch('over', 'max');
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('batchSemanticMatch', () => {
    it('should process multiple queries in parallel', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '{"match": true, "confidence": 0.8, "reasoning": "batch"}' }],
        }),
      });

      const queries = [
        { patientTerm: 'a', criterionTerm: 'b' },
        { patientTerm: 'c', criterionTerm: 'd' },
      ];

      const results = await client.batchSemanticMatch(queries);
      expect(results).toHaveLength(2);
      expect(results[0].match).toBe(true);
      expect(results[1].match).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '{"match": true, "confidence": 0.9, "reasoning": "test"}' }],
        }),
      });

      await client.semanticMatch('x', 'y');
      client.clearCache();

      // Next call should hit API again
      await client.semanticMatch('x', 'y');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = client.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
    });
  });
});
