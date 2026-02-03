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
    const parseResult = await parser.parseCriterion(criterion, cluster);
    const rawResult = parseResult.criterion;
    
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
    
    // Include usage stats in response
    if (parseResult.usage) {
      result.usage = parseResult.usage;
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
 * Mapping from filename patterns to cluster codes
 */
const FILENAME_TO_CLUSTER = {
  'Treatment_History': 'PTH',
  'Prior_Treatment': 'PTH',
  'Prior_Therapy': 'PTH',
  'Prior_Medication': 'PTH',
  'Medication_History': 'PTH',
  'Comorbid_Conditions': 'CMB',
  'Comorbidities': 'CMB',
  'Risk_Factors': 'CMB',
  'Active_Infection': 'AIC',
  'Autoimmune_Conditions': 'AIC',
  'Autoimmune_Criteria': 'AIC',
  'Severity_Measurements': 'SEV',
  'Severity_Criteria': 'SEV',
  'Severity_Scores': 'SEV',
  'Age_Requirements': 'AGE',
  'Age_Criteria': 'AGE',
  'BMI_Requirements': 'BMI',
  'BMI_Criteria': 'BMI',
  'Laboratory_Values': 'LAB',
  'Lab_Values': 'LAB',
  'Lab_Criteria': 'LAB',
  'Anatomical_Locations': 'ANA',
  'Anatomical_Criteria': 'ANA',
  'Flare_Requirements': 'FLR',
  'Flare_Criteria': 'FLR',
  'Flare_History': 'FLR',
  'Psoriasis_Variants': 'NPV',
  'Non_Plaque_Psoriasis': 'NPV',
  'Biomarker_Criteria': 'BIO',
  'Biomarker': 'BIO',
  'Comorbid_Psoriatic': 'CPD',
  'Psoriatic_Disease': 'CPD'
};

/**
 * Mapping from cluster_name (human-readable) to cluster codes
 */
const CLUSTER_NAME_TO_CODE = {
  'Prior Treatment History': 'PTH',
  'Psoriasis Treatment History and Restrictions': 'PTH',
  'Treatment History': 'PTH',
  'Comorbid Conditions and Risk Factors': 'CMB',
  'Comorbid Conditions': 'CMB',
  'Risk Factors': 'CMB',
  'Comorbidities': 'CMB',
  'Active Infection Criteria': 'AIC',
  'Autoimmune Conditions': 'AIC',
  'Autoimmune Criteria': 'AIC',
  'Severity Measurements': 'SEV',
  'Severity Criteria': 'SEV',
  'Age Requirements': 'AGE',
  'Age Criteria': 'AGE',
  'BMI Requirements': 'BMI',
  'BMI Criteria': 'BMI',
  'Laboratory Values': 'LAB',
  'Lab Values': 'LAB',
  'Anatomical Locations': 'ANA',
  'Flare Requirements': 'FLR',
  'Flare Criteria': 'FLR',
  'Psoriasis Variants': 'NPV',
  'Non-Plaque Psoriasis Variants': 'NPV',
  'Biomarker Criteria': 'BIO',
  'Comorbid Psoriatic Disease': 'CPD'
};

/**
 * Detect cluster type from filename
 * @param {string} filename - Name of the uploaded file
 * @returns {string|null} Cluster code or null if cannot detect
 */
function detectClusterFromFilename(filename) {
  if (!filename) return null;
  
  // Normalize: replace spaces with underscores, case-insensitive
  const normalized = filename.replace(/\s+/g, '_');
  
  // Check each pattern
  for (const [pattern, cluster] of Object.entries(FILENAME_TO_CLUSTER)) {
    if (normalized.toLowerCase().includes(pattern.toLowerCase())) {
      return cluster;
    }
  }
  
  return null;
}

/**
 * Detect cluster type from cluster_name field (human-readable name)
 * @param {string} clusterName - Human-readable cluster name
 * @returns {string|null} Cluster code or null if cannot detect
 */
function detectClusterFromClusterName(clusterName) {
  if (!clusterName || typeof clusterName !== 'string') return null;
  
  // Normalize
  const normalized = clusterName.trim();
  
  // Direct match
  if (CLUSTER_NAME_TO_CODE[normalized]) {
    return CLUSTER_NAME_TO_CODE[normalized];
  }
  
  // Case-insensitive match
  for (const [name, code] of Object.entries(CLUSTER_NAME_TO_CODE)) {
    if (name.toLowerCase() === normalized.toLowerCase()) {
      return code;
    }
  }
  
  // Partial match (contains keywords)
  const lowered = normalized.toLowerCase();
  if (lowered.includes('treatment') && lowered.includes('history')) return 'PTH';
  if (lowered.includes('comorbid') || lowered.includes('risk factor')) return 'CMB';
  if (lowered.includes('infection') || lowered.includes('autoimmune')) return 'AIC';
  if (lowered.includes('severity')) return 'SEV';
  if (lowered.includes('age')) return 'AGE';
  if (lowered.includes('bmi')) return 'BMI';
  if (lowered.includes('lab')) return 'LAB';
  if (lowered.includes('anatomical')) return 'ANA';
  if (lowered.includes('flare')) return 'FLR';
  if (lowered.includes('variant') || lowered.includes('non-plaque')) return 'NPV';
  if (lowered.includes('biomarker')) return 'BIO';
  if (lowered.includes('psoriatic disease')) return 'CPD';
  
  return null;
}

/**
 * Detect cluster type from criterion ID prefix
 * @param {Array<Object>} criteria - Array of criteria with id field
 * @returns {string|null} Cluster code (AGE, BMI, PTH, etc.) or null if cannot detect
 */
function detectClusterFromIds(criteria) {
  if (!criteria || criteria.length === 0) return null;
  
  // Valid cluster prefixes (from UniversalParserV2.getClusterCodes())
  const validClusters = ['AGE', 'BMI', 'SEV', 'AAO', 'NPV', 'BIO', 'CPD', 'CMB', 'AIC', 'FLR', 'PTH'];
  
  // Count occurrences of each cluster prefix
  const clusterCounts = {};
  
  for (const criterion of criteria) {
    const id = criterion.id || criterion.criterion_id || '';
    // Extract prefix (everything before underscore or first 3 chars)
    const match = id.match(/^([A-Z]{2,3})[-_]/i);
    if (match) {
      const prefix = match[1].toUpperCase();
      if (validClusters.includes(prefix)) {
        clusterCounts[prefix] = (clusterCounts[prefix] || 0) + 1;
      }
    }
  }
  
  // Find most common cluster
  let maxCount = 0;
  let detectedCluster = null;
  for (const [cluster, count] of Object.entries(clusterCounts)) {
    if (count > maxCount) {
      maxCount = count;
      detectedCluster = cluster;
    }
  }
  
  return detectedCluster;
}

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
    const rawCriteria = data.members || data.criteria || [];
    
    if (!Array.isArray(rawCriteria) || rawCriteria.length === 0) {
      return res.status(400).json({ error: 'No criteria found in uploaded data' });
    }
    
    // Normalize criteria field names (some exports use 'text' instead of 'raw_text')
    const criteria = rawCriteria.map(c => ({
      ...c,
      id: c.id || c.criterion_id,
      raw_text: c.raw_text || c.text,
      nct_id: c.nct_id || c.nctId
    }));
    
    // Extract cluster type - prefer explicit, fallback to auto-detection
    let clusterType = (data.cluster || '').replace('CLUSTER_', '');
    let detectionMethod = 'explicit';
    
    // Method 1: Try cluster_name field (human-readable name)
    if (!clusterType && data.cluster_name) {
      clusterType = detectClusterFromClusterName(data.cluster_name);
      if (clusterType) {
        detectionMethod = 'cluster_name';
        console.log(`[Parser] Auto-detected cluster type: ${clusterType} from cluster_name: "${data.cluster_name}"`);
      }
    }
    
    // Method 2: Try filename patterns
    if (!clusterType && filename) {
      clusterType = detectClusterFromFilename(filename);
      if (clusterType) {
        detectionMethod = 'filename';
        console.log(`[Parser] Auto-detected cluster type: ${clusterType} from filename: "${filename}"`);
      }
    }
    
    // Method 3: Try ID prefix detection
    if (!clusterType) {
      clusterType = detectClusterFromIds(criteria);
      if (clusterType) {
        detectionMethod = 'id_prefix';
        console.log(`[Parser] Auto-detected cluster type: ${clusterType} from ${criteria.length} criteria IDs`);
      }
    }
    
    // Error if cluster still cannot be determined
    if (!clusterType) {
      return res.status(400).json({ 
        error: 'Cannot determine cluster type. Provide one of: "cluster" field, "cluster_name" field, standard filename (e.g., "Treatment_History"), or standard ID prefixes (e.g., PTH_001, CMB_001, AIC_001)'
      });
    }
    
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
      actualCost: 0,
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
    
    let job = activeJobs.get(jobId);
    
    // If not in memory, try to reload from database
    if (!job) {
      const db = getDatabase();
      if (db) {
        const dbJob = await db.getAsync('SELECT * FROM parser_jobs WHERE id = ?', [jobId]);
        if (dbJob && dbJob.inputData) {
          job = {
            criteria: JSON.parse(dbJob.inputData),
            clusterType: dbJob.clusterType || '',
            status: 'pending',
            parsedCount: dbJob.parsedCount || 0,
            skippedCount: dbJob.skippedCount || 0,
            actualCost: dbJob.actualCost || 0,
            model: dbJob.modelId,
            shouldPause: false
          };
          activeJobs.set(jobId, job);
          console.log(`[Parser] Restored job ${jobId} from database`);
        } else {
          return res.status(404).json({ error: 'Job not found in database' });
        }
      } else {
        return res.status(404).json({ error: 'Job not found' });
      }
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
      const effectiveTotal = job.maxCount || job.criteria.length;
      const errors = job.errors || [];
      return res.json({
        status: job.status,
        total: effectiveTotal,
        fullTotal: job.criteria.length,
        parsed: job.parsedCount,
        skipped: job.skippedCount,
        clusterType: job.clusterType,
        currentCriterion: job.currentCriterion,
        actualCost: job.actualCost || 0,
        failedCount: errors.length,
        errors: errors.slice(-5)  // Return last 5 errors only
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
    
    // Select only needed fields (exclude inputData which can be huge)
    const jobs = await db.allAsync(
      `SELECT id, createdAt, status, clusterType, modelId, totalCriteria, 
              parsedCount, skippedCount, inputFile, parserVersion, actualCost
       FROM parser_jobs ORDER BY createdAt DESC LIMIT 50`
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
  if (!job) {
    console.log(`[Parser] Job ${jobId} not found`);
    return;
  }
  
  console.log(`[Parser] Starting job ${jobId}, maxCount=${job.maxCount}, criteria=${job.criteria.length}`);
  
  // Initialize errors array if not exists
  if (!job.errors) {
    job.errors = [];
  }
  
  const db = getDatabase();
  const parser = getParser();
  const claudeClient = getClaudeClient();
  await claudeClient.initFromDatabase();
  
  if (!claudeClient.isConfigured()) {
    console.log(`[Parser] Claude API not configured`);
    job.status = 'failed';
    job.error = 'API key not configured';
    return;
  }
  
  const startIndex = job.parsedCount || 0;
  const maxIndex = Math.min(startIndex + (job.maxCount || job.criteria.length), job.criteria.length);
  
  console.log(`[Parser] Will parse from index ${startIndex} to ${maxIndex}`);
  
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
        console.log(`[Parser] Skipping ${criterion.id} - already parsed`);
        job.skippedCount++;
        continue;
      }
    }
    
    try {
      console.log(`[Parser] Parsing criterion ${i + 1}/${maxIndex}: ${criterion.id}`);
      // Parse the criterion - returns { criterion, usage }
      const parseResult = await parser.parseCriterion(criterion, job.clusterType);
      const parsedCriterion = parseResult.criterion;
      const usage = parseResult.usage;
      
      const validation = validateCriterion(parsedCriterion, job.clusterType);
      console.log(`[Parser] Parsed ${criterion.id}, valid=${validation.errors.length === 0}`);
      
      // Calculate actual cost from token usage
      const costUsd = usage ? calculateActualCost(usage, job.model) : 0;
      const inputTokens = usage?.input_tokens || 0;
      const outputTokens = usage?.output_tokens || 0;
      const cacheReadTokens = usage?.cache_read_input_tokens || 0;
      const cacheWriteTokens = usage?.cache_creation_input_tokens || 0;
      
      console.log(`[Parser] Cost: $${costUsd.toFixed(4)} (in:${inputTokens}, out:${outputTokens}, cache_r:${cacheReadTokens}, cache_w:${cacheWriteTokens})`);
      
      // Store result
      if (db) {
        try {
          // Ensure required fields are not empty strings
          const clusterType = job.clusterType && job.clusterType.trim() !== '' ? job.clusterType : 'UNKNOWN';
          const rawInput = criterion.raw_text && criterion.raw_text.trim() !== '' ? criterion.raw_text : 'N/A';
          const nctId = criterion.nct_id || 'N/A';
          
          await db.runAsync(`
            INSERT OR REPLACE INTO parsed_criteria 
            (criterionId, nctId, clusterType, parsedAt, parserVersion, modelUsed, rawInput, parsedOutput, validationStatus, validationErrors, jobId, costUsd, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            criterion.id,
            nctId,
            clusterType,
            new Date().toISOString(),
            PARSER_VERSION,
            job.model,
            rawInput,
            JSON.stringify(validation.criterion),
            validation.errors.length > 0 ? 'errors' : (validation.warnings.length > 0 ? 'warnings' : 'valid'),
            JSON.stringify(validation.errors),
            jobId,
            costUsd,
            inputTokens,
            outputTokens,
            cacheReadTokens,
            cacheWriteTokens
          ]);
        } catch (dbError) {
          console.error(`[Parser] DB INSERT error for ${criterion.id}:`, dbError.message);
        }
        
        // Track usage
        try {
          await db.runAsync(`
            INSERT INTO api_usage 
            (timestamp, modelId, inputTokens, outputTokens, costUsd, jobId)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            new Date().toISOString(),
            job.model,
            inputTokens,
            outputTokens,
            costUsd,
            jobId
          ]);
        } catch (dbError) {
          console.error(`[Parser] DB api_usage INSERT error:`, dbError.message);
        }
      }
      
      job.parsedCount++;
      job.actualCost = (job.actualCost || 0) + costUsd;
      
      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error parsing ${criterion.id}:`, error);
      
      // Store error details for user visibility
      const errorMessage = error.message || String(error);
      job.errors = job.errors || [];
      job.errors.push({
        criterionId: criterion.id,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
      
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
