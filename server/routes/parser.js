/**
 * @file parser.js
 * @description API routes for 100% LLM criteria parsing + Parser Testing UI
 * 
 * Routes:
 * - GET /api/parser/status - Check if parser is ready
 * - GET /api/parser/clusters - List available clusters with fields
 * - POST /api/parser/criterion - Parse single criterion
 * - POST /api/parser/batch - Parse multiple criteria
 * 
 * Parser Testing UI routes:
 * - GET /api/parser/version - Get parser version
 * - POST /api/parser/upload - Upload JSON for parsing
 * - POST /api/parser/job/start - Start parsing job
 * - POST /api/parser/job/pause - Pause parsing job
 * - POST /api/parser/job/resume - Resume paused job
 * - GET /api/parser/job/:jobId/status - Get job status
 * - GET /api/parser/job/:jobId/results - Get parsed results
 * - GET /api/parser/history - Get job history
 * - GET /api/parser/balance - Get API usage/balance
 * - POST /api/parser/estimate - Get cost estimate
 * - DELETE /api/parser/cache/:criterionId - Clear cached parse
 */

import { Router } from 'express';
import { UniversalParserV2 } from '../config/universal-parser-v2.js';
import { getClaudeClient } from '../services/ClaudeClient.js';
import { validateCriterion } from '../config/output-validator.js';
import { getDatabase } from '../db.js';
import { PARSER_VERSION, calculateCostEstimate, calculateActualCost } from '../config/parser-version.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Lazy-initialized parser instance
let parserInstance = null;

// In-memory job state for active parsing jobs
const activeJobs = new Map();

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

// =============================================================================
// Parser Testing UI Routes
// =============================================================================

/**
 * GET /api/parser/version
 * Returns current parser version
 */
router.get('/version', (req, res) => {
  res.json({
    parserVersion: PARSER_VERSION,
    fieldCatalogVersion: PARSER_VERSION
  });
});

/**
 * POST /api/parser/upload
 * Upload JSON cluster file for parsing
 */
router.post('/upload', async (req, res) => {
  try {
    const { data, filename } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Missing data' });
    }
    
    // Extract criteria from data (supports both 'members' and 'criteria' arrays)
    const criteria = data.members || data.criteria || [];
    
    if (!Array.isArray(criteria) || criteria.length === 0) {
      return res.status(400).json({ error: 'No criteria found in uploaded data' });
    }
    
    // Extract cluster type
    const clusterType = (data.cluster || '').replace('CLUSTER_', '');
    
    // Check which criteria are already parsed
    const db = getDatabase();
    const criteriaIds = criteria.map(c => c.id);
    
    let alreadyParsed = 0;
    let alreadyParsedInfo = [];
    
    if (db) {
      // Query for each ID to check if already parsed
      for (const id of criteriaIds) {
        const existing = await db.getAsync(
          'SELECT criterionId, parserVersion FROM parsed_criteria WHERE criterionId = ?',
          [id]
        );
        if (existing) {
          alreadyParsed++;
          alreadyParsedInfo.push({
            id: existing.criterionId,
            version: existing.parserVersion
          });
        }
      }
    }
    
    // Create job
    const jobId = uuidv4();
    const now = new Date().toISOString();
    
    if (db) {
      await db.runAsync(`
        INSERT INTO parser_jobs 
        (id, createdAt, status, clusterType, modelId, totalCriteria, parsedCount, skippedCount, inputFile, parserVersion, inputData)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        jobId,
        now,
        'pending',
        clusterType,
        'claude-sonnet-4-5-20250929',  // Default model
        criteria.length,
        0,
        0,
        filename || 'uploaded.json',
        PARSER_VERSION,
        JSON.stringify(criteria)
      ]);
    }
    
    // Store in memory for active parsing
    activeJobs.set(jobId, {
      criteria,
      clusterType,
      status: 'pending',
      parsedCount: 0,
      skippedCount: 0,
      shouldPause: false
    });
    
    res.json({
      success: true,
      jobId,
      criteriaCount: criteria.length,
      alreadyParsed,
      alreadyParsedInfo,
      needsParsing: criteria.length - alreadyParsed,
      clusterType
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/parser/job/start
 * Start or resume a parsing job
 */
router.post('/job/start', async (req, res) => {
  try {
    const { jobId, model, count, parseLimit, forceReparse } = req.body;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Missing jobId' });
    }
    
    const job = activeJobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Check budget limit
    const db = getDatabase();
    if (db) {
      const budgetConfig = await db.getAsync(
        'SELECT value FROM config WHERE key = ?',
        ['parser_budget_limit']
      );
      const budgetLimit = parseFloat(budgetConfig?.value || '100.00');
      
      const usageResult = await db.getAsync('SELECT COALESCE(SUM(costUsd), 0) as total FROM api_usage');
      const usedAmount = usageResult?.total || 0;
      
      if (usedAmount >= budgetLimit) {
        return res.status(403).json({
          error: 'Budget limit exceeded. Configure higher limit in settings.',
          usedAmount,
          budgetLimit
        });
      }
    }
    
    // Update job status (parseLimit takes precedence over count)
    job.status = 'running';
    job.model = model || 'claude-sonnet-4-5-20250929';
    job.forceReparse = forceReparse || false;
    job.maxCount = parseLimit || count || job.criteria.length;
    job.shouldPause = false;
    
    // Update database
    if (db) {
      await db.runAsync(
        'UPDATE parser_jobs SET status = ?, modelId = ? WHERE id = ?',
        ['running', job.model, jobId]
      );
    }
    
    // Start parsing in background (don't await)
    parseJobInBackground(jobId).catch(err => {
      console.error('Background parsing error:', err);
    });
    
    res.json({
      status: job.status,
      jobId,
      message: 'Parsing started'
    });
  } catch (error) {
    console.error('Start job error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/parser/job/pause
 * Pause a running job
 */
router.post('/job/pause', async (req, res) => {
  try {
    const { jobId } = req.body;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Missing jobId' });
    }
    
    const job = activeJobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    job.shouldPause = true;
    job.status = 'paused';
    
    const db = getDatabase();
    if (db) {
      await db.runAsync(
        'UPDATE parser_jobs SET status = ? WHERE id = ?',
        ['paused', jobId]
      );
    }
    
    res.json({ status: 'paused', jobId });
  } catch (error) {
    console.error('Pause job error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/parser/job/resume
 * Resume a paused job
 */
router.post('/job/resume', async (req, res) => {
  try {
    const { jobId } = req.body;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Missing jobId' });
    }
    
    const job = activeJobs.get(jobId);
    if (!job) {
      // Try to reload from database
      const db = getDatabase();
      if (db) {
        const dbJob = await db.getAsync('SELECT * FROM parser_jobs WHERE id = ?', [jobId]);
        if (dbJob && dbJob.inputData) {
          activeJobs.set(jobId, {
            criteria: JSON.parse(dbJob.inputData),
            clusterType: dbJob.clusterType,
            status: 'running',
            parsedCount: dbJob.parsedCount,
            skippedCount: dbJob.skippedCount,
            model: dbJob.modelId,
            shouldPause: false
          });
        } else {
          return res.status(404).json({ error: 'Job not found' });
        }
      } else {
        return res.status(404).json({ error: 'Job not found' });
      }
    }
    
    const resumedJob = activeJobs.get(jobId);
    resumedJob.shouldPause = false;
    resumedJob.status = 'running';
    
    const db = getDatabase();
    if (db) {
      await db.runAsync(
        'UPDATE parser_jobs SET status = ? WHERE id = ?',
        ['running', jobId]
      );
    }
    
    // Resume parsing in background
    parseJobInBackground(jobId).catch(err => {
      console.error('Background parsing error:', err);
    });
    
    res.json({ status: 'running', jobId });
  } catch (error) {
    console.error('Resume job error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/parser/job/:jobId/status
 * Get status of a parsing job
 */
router.get('/job/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Check in-memory first
    const job = activeJobs.get(jobId);
    if (job) {
      return res.json({
        status: job.status,
        total: job.criteria.length,
        parsed: job.parsedCount,
        skipped: job.skippedCount,
        clusterType: job.clusterType,
        currentCriterion: job.currentCriterion
      });
    }
    
    // Check database
    const db = getDatabase();
    if (db) {
      const dbJob = await db.getAsync('SELECT * FROM parser_jobs WHERE id = ?', [jobId]);
      if (dbJob) {
        return res.json({
          status: dbJob.status,
          total: dbJob.totalCriteria,
          parsed: dbJob.parsedCount,
          skipped: dbJob.skippedCount,
          clusterType: dbJob.clusterType,
          actualCost: dbJob.actualCost
        });
      }
    }
    
    res.status(404).json({ error: 'Job not found' });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/parser/job/:jobId/results
 * Get parsed results for a job
 */
router.get('/job/:jobId/results', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const db = getDatabase();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const results = await db.allAsync(
      'SELECT * FROM parsed_criteria WHERE jobId = ?',
      [jobId]
    );
    
    // Parse the JSON fields
    const formattedResults = results.map(r => ({
      criterionId: r.criterionId,
      nctId: r.nctId,
      clusterType: r.clusterType,
      parserVersion: r.parserVersion,
      validationStatus: r.validationStatus,
      parsedOutput: JSON.parse(r.parsedOutput || '{}'),
      costUsd: r.costUsd,
      parsedAt: r.parsedAt
    }));
    
    res.json({ results: formattedResults });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/parser/history
 * Get list of past parsing jobs
 */
router.get('/history', async (req, res) => {
  try {
    const db = getDatabase();
    if (!db) {
      return res.json({ jobs: [] });
    }
    
    const jobs = await db.allAsync(
      'SELECT * FROM parser_jobs ORDER BY createdAt DESC LIMIT 50'
    );
    
    res.json({ jobs });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/parser/balance
 * Get API usage and remaining balance
 */
router.get('/balance', async (req, res) => {
  try {
    const db = getDatabase();
    
    let usedAmount = 0;
    let budgetLimit = 100.00;  // Default $100
    
    if (db) {
      // Get total usage
      const usageResult = await db.getAsync(
        'SELECT COALESCE(SUM(costUsd), 0) as total FROM api_usage'
      );
      usedAmount = usageResult?.total || 0;
      
      // Get budget limit from config
      const budgetConfig = await db.getAsync(
        'SELECT value FROM config WHERE key = ?',
        ['parser_budget_limit']
      );
      if (budgetConfig?.value) {
        budgetLimit = parseFloat(budgetConfig.value);
      }
    }
    
    res.json({
      usedAmount: Math.round(usedAmount * 100) / 100,
      budgetLimit,
      remaining: Math.round((budgetLimit - usedAmount) * 100) / 100
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/parser/estimate
 * Get cost/time estimate for parsing
 */
router.post('/estimate', (req, res) => {
  try {
    const { criteriaCount, model, useCache = true } = req.body;
    
    if (!criteriaCount || criteriaCount < 1) {
      return res.status(400).json({ error: 'Invalid criteriaCount' });
    }
    
    const estimate = calculateCostEstimate(
      criteriaCount,
      model || 'claude-sonnet-4-5-20250929',
      useCache
    );
    
    res.json(estimate);
  } catch (error) {
    console.error('Estimate error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/parser/cache/:criterionId
 * Clear cached parse for a specific criterion
 */
router.delete('/cache/:criterionId', async (req, res) => {
  try {
    const { criterionId } = req.params;
    
    const db = getDatabase();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    await db.runAsync(
      'DELETE FROM parsed_criteria WHERE criterionId = ?',
      [criterionId]
    );
    
    res.json({ deleted: true, criterionId });
  } catch (error) {
    console.error('Delete cache error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// Background Parsing Function
// =============================================================================

/**
 * Parse job criteria in background
 * @param {string} jobId 
 */
async function parseJobInBackground(jobId) {
  const job = activeJobs.get(jobId);
  if (!job) return;
  
  const db = getDatabase();
  const parser = getParser();
  const claudeClient = getClaudeClient();
  await claudeClient.initFromDatabase();
  
  const startIndex = job.parsedCount || 0;
  const maxIndex = Math.min(startIndex + (job.maxCount || job.criteria.length), job.criteria.length);
  
  for (let i = startIndex; i < maxIndex; i++) {
    // Check if should pause
    if (job.shouldPause) {
      job.status = 'paused';
      if (db) {
        await db.runAsync(
          'UPDATE parser_jobs SET status = ?, parsedCount = ?, skippedCount = ? WHERE id = ?',
          ['paused', job.parsedCount, job.skippedCount, jobId]
        );
      }
      return;
    }
    
    const criterion = job.criteria[i];
    job.currentCriterion = criterion.id;
    
    // Check if already parsed (unless forceReparse)
    if (!job.forceReparse && db) {
      const existing = await db.getAsync(
        'SELECT criterionId, parserVersion FROM parsed_criteria WHERE criterionId = ?',
        [criterion.id]
      );
      
      if (existing && existing.parserVersion === PARSER_VERSION) {
        job.skippedCount++;
        continue;
      }
    }
    
    try {
      // Parse the criterion
      const rawResult = await parser.parseCriterion(criterion, job.clusterType);
      const validation = validateCriterion(rawResult, job.clusterType);
      
      // Calculate cost (mock for now - would come from actual API response)
      const costUsd = 0.008;  // Approximate cost per criterion
      
      // Store result
      if (db) {
        await db.runAsync(`
          INSERT OR REPLACE INTO parsed_criteria 
          (criterionId, nctId, clusterType, parsedAt, parserVersion, modelUsed, rawInput, parsedOutput, validationStatus, validationErrors, jobId, costUsd)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          criterion.id,
          criterion.nct_id || '',
          job.clusterType,
          new Date().toISOString(),
          PARSER_VERSION,
          job.model,
          criterion.raw_text,
          JSON.stringify(validation.criterion),
          validation.errors.length > 0 ? 'errors' : (validation.warnings.length > 0 ? 'warnings' : 'valid'),
          JSON.stringify(validation.errors),
          jobId,
          costUsd
        ]);
        
        // Track usage
        await db.runAsync(`
          INSERT INTO api_usage 
          (timestamp, modelId, inputTokens, outputTokens, costUsd, jobId)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          new Date().toISOString(),
          job.model,
          500,  // Approximate
          800,  // Approximate
          costUsd,
          jobId
        ]);
      }
      
      job.parsedCount++;
      
      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error parsing ${criterion.id}:`, error);
      job.parsedCount++;  // Still count it as processed
    }
  }
  
  // Job completed
  job.status = 'completed';
  job.currentCriterion = null;
  
  if (db) {
    // Calculate total cost
    const costResult = await db.getAsync(
      'SELECT COALESCE(SUM(costUsd), 0) as total FROM parsed_criteria WHERE jobId = ?',
      [jobId]
    );
    
    await db.runAsync(
      'UPDATE parser_jobs SET status = ?, parsedCount = ?, skippedCount = ?, actualCost = ? WHERE id = ?',
      ['completed', job.parsedCount, job.skippedCount, costResult?.total || 0, jobId]
    );
  }
}

export default router;
