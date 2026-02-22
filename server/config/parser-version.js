/**
 * @file parser-version.js
 * @description Parser version tracking (matches FIELD_CATALOG version)
 */

// Parser version matches FIELD_CATALOG version
// Increment when parser logic or FIELD_CATALOG changes
export const PARSER_VERSION = '2.2.0';

// Pricing per 1M tokens (Anthropic 2026 pricing)
export const MODEL_PRICING = {
  'claude-opus-4-20250514': {
    input: 15.00,
    output: 75.00,
    cacheRead: 1.50,    // 90% discount
    cacheWrite: 18.75   // 25% premium
  },
  'claude-sonnet-4-5-20250929': {
    input: 3.00,
    output: 15.00,
    cacheRead: 0.30,
    cacheWrite: 3.75
  },
  'claude-3-5-haiku-20241022': {
    input: 0.80,
    output: 4.00,
    cacheRead: 0.08,
    cacheWrite: 1.00
  }
};

// Average tokens per criterion (for estimation)
export const AVERAGE_TOKENS = {
  systemPrompt: 18750,  // FIELD_CATALOG ~75KB
  inputPerCriterion: 500,
  outputPerCriterion: 800
};

/**
 * Calculate cost estimate for parsing
 * @param {number} criteriaCount - Number of criteria to parse
 * @param {string} model - Model ID
 * @param {boolean} useCache - Whether prompt caching is enabled
 * @returns {{ estimatedCost: number, estimatedTime: number, cacheSavings: number }}
 */
export function calculateCostEstimate(criteriaCount, model, useCache = true) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-sonnet-4-5-20250929'];
  
  // Total tokens
  const totalInputTokens = criteriaCount * AVERAGE_TOKENS.inputPerCriterion;
  const totalOutputTokens = criteriaCount * AVERAGE_TOKENS.outputPerCriterion;
  const systemTokens = AVERAGE_TOKENS.systemPrompt;
  
  let inputCost, systemCost;
  
  if (useCache && criteriaCount > 1) {
    // First call: cache write (25% premium)
    // Subsequent calls: cache read (90% discount)
    const cacheWriteCost = (systemTokens / 1_000_000) * pricing.cacheWrite;
    const cacheReadCost = ((criteriaCount - 1) * systemTokens / 1_000_000) * pricing.cacheRead;
    systemCost = cacheWriteCost + cacheReadCost;
    
    // Regular input tokens (not cached)
    inputCost = (totalInputTokens / 1_000_000) * pricing.input;
  } else {
    // No caching - full price for system prompt each time
    systemCost = (criteriaCount * systemTokens / 1_000_000) * pricing.input;
    inputCost = (totalInputTokens / 1_000_000) * pricing.input;
  }
  
  const outputCost = (totalOutputTokens / 1_000_000) * pricing.output;
  const estimatedCost = inputCost + systemCost + outputCost;
  
  // Cost without caching (for comparison)
  const noCacheCost = (
    (criteriaCount * systemTokens / 1_000_000) * pricing.input +
    (totalInputTokens / 1_000_000) * pricing.input +
    (totalOutputTokens / 1_000_000) * pricing.output
  );
  
  const cacheSavings = useCache ? Math.round((1 - estimatedCost / noCacheCost) * 100) : 0;
  
  // Time estimate: ~4 seconds per criterion (API latency + rate limiting)
  const estimatedTime = criteriaCount * 4;
  
  return {
    estimatedCost: Math.round(estimatedCost * 1000) / 1000,  // Round to 3 decimal places
    estimatedTime,
    cacheSavings
  };
}

/**
 * Calculate actual cost from usage stats
 * @param {Object} usage - Token usage from API response
 * @param {string} model - Model ID
 * @returns {number} Cost in USD
 */
export function calculateActualCost(usage, model) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-sonnet-4-5-20250929'];
  
  const inputCost = ((usage.input_tokens || 0) / 1_000_000) * pricing.input;
  const outputCost = ((usage.output_tokens || 0) / 1_000_000) * pricing.output;
  const cacheReadCost = ((usage.cache_read_input_tokens || 0) / 1_000_000) * pricing.cacheRead;
  const cacheWriteCost = ((usage.cache_creation_input_tokens || 0) / 1_000_000) * pricing.cacheWrite;
  
  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}
