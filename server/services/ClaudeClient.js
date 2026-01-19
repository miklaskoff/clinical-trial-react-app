/**
 * @file Claude API client service
 * @description Wrapper for Anthropic SDK with caching
 */

import Anthropic from '@anthropic-ai/sdk';
import { getDatabase } from '../db.js';

/**
 * Claude API client with caching support
 */
export class ClaudeClient {
  /** @type {Anthropic | null} */
  #client = null;
  
  /** @type {string} */
  #model = 'claude-sonnet-4-5-20250929';
  
  /** @type {Map<string, { result: any, expiresAt: number }>} */
  #memoryCache = new Map();
  
  /** @type {number} Cache TTL in milliseconds (1 hour) */
  #cacheTTL = 60 * 60 * 1000;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (apiKey && apiKey !== 'your_api_key_here') {
      this.#client = new Anthropic({ apiKey });
    }
  }

  /**
   * Check if client is configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.#client !== null;
  }

  /**
   * Generate cache key for a query
   * @param {string} patientTerm 
   * @param {string} criterionTerm 
   * @param {string} context 
   * @returns {string}
   */
  #getCacheKey(patientTerm, criterionTerm, context = '') {
    return `${patientTerm}|${criterionTerm}|${context}`.toLowerCase();
  }

  /**
   * Get cached result
   * @param {string} key 
   * @returns {any | null}
   */
  #getFromCache(key) {
    const cached = this.#memoryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
    // Expired, remove it
    if (cached) {
      this.#memoryCache.delete(key);
    }
    return null;
  }

  /**
   * Store result in cache
   * @param {string} key 
   * @param {any} result 
   */
  #setCache(key, result) {
    this.#memoryCache.set(key, {
      result,
      expiresAt: Date.now() + this.#cacheTTL
    });
  }

  /**
   * Semantic match between patient term and criterion
   * @param {string} patientTerm 
   * @param {string} criterionTerm 
   * @param {string} [context='medical term']
   * @returns {Promise<{ match: boolean, confidence: number, reasoning: string, cached?: boolean }>}
   */
  async semanticMatch(patientTerm, criterionTerm, context = 'medical term') {
    const cacheKey = this.#getCacheKey(patientTerm, criterionTerm, context);
    
    // Check cache first
    const cached = this.#getFromCache(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    if (!this.#client) {
      // Return a conservative no-match if no API key
      return {
        match: false,
        confidence: 0,
        reasoning: 'AI client not configured',
        cached: false
      };
    }

    const prompt = `You are a medical expert AI specializing in clinical trial eligibility matching.

Task: Determine if a patient's ${context} semantically matches a clinical trial criterion.

Patient's ${context}: "${patientTerm}"
Trial Criterion: "${criterionTerm}"

Instructions:
1. Analyze if these terms are semantically equivalent or related
2. Consider medical synonyms, related conditions, drug classes
3. Provide a confidence score between 0.0 and 1.0

Respond ONLY with valid JSON in this exact format:
{
  "match": true/false,
  "confidence": 0.X,
  "reasoning": "Brief explanation..."
}`;

    try {
      const response = await this.#client.messages.create({
        model: this.#model,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0]?.text || '{}';
      const result = JSON.parse(text);

      // Cache the result
      this.#setCache(cacheKey, result);

      return { ...result, cached: false };

    } catch (error) {
      console.error('Claude API error:', error.message);
      throw new Error(`AI matching failed: ${error.message}`);
    }
  }

  /**
   * Batch semantic matching
   * @param {Array<{ patientTerm: string, criterionTerm: string, context?: string }>} queries 
   * @returns {Promise<Array<{ match: boolean, confidence: number, reasoning: string }>>}
   */
  async batchSemanticMatch(queries) {
    // Process in parallel
    const results = await Promise.all(
      queries.map(q => 
        this.semanticMatch(q.patientTerm, q.criterionTerm, q.context || 'medical term')
      )
    );
    return results;
  }

  /**
   * Clear memory cache
   */
  clearCache() {
    this.#memoryCache.clear();
  }

  /**
   * Get cache statistics
   * @returns {{ size: number, keys: string[] }}
   */
  getCacheStats() {
    return {
      size: this.#memoryCache.size,
      keys: Array.from(this.#memoryCache.keys())
    };
  }
}

// Singleton instance
let clientInstance = null;

/**
 * Get Claude client instance
 * @returns {ClaudeClient}
 */
export function getClaudeClient() {
  if (!clientInstance) {
    clientInstance = new ClaudeClient();
  }
  return clientInstance;
}
