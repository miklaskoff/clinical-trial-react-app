/**
 * @file Match route
 * @description API endpoint for semantic matching via Claude
 */

import { Router } from 'express';
import { getClaudeClient } from '../services/ClaudeClient.js';

const router = Router();

/**
 * POST /api/match
 * Semantic match between patient term and criterion
 */
router.post('/', async (req, res, next) => {
  try {
    const { patientTerm, criterionTerm, context } = req.body;

    // Validation
    if (!patientTerm) {
      return res.status(400).json({
        error: 'Missing required field: patientTerm'
      });
    }

    if (!criterionTerm) {
      return res.status(400).json({
        error: 'Missing required field: criterionTerm'
      });
    }

    const client = getClaudeClient();
    const result = await client.semanticMatch(patientTerm, criterionTerm, context);

    res.json(result);

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/match/batch
 * Batch semantic matching for multiple queries
 */
router.post('/batch', async (req, res, next) => {
  try {
    const { queries } = req.body;

    // Validation
    if (!queries || !Array.isArray(queries)) {
      return res.status(400).json({
        error: 'Missing required field: queries (array)'
      });
    }

    if (queries.length === 0) {
      return res.status(400).json({
        error: 'Queries array cannot be empty'
      });
    }

    if (queries.length > 50) {
      return res.status(400).json({
        error: 'Maximum 50 queries per batch request'
      });
    }

    // Validate each query
    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      if (!q.patientTerm || !q.criterionTerm) {
        return res.status(400).json({
          error: `Query at index ${i} missing patientTerm or criterionTerm`
        });
      }
    }

    const client = getClaudeClient();
    const results = await client.batchSemanticMatch(queries);

    res.json({ results });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/match/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', (req, res) => {
  const client = getClaudeClient();
  res.json(client.getCacheStats());
});

/**
 * DELETE /api/match/cache
 * Clear the matching cache
 */
router.delete('/cache', (req, res) => {
  const client = getClaudeClient();
  client.clearCache();
  res.json({ message: 'Cache cleared' });
});

export default router;
