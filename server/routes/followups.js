/**
 * @file Follow-ups route
 * @description API endpoints for AI-driven follow-up question generation
 */

import { Router } from 'express';
import { 
  generateFollowUpQuestions, 
  generateConditionFollowUpQuestions,
  getCacheStats, 
  clearCache 
} from '../services/FollowUpGenerator.js';

const router = Router();

/**
 * POST /api/followups/generate
 * Generate follow-up questions for a drug OR condition
 * @body {string} drugName - The drug/condition name
 * @body {string} [type='treatment'] - Either 'treatment' or 'condition'
 */
router.post('/generate', async (req, res, next) => {
  try {
    const { drugName, type = 'treatment' } = req.body;

    // Validation
    if (!drugName) {
      return res.status(400).json({
        error: 'Missing required field: drugName'
      });
    }

    if (typeof drugName !== 'string' || drugName.trim().length === 0) {
      return res.status(400).json({
        error: 'drugName must be a non-empty string'
      });
    }

    let result;
    
    if (type === 'condition') {
      // Use condition-specific generator
      result = await generateConditionFollowUpQuestions(drugName.trim());
    } else {
      // Use treatment/drug generator
      result = await generateFollowUpQuestions(drugName.trim());
    }

    res.json(result);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/followups/cache
 * Get cache statistics
 */
router.get('/cache', (req, res) => {
  const stats = getCacheStats();
  res.json(stats);
});

/**
 * DELETE /api/followups/cache
 * Clear the follow-up cache
 */
router.delete('/cache', async (req, res, next) => {
  try {
    await clearCache();
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
