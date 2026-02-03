/**
 * Universal Parser v2 - 100% LLM Approach
 * ----------------------------------------
 * Based on FIELD_CATALOG_v2.1.md master specification
 * 
 * Architecture:
 * - Send ENTIRE FIELD_CATALOG to Claude as system context
 * - NO local regex/pattern matching - Claude does 100% of parsing
 * - Claude follows "LLM Thought Process" sections from catalog
 * - Output includes: raw_text, _thought_process, all parsed fields
 * 
 * 3-Stage Unfamiliar Term Detection (done by LLM):
 * 1. Exact match in reference lists → confidence 1.0
 * 2. Base term match (psoriasis, cancer, etc.) → confidence 0.85
 * 3. LLM judgment → if confidence < 0.7, set unfamiliar_term_flag: true
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateCriterion } from './output-validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths to configuration files
const CATALOG_PATH = path.join(__dirname, 'FIELD_CATALOG_v2.1.md');
const REFERENCE_LISTS_PATH = path.join(__dirname, 'reference-lists.json');

/**
 * All 18 fields from FIELD_CATALOG_v2.1.md
 */
const ALL_FIELDS = {
  age: ['AGE_MIN', 'AGE_MAX', 'AGE_UNIT'],
  measurements: ['MEASUREMENTS', 'SEVERITY'],
  conditions: ['CONDITION_TYPE', 'CONDITION_PATTERN', 'PSORIASIS_VARIANT', 'EXCEPTION_CONDITION'],
  anatomical: ['ANATOMICAL_LOCATION'],
  temporal: ['TIMEFRAME'],
  logical: ['LOGICAL_OPERATOR'],
  metadata: ['NESTED_CONDITION', 'NEGATION_DETECTED', 'AMBIGUITY_FLAG', 'REQUIRES_CLINICAL_JUDGMENT', 'unfamiliar_term_flag', 'confidence']
};

/**
 * Cluster to primary fields mapping (for focused extraction)
 */
const CLUSTER_PRIMARY_FIELDS = {
  AGE: ['AGE_MIN', 'AGE_MAX', 'AGE_UNIT'],
  BMI: ['MEASUREMENTS'],
  SEV: ['MEASUREMENTS', 'SEVERITY', 'ANATOMICAL_LOCATION', 'NESTED_CONDITION'],
  AAO: ['ANATOMICAL_LOCATION', 'MEASUREMENTS'],
  NPV: ['PSORIASIS_VARIANT', 'CONDITION_TYPE', 'NEGATION_DETECTED'],
  BIO: ['MEASUREMENTS', 'CONDITION_TYPE', 'CONDITION_PATTERN', 'LOGICAL_OPERATOR'],
  CPD: ['CONDITION_TYPE', 'TIMEFRAME', 'LOGICAL_OPERATOR'],
  CMB: ['CONDITION_TYPE', 'CONDITION_PATTERN', 'SEVERITY', 'EXCEPTION_CONDITION', 'NEGATION_DETECTED', 'NESTED_CONDITION', 'LOGICAL_OPERATOR'],
  AIC: ['CONDITION_TYPE', 'TIMEFRAME', 'NEGATION_DETECTED', 'LOGICAL_OPERATOR'],
  FLR: ['CONDITION_TYPE', 'TIMEFRAME', 'LOGICAL_OPERATOR'],
  PTH: ['CONDITION_TYPE', 'CONDITION_PATTERN', 'TIMEFRAME', 'EXCEPTION_CONDITION', 'LOGICAL_OPERATOR']
};

export class UniversalParserV2 {
  #claudeClient;
  #fieldCatalog;
  #referenceLists;
  #catalogLoaded;

  /**
   * @param {Object} claudeClient - Instance of ClaudeClient from server/services/ClaudeClient.js
   */
  constructor(claudeClient) {
    this.#claudeClient = claudeClient;
    this.#fieldCatalog = null;
    this.#referenceLists = null;
    this.#catalogLoaded = false;
  }

  /**
   * Lazy load the FIELD_CATALOG_v2.1.md (entire file)
   * This is sent to Claude as system context - NO local parsing
   */
  #loadFieldCatalog() {
    if (this.#catalogLoaded) return;
    
    if (!fs.existsSync(CATALOG_PATH)) {
      throw new Error(`FIELD_CATALOG not found at ${CATALOG_PATH}. Required for 100% LLM parsing.`);
    }
    
    // Load ENTIRE catalog - Claude will interpret it
    this.#fieldCatalog = fs.readFileSync(CATALOG_PATH, 'utf8');
    console.log(`✅ Loaded FIELD_CATALOG_v2.1.md (${this.#fieldCatalog.length} chars)`);
    
    // Load reference lists
    if (fs.existsSync(REFERENCE_LISTS_PATH)) {
      this.#referenceLists = JSON.parse(fs.readFileSync(REFERENCE_LISTS_PATH, 'utf8'));
      console.log(`✅ Loaded reference-lists.json`);
    } else {
      console.warn(`⚠️ Reference lists not found at ${REFERENCE_LISTS_PATH}`);
      this.#referenceLists = {};
    }
    
    this.#catalogLoaded = true;
  }

  /**
   * Construct system prompt with ENTIRE FIELD_CATALOG as context
   * Claude interprets the catalog directly - NO local parsing
   * 
   * @param {string} clusterCode - Cluster code (AGE, BMI, SEV, etc.)
   * @returns {string} System prompt with full catalog
   */
  constructSystemPrompt(clusterCode) {
    this.#loadFieldCatalog();
    
    const primaryFields = CLUSTER_PRIMARY_FIELDS[clusterCode] || [];
    const refStr = JSON.stringify(this.#referenceLists, null, 2);

    return `You are an expert Clinical Trial Criteria Parser. You MUST follow the FIELD_CATALOG specification below exactly.

═══════════════════════════════════════════════════════════════════════════════
                           FIELD CATALOG v2.1 (Master Specification)
═══════════════════════════════════════════════════════════════════════════════

${this.#fieldCatalog}

═══════════════════════════════════════════════════════════════════════════════
                           REFERENCE LISTS (Standard Vocabulary)
═══════════════════════════════════════════════════════════════════════════════

${refStr}

═══════════════════════════════════════════════════════════════════════════════
                           YOUR TASK
═══════════════════════════════════════════════════════════════════════════════

You are parsing criteria from cluster: ${clusterCode}
Primary fields to extract: ${primaryFields.join(', ')}

CRITICAL REQUIREMENTS:
1. Follow the "LLM Thought Process" section for EACH field in the catalog EXACTLY
2. Include your step-by-step reasoning in "_thought_process" field
3. ALWAYS include "raw_text" in output (the original criterion text)
4. Apply 3-stage unfamiliar term detection:
   - Stage 1: Exact match in reference lists → confidence 1.0
   - Stage 2: Base term match (psoriasis, cancer, syndrome, etc.) → confidence 0.85
   - Stage 3: Your judgment → if confidence < 0.7, set unfamiliar_term_flag: true
5. v2.1 RULES (CRITICAL):
   - "active/inactive" → CONDITION_PATTERN (NOT SEVERITY)
   - "acute/chronic/mild/moderate/severe/flaring/quiescent" → SEVERITY
   - NESTED_CONDITION must be an object with: main_condition, nested_operator, nested_items, nested_logical_operator
   - NEGATION_DETECTED is SUPPLEMENTARY - ALSO parse negated terms into normal fields (CONDITION_TYPE, PSORIASIS_VARIANT, etc.)
   - EXCEPTION_CONDITION must have: excluded_types, condition, makes_eligible

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown, no explanation outside JSON) with this structure:
{
  "id": "criterion_id",
  "nct_id": "NCT...",
  "raw_text": "original criterion text verbatim",
  "_thought_process": "Your step-by-step reasoning following the catalog's LLM Thought Process sections",
  // ... all extracted fields per catalog specification ...
  "confidence": 0.0-1.0,
  "unfamiliar_term_flag": false,
  "parsing_status": "complete" | "pending_admin_review"
}`;
  }

  /**
   * Parse a single criterion using 100% LLM approach
   * Claude does ALL parsing following FIELD_CATALOG specification
   * 
   * @param {Object} criterion - Criterion object with id, nct_id, raw_text
   * @param {string} clusterCode - Cluster code (AGE, BMI, etc.)
   * @returns {Promise<Object>} Parsed criterion with all fields
   */
  async parseCriterion(criterion, clusterCode) {
    const systemPrompt = this.constructSystemPrompt(clusterCode);

    const userPrompt = `Parse this criterion following the FIELD_CATALOG specification exactly:

CLUSTER: ${clusterCode}
ID: ${criterion.id}
NCT_ID: ${criterion.nct_id || 'Unknown'}
RAW_TEXT: "${criterion.raw_text}"

Return valid JSON only. Include _thought_process explaining your reasoning step by step.`;

    try {
      const apiResponse = await this.#claudeClient.complete({
        system: systemPrompt,
        prompt: userPrompt,
        maxTokens: 4096,  // Larger for complex nested conditions
        returnUsage: true  // Get token usage for cost tracking
      });

      const responseText = apiResponse.text;
      const usage = apiResponse.usage;

      // Extract JSON from response
      let parsedData;
      try {
        // Try multiple extraction patterns
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/) ||
                         responseText.match(/```\s*([\s\S]*?)```/) ||
                         [null, responseText];
        let jsonStr = jsonMatch[1] || responseText;
        
        // Clean up common issues
        jsonStr = jsonStr.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/```$/, '');
        }
        
        parsedData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error(`JSON parse error for ${criterion.id}:`, parseError.message);
        console.error(`Raw response (first 500 chars):`, responseText.substring(0, 500));
        parsedData = {
          _thought_process: `LLM returned invalid JSON: ${parseError.message}`,
          AMBIGUITY_FLAG: true,
          ambiguity_reason: 'LLM response was not valid JSON',
          parsing_status: 'error'
        };
      }

      // Build initial result with basic fields
      const rawResult = {
        id: criterion.id,
        nct_id: criterion.nct_id,
        raw_text: criterion.raw_text,  // ALWAYS include raw_text
        ...parsedData,
        // Include original data if provided (for validator to infer CRITERION_TYPE)
        ...(criterion.original && { original: criterion.original })
      };
      
      // Post-process through schema validator to ensure consistency
      const validation = validateCriterion(rawResult, clusterCode);
      
      if (validation.warnings.length > 0) {
        console.log(`Validation warnings for ${criterion.id}:`, validation.warnings);
      }
      
      // Return criterion AND usage for cost tracking
      return {
        criterion: validation.criterion,
        usage
      };
    } catch (error) {
      console.error(`LLM parsing error for ${criterion.id}:`, error.message);
      return {
        criterion: {
          id: criterion.id,
          nct_id: criterion.nct_id,
          raw_text: criterion.raw_text,
          _thought_process: `LLM call failed: ${error.message}`,
          AMBIGUITY_FLAG: true,
          ambiguity_reason: `LLM error: ${error.message}`,
          confidence: 0,
          unfamiliar_term_flag: true,
          parsing_status: 'error'
        },
        usage: null  // No usage on error
      };
    }
  }

  /**
   * Parse multiple criteria in batch
   * @param {Array<Object>} criteria - Array of criterion objects
   * @param {string} clusterCode - Cluster code
   * @param {Object} options - Options { concurrency: number, onProgress: Function }
   * @returns {Promise<Array<Object>>} Parsed criteria (extracts .criterion from each result)
   */
  async parseBatch(criteria, clusterCode, options = {}) {
    const { concurrency = 1, onProgress = null } = options;
    const results = [];
    let completed = 0;
    
    // Process in batches for concurrency
    for (let i = 0; i < criteria.length; i += concurrency) {
      const batch = criteria.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async criterion => {
          const parseResult = await this.parseCriterion(criterion, clusterCode);
          return parseResult.criterion;  // Extract just the criterion, not usage
        })
      );
      
      results.push(...batchResults);
      completed += batch.length;
      
      if (onProgress) {
        onProgress({ completed, total: criteria.length, percent: (completed / criteria.length) * 100 });
      }
      
      // Small delay between batches to avoid rate limiting
      if (i + concurrency < criteria.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return results;
  }

  /**
   * Parse an entire cluster from the database
   * @param {Object} database - The slot-filled database object
   * @param {string} clusterCode - Cluster code (AGE, BMI, etc.)
   * @param {Object} options - Options for batch processing
   * @returns {Promise<Object>} Cluster with parsed criteria
   */
  async parseCluster(database, clusterCode, options = {}) {
    const clusterKey = `CLUSTER_${clusterCode}`;
    const cluster = database[clusterKey];
    
    if (!cluster) {
      throw new Error(`Cluster ${clusterKey} not found in database`);
    }
    
    console.log(`📋 Parsing ${cluster.criteria.length} criteria from ${clusterKey}...`);
    
    const parsedCriteria = await this.parseBatch(cluster.criteria, clusterCode, {
      ...options,
      onProgress: (progress) => {
        console.log(`   Progress: ${progress.completed}/${progress.total} (${progress.percent.toFixed(1)}%)`);
        if (options.onProgress) options.onProgress(progress);
      }
    });
    
    // Calculate statistics
    const stats = {
      total: parsedCriteria.length,
      complete: parsedCriteria.filter(c => c.parsing_status === 'complete').length,
      pending_review: parsedCriteria.filter(c => c.parsing_status === 'pending_admin_review').length,
      errors: parsedCriteria.filter(c => c.parsing_status === 'error').length,
      unfamiliar_terms: parsedCriteria.filter(c => c.unfamiliar_term_flag).length
    };
    
    console.log(`✅ Cluster ${clusterKey} parsed:`, stats);
    
    return {
      ...cluster,
      criteria: parsedCriteria,
      parsing_stats: stats,
      parsed_at: new Date().toISOString()
    };
  }

  /**
   * Get list of all cluster codes
   * @returns {string[]} Array of cluster codes
   */
  static getClusterCodes() {
    return Object.keys(CLUSTER_PRIMARY_FIELDS);
  }

  /**
   * Get primary fields for a cluster
   * @param {string} clusterCode - Cluster code
   * @returns {string[]} Array of field names
   */
  static getPrimaryFields(clusterCode) {
    return CLUSTER_PRIMARY_FIELDS[clusterCode] || [];
  }

  /**
   * Get all field definitions
   * @returns {Object} All fields organized by category
   */
  static getAllFields() {
    return ALL_FIELDS;
  }
}

export default UniversalParserV2;
