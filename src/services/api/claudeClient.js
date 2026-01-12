/**
 * Claude API Client
 * Wrapper for Anthropic Claude API with caching support
 * @module services/api/claudeClient
 */

import { AIResponseCache } from '../cache/AIResponseCache.js';

/**
 * @typedef {Object} SemanticMatchResult
 * @property {boolean} match - Whether terms match semantically
 * @property {number} confidence - Confidence score (0.0 - 1.0)
 * @property {string} reasoning - Explanation of the match
 * @property {boolean} [error] - Whether an error occurred
 * @property {boolean} [fromCache] - Whether result came from cache
 */

/**
 * Claude API Client for semantic matching
 */
export class ClaudeAPIClient {
  #apiKey;
  #model;
  #cache;
  #apiUrl = 'https://api.anthropic.com/v1/messages';

  /**
   * Create Claude API client
   * @param {string} apiKey - Anthropic API key
   * @param {string} [model='claude-sonnet-4-5-20250929'] - Model to use
   * @param {Object} [cacheOptions] - Cache configuration
   */
  constructor(apiKey, model = 'claude-sonnet-4-5-20250929', cacheOptions = {}) {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }
    this.#apiKey = apiKey;
    this.#model = model;
    // Use persistent AIResponseCache
    this.#cache = new AIResponseCache({
      maxSize: cacheOptions.maxSize || 500,
      ttlMinutes: cacheOptions.ttlMinutes || 120, // 2 hours default
      storageKey: 'claude_semantic_cache',
      ...cacheOptions,
    });
  }

  /**
   * Get cache key for a query
   * @param {string} patientTerm - Patient term
   * @param {string} criterionTerm - Criterion term
   * @returns {string} Cache key
   */
  #getCacheKey(patientTerm, criterionTerm) {
    return `${patientTerm.toLowerCase()}::${criterionTerm.toLowerCase()}`;
  }

  /**
   * Build prompt for semantic matching
   * @param {string} patientTerm - Patient's condition/treatment
   * @param {string} criterionTerm - Trial criterion
   * @param {string} context - Additional context
   * @returns {string} Formatted prompt
   */
  #buildPrompt(patientTerm, criterionTerm, context) {
    return `You are a medical expert AI specializing in clinical trial eligibility matching.

Task: Determine if a patient's ${context} semantically matches a clinical trial criterion.

Patient's ${context}: "${patientTerm}"
Trial Criterion: "${criterionTerm}"

Instructions:
1. Analyze if these terms are semantically equivalent or if the patient's term falls under the criterion
2. Consider medical synonyms, related conditions, and clinical relationships
3. Provide a confidence score between 0.0 and 1.0:
   - 0.9-1.0: Very strong match (exact synonym or direct relationship)
   - 0.7-0.89: Strong match (closely related or typically associated)
   - 0.5-0.69: Moderate match (potentially related, needs review)
   - 0.3-0.49: Weak match (distantly related)
   - 0.0-0.29: No meaningful match

Respond ONLY with valid JSON in this exact format:
{
  "match": true/false,
  "confidence": 0.X,
  "reasoning": "Brief explanation of the medical relationship"
}`;
  }

  /**
   * Parse API response
   * @param {string} responseText - Raw response text
   * @returns {SemanticMatchResult} Parsed result
   */
  #parseResponse(responseText) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (
        typeof parsed.match !== 'boolean' ||
        typeof parsed.confidence !== 'number' ||
        typeof parsed.reasoning !== 'string'
      ) {
        throw new Error('Invalid response structure');
      }

      // Ensure confidence is in valid range
      parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

      return parsed;
    } catch (error) {
      console.error('Failed to parse Claude response:', error);
      return {
        match: false,
        confidence: 0,
        reasoning: `Parse error: ${error.message}`,
        error: true,
      };
    }
  }

  /**
   * Call Claude API
   * @param {string} prompt - Prompt to send
   * @returns {Promise<string>} Response text
   */
  async #callAPI(prompt) {
    const response = await fetch(this.#apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.#apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.#model,
        max_tokens: 500,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `API request failed with status ${response.status}`
      );
    }

    const data = await response.json();
    return data.content[0].text;
  }

  /**
   * Perform semantic matching using Claude API
   * @param {string} patientTerm - Patient's condition/treatment
   * @param {string} criterionTerm - Trial criterion
   * @param {string} [context='medical term'] - Additional context
   * @returns {Promise<SemanticMatchResult>} Match result
   */
  async semanticMatch(patientTerm, criterionTerm, context = 'medical term') {
    // Check cache first (using AIResponseCache)
    const cachedResult = this.#cache.get(patientTerm, criterionTerm, context);
    if (cachedResult) {
      return { ...cachedResult, fromCache: true };
    }

    try {
      const prompt = this.#buildPrompt(patientTerm, criterionTerm, context);
      const responseText = await this.#callAPI(prompt);
      const result = this.#parseResponse(responseText);

      // Cache successful results
      if (!result.error) {
        this.#cache.set(patientTerm, criterionTerm, result, context);
      }

      return result;
    } catch (error) {
      console.error('Claude API error:', error);
      return {
        match: false,
        confidence: 0,
        reasoning: `API error: ${error.message}`,
        error: true,
      };
    }
  }

  /**
   * Batch semantic matching (runs in parallel)
   * @param {Array<{patientTerm: string, criterionTerm: string, context?: string}>} queries
   * @returns {Promise<SemanticMatchResult[]>} Array of results
   */
  async batchSemanticMatch(queries) {
    const results = await Promise.all(
      queries.map(({ patientTerm, criterionTerm, context }) =>
        this.semanticMatch(patientTerm, criterionTerm, context)
      )
    );
    return results;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.#cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return this.#cache.getStats();
  }

  /**
   * Get current model
   * @returns {string} Model name
   */
  getModel() {
    return this.#model;
  }

  /**
   * Set model
   * @param {string} model - Model name
   */
  setModel(model) {
    this.#model = model;
  }
}

export default ClaudeAPIClient;
