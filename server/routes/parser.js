/**
 * @file parser.js
 * @description API routes for 100% LLM criteria parsing
 * 
 * Routes:
 * - GET /api/parser/status - Check if parser is ready
 * - GET /api/parser/clusters - List available clusters with fields
 * - POST /api/parser/criterion - Parse single criterion
 * - POST /api/parser/batch - Parse multiple criteria
 */

import { Router } from 'express';
import { UniversalParserV2 } from '../config/universal-parser-v2.js';
import { getClaudeClient } from '../services/ClaudeClient.js';
import { validateCriterion } from '../config/output-validator.js';

const router = Router();

// Lazy-initialized parser instance
let parserInstance = null;

/**
 * Get or create parser instance
 * @returns {UniversalParserV2}
 */
function getParser() {
  if (!parserInstance) {
    const claudeClient = getClaudeClient();
    parserInstance = new UniversalParserV2(claudeClient);
  }
  return parserInstance;
}

/**
 * GET /api/parser/status
 * Check if parser is ready (ClaudeClient configured, catalog loaded)
 */
router.get('/status', async (req, res) => {
  try {
    const claudeClient = getClaudeClient();
    await claudeClient.initFromDatabase();
    
    const clusters = UniversalParserV2.getClusterCodes();
    
    res.json({
      available: claudeClient.isConfigured(),
      clusters: clusters,
      catalogLoaded: true,
      apiKeySource: claudeClient.getApiKeySource()
    });
  } catch (error) {
    res.status(500).json({
      available: false,
      error: error.message,
      catalogLoaded: false
    });
  }
});

/**
 * GET /api/parser/clusters
 * List all clusters with their primary fields
 */
router.get('/clusters', (req, res) => {
  const clusterCodes = UniversalParserV2.getClusterCodes();
  const clusters = {};
  
  for (const code of clusterCodes) {
    clusters[code] = UniversalParserV2.getPrimaryFields(code);
  }
  
  res.json({
    clusters,
    allFields: UniversalParserV2.getAllFields()
  });
});

/**
 * POST /api/parser/criterion
 * Parse a single criterion
 * 
 * Body:
 * - criterion: { id, nct_id?, raw_text, original?: { criterion_type?, ... } }
 * - cluster: string (AGE, BMI, SEV, etc.)
 */
router.post('/criterion', async (req, res) => {
  try {
    const { criterion, cluster } = req.body;
    
    // Validation
    if (!criterion || !criterion.raw_text) {
      return res.status(400).json({
        error: 'Missing criterion or raw_text'
      });
    }
    
    if (!cluster) {
      return res.status(400).json({
        error: 'Missing cluster code'
      });
    }
    
    const validClusters = UniversalParserV2.getClusterCodes();
    if (!validClusters.includes(cluster)) {
      return res.status(400).json({
        error: `Invalid cluster: ${cluster}. Valid clusters: ${validClusters.join(', ')}`
      });
    }
    
    // Ensure Claude client is initialized
    const claudeClient = getClaudeClient();
    await claudeClient.initFromDatabase();
    
    if (!claudeClient.isConfigured()) {
      return res.status(503).json({
        error: 'AI not configured. Set API key via admin panel.'
      });
    }
    
    // Parse criterion - pass original data if provided
    const parser = getParser();
    const rawResult = await parser.parseCriterion(criterion, cluster);
    
    // Attach original data to result for validator to use
    if (criterion.original) {
      rawResult.original = criterion.original;
    }
    
    // Validate and ensure all fields are present (consistency)
    const validation = validateCriterion(rawResult, cluster);
    
    // Add validation metadata
    const result = validation.criterion;
    if (validation.warnings.length > 0) {
      result.validation_warnings = validation.warnings;
    }
    if (validation.errors.length > 0) {
      result.validation_errors = validation.errors;
      result.parsing_status = 'pending_admin_review';
    }
    
    res.json(result);
  } catch (error) {
    console.error('Parser error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /api/parser/batch
 * Parse multiple criteria
 * 
 * Body:
 * - criteria: Array<{ id, nct_id?, raw_text }>
 * - cluster: string
 * - options?: { concurrency?: number }
 */
router.post('/batch', async (req, res) => {
  try {
    const { criteria, cluster, options = {} } = req.body;
    
    // Validation
    if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
      return res.status(400).json({
        error: 'Missing or empty criteria array'
      });
    }
    
    if (!cluster) {
      return res.status(400).json({
        error: 'Missing cluster code'
      });
    }
    
    const validClusters = UniversalParserV2.getClusterCodes();
    if (!validClusters.includes(cluster)) {
      return res.status(400).json({
        error: `Invalid cluster: ${cluster}. Valid clusters: ${validClusters.join(', ')}`
      });
    }
    
    // Ensure Claude client is initialized
    const claudeClient = getClaudeClient();
    await claudeClient.initFromDatabase();
    
    if (!claudeClient.isConfigured()) {
      return res.status(503).json({
        error: 'AI not configured. Set API key via admin panel.'
      });
    }
    
    // Parse batch
    const parser = getParser();
    const results = await parser.parseBatch(criteria, cluster, options);
    
    // Calculate stats
    const stats = {
      total: results.length,
      complete: results.filter(r => r.parsing_status === 'complete').length,
      pending_review: results.filter(r => r.parsing_status === 'pending_admin_review').length,
      errors: results.filter(r => r.parsing_status === 'error').length,
      unfamiliar_terms: results.filter(r => r.unfamiliar_term_flag).length
    };
    
    res.json({
      results,
      stats
    });
  } catch (error) {
    console.error('Batch parser error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
