/**
 * Clinical Trial Matcher
 * Core matching logic for evaluating patient eligibility
 * @module services/matcher/ClinicalTrialMatcher
 */

import { ClaudeAPIClient } from '../api/claudeClient.js';
import {
  CriterionMatchResult,
  TrialEligibilityResult,
  PatientMatchResults,
} from './results.js';
import { drugsMatch, drugBelongsToClass, findSynonyms, isKnownDrug, directStringMatch } from './drugDatabase.js';
import { AIFallbackHandler } from './AIFallbackHandler.js';
import {
  arraysOverlap,
  timeframeMatches,
  severityMatches,
  measurementMeetsThreshold,
} from '../../utils/index.js';
import {
  getConfidenceThresholds,
  getConfidenceByMatchType,
  getMeasurementTypes,
  isAIEnabledForCluster
} from '../config/RulesLoader.js';

/**
 * @typedef {Object} AIConfig
 * @property {string} apiKey - Anthropic API key
 * @property {string} [model] - Model to use
 * @property {Object} [confidenceThresholds] - Confidence thresholds
 */

/**
 * Get default confidence thresholds from config
 * @returns {Object} Default thresholds
 */
function getDefaultConfidenceThresholds() {
  const configThresholds = getConfidenceThresholds();
  return configThresholds.default || {
    exclude: 0.8,
    review: 0.5,
    ignore: 0.3,
  };
}

/**
 * Clinical Trial Matcher class
 */
export class ClinicalTrialMatcher {
  #database;
  #aiClient;
  #aiFallback;
  #confidenceThresholds;
  #trialIndex;

  /**
   * Create a Clinical Trial Matcher
   * @param {Object} database - Trial criteria database
   * @param {AIConfig|null} [aiConfig=null] - AI configuration
   */
  constructor(database, aiConfig = null) {
    this.#database = database;
    // Use externalized config with override from aiConfig
    this.#confidenceThresholds = aiConfig?.confidenceThresholds || getDefaultConfidenceThresholds();

    // Initialize AI client if config provided
    // V5: If apiKey is 'configured-on-server', AI calls go through backend, not direct
    const useDirectAI = aiConfig?.apiKey && aiConfig.apiKey !== 'configured-on-server';
    
    if (useDirectAI) {
      this.#aiClient = new ClaudeAPIClient(aiConfig.apiKey, aiConfig.model);
      this.#aiFallback = new AIFallbackHandler({ 
        claudeClient: this.#aiClient, 
        enabled: true 
      });
    } else {
      // V5: Backend handles AI - frontend does rule-based matching only
      this.#aiClient = null;
      this.#aiFallback = new AIFallbackHandler({ 
        claudeClient: null, 
        enabled: false 
      });
    }

    // Build trial index for fast lookup
    this.#buildTrialIndex();
  }

  /**
   * Build index of trials for fast criterion lookup
   */
  #buildTrialIndex() {
    this.#trialIndex = new Map();

    if (!this.#database) {
      return;
    }

    for (const [clusterKey, cluster] of Object.entries(this.#database)) {
      if (!clusterKey.startsWith('CLUSTER_') || !cluster.criteria) {
        continue;
      }

      const clusterCode = cluster.cluster_code;

      for (const criterion of cluster.criteria) {
        const nctId = criterion.nct_id;
        if (!this.#trialIndex.has(nctId)) {
          this.#trialIndex.set(nctId, []);
        }
        this.#trialIndex.get(nctId).push({
          ...criterion,
          clusterCode,
        });
      }
    }
  }

  /**
   * Check if EXCEPTION_CONDITION applies to patient
   * Per FIELD_CATALOG_v2.1.md: Exception clauses override exclusion criteria
   * Example: "History of cancer except basal cell carcinoma" - BCC patients ARE eligible
   * 
   * @param {Object} criterion - Criterion with EXCEPTION_CONDITION
   * @param {Array} patientConditions - Patient's conditions (array of {CONDITION_TYPE: [...], ...})
   * @returns {Object} { applies: boolean, reason: string }
   */
  #checkExceptionCondition(criterion, patientConditions) {
    const exception = criterion.EXCEPTION_CONDITION;
    if (!exception || !exception.excluded_types || !Array.isArray(exception.excluded_types)) {
      return { applies: false, reason: null };
    }

    // Normalize exception types to lowercase for case-insensitive matching
    const excludedTypes = exception.excluded_types.map(t => t.toLowerCase());

    // Check if ANY patient condition matches an exception type
    for (const patientCondition of patientConditions) {
      const patientTypes = (patientCondition.CONDITION_TYPE || []).map(t => t.toLowerCase());
      
      // Check for direct match
      for (const patientType of patientTypes) {
        if (excludedTypes.includes(patientType)) {
          return {
            applies: true,
            reason: `Exception applies: "${patientType}" is in excluded types. Patient eligible despite general exclusion.`
          };
        }
        
        // Check for partial match (patient type contains exception type or vice versa)
        for (const excludedType of excludedTypes) {
          if (patientType.includes(excludedType) || excludedType.includes(patientType)) {
            return {
              applies: true,
              reason: `Exception applies: "${patientType}" matches excluded type "${excludedType}". Patient eligible despite general exclusion.`
            };
          }
        }
      }
    }

    return { applies: false, reason: null };
  }

  /**
   * Evaluate NESTED_CONDITION per FIELD_CATALOG_v2.1.md
   * Handles: main_condition + nested_operator + nested_items
   * 
   * Operators:
   * - at_least_one: Patient must match at least one nested item
   * - at_least_n: Patient must match at least nested_count items
   * - all: Patient must match ALL nested items
   * 
   * @param {Object} nestedCondition - The NESTED_CONDITION object
   * @param {Object} patientData - Patient's response data for the cluster
   * @returns {Object} { mainConditionMet: boolean, nestedConditionMet: boolean, reason: string }
   */
  #evaluateNestedCondition(nestedCondition, patientData) {
    if (!nestedCondition || !patientData) {
      return { mainConditionMet: false, nestedConditionMet: false, reason: 'Missing nested condition or patient data' };
    }

    // Step 1: Evaluate main condition (e.g., PASI 10-12)
    const mainCond = nestedCondition.main_condition;
    let mainConditionMet = false;
    let mainReason = '';

    if (mainCond && mainCond.parameter) {
      const patientMeasurements = patientData.MEASUREMENTS || [];
      const patientMeasurement = patientMeasurements.find(m => 
        m.parameter?.toLowerCase() === mainCond.parameter.toLowerCase()
      );

      if (!patientMeasurement) {
        // Try direct property access (PASI, BSA, etc.)
        const directValue = patientData[mainCond.parameter] || patientData[mainCond.parameter.toLowerCase()];
        if (directValue !== undefined) {
          mainConditionMet = this.#evaluateMainConditionValue(mainCond, directValue);
          mainReason = `${mainCond.parameter}: ${directValue}`;
        } else {
          mainReason = `Missing ${mainCond.parameter} measurement`;
        }
      } else {
        mainConditionMet = this.#evaluateMainConditionValue(mainCond, patientMeasurement.value);
        mainReason = `${mainCond.parameter}: ${patientMeasurement.value}`;
      }
    } else {
      // No main condition specified - consider it met
      mainConditionMet = true;
      mainReason = 'No main condition required';
    }

    // Step 2: Evaluate nested items using operator
    const operator = nestedCondition.nested_operator || 'at_least_one';
    const nestedItems = nestedCondition.nested_items || [];
    const nestedCount = nestedCondition.nested_count || 1;

    if (nestedItems.length === 0) {
      return { 
        mainConditionMet, 
        nestedConditionMet: true, 
        reason: `${mainReason}. No nested items to evaluate.` 
      };
    }

    let matchedCount = 0;
    const matchedItems = [];

    for (const item of nestedItems) {
      const itemType = item.type; // e.g., 'ANATOMICAL_LOCATION'
      const itemValues = (item.values || []).map(v => v.toLowerCase());

      // Get patient's values for this type
      const patientValues = (patientData[itemType] || []).map(v => v.toLowerCase());

      // Count how many item values the patient has
      for (const val of itemValues) {
        if (patientValues.includes(val)) {
          matchedCount++;
          matchedItems.push(val);
        }
      }
    }

    let nestedConditionMet = false;
    let nestedReason = '';

    switch (operator) {
      case 'at_least_one':
        nestedConditionMet = matchedCount >= 1;
        nestedReason = `Matched ${matchedCount} item(s): [${matchedItems.join(', ')}]. Required: at least 1.`;
        break;
      case 'at_least_n':
        nestedConditionMet = matchedCount >= nestedCount;
        nestedReason = `Matched ${matchedCount} item(s): [${matchedItems.join(', ')}]. Required: at least ${nestedCount}.`;
        break;
      case 'all':
        const totalRequired = nestedItems.reduce((sum, item) => sum + (item.values?.length || 0), 0);
        nestedConditionMet = matchedCount >= totalRequired;
        nestedReason = `Matched ${matchedCount}/${totalRequired} item(s): [${matchedItems.join(', ')}]. Required: all.`;
        break;
      default:
        nestedConditionMet = matchedCount >= 1;
        nestedReason = `Unknown operator "${operator}". Defaulted to at_least_one. Matched ${matchedCount}.`;
    }

    return {
      mainConditionMet,
      nestedConditionMet,
      reason: `${mainReason}. ${nestedReason}`
    };
  }

  /**
   * Helper to evaluate main condition value against threshold
   * @param {Object} mainCond - Main condition object
   * @param {number} value - Patient's value
   * @returns {boolean} Whether condition is met
   */
  #evaluateMainConditionValue(mainCond, value) {
    const numValue = typeof value === 'object' ? value.value : value;
    
    // Handle range (min/max)
    if (mainCond.min !== undefined && mainCond.max !== undefined) {
      return numValue >= mainCond.min && numValue < mainCond.max;
    }
    
    // Handle comparison operators
    const comparison = mainCond.comparison || '>=';
    const threshold = mainCond.value || mainCond.min;
    
    if (threshold === undefined) {return true;}
    
    switch (comparison) {
      case '>=': return numValue >= threshold;
      case '>': return numValue > threshold;
      case '<=': return numValue <= threshold;
      case '<': return numValue < threshold;
      case '==': 
      case '=': return numValue === threshold;
      case 'range':
        return numValue >= (mainCond.min || 0) && numValue < (mainCond.max || Infinity);
      default:
        return numValue >= threshold;
    }
  }

  /**
   * Format patient severity values for display
   * @param {Object} patientSeverity - Patient severity data
   * @returns {string} Formatted string
   */
  #formatPatientSeverityValue(patientSeverity) {
    if (!patientSeverity) {return 'No severity data';}
    
    const parts = [];
    const scoreTypes = ['PASI', 'PGA', 'IGA', 'DLQI', 'PHQ', 'BSA'];
    
    for (const type of scoreTypes) {
      const value = patientSeverity[type]?.value ?? patientSeverity[type] ?? 
                    patientSeverity[type.toLowerCase()]?.value ?? patientSeverity[type.toLowerCase()];
      if (value !== undefined && value !== null) {
        parts.push(`${type}: ${value}`);
      }
    }
    
    // Add anatomical locations if present
    if (patientSeverity.ANATOMICAL_LOCATION?.length > 0) {
      parts.push(`Locations: ${patientSeverity.ANATOMICAL_LOCATION.join(', ')}`);
    }
    
    return parts.length > 0 ? parts.join(', ') : 'No severity scores';
  }

  /**
   * Get all unique trial IDs
   * @returns {Set<string>} Set of NCT IDs
   */
  getAllTrialIds() {
    return new Set(this.#trialIndex.keys());
  }

  /**
   * Match patient against all trials
   * @param {Object} patientResponse - Patient response data
   * @returns {Promise<PatientMatchResults>} Matching results
   */
  async matchPatient(patientResponse) {
    const trials = this.getAllTrialIds();
    const results = {
      eligibleTrials: [],
      ineligibleTrials: [],
      needsReviewTrials: [],
    };

    // Evaluate all trials in parallel for better performance
    const evaluationPromises = Array.from(trials).map((nctId) =>
      this.evaluateTrial(nctId, patientResponse)
    );

    const trialResults = await Promise.all(evaluationPromises);

    // Categorize results
    for (const result of trialResults) {
      switch (result.status) {
        case 'eligible':
          results.eligibleTrials.push(result);
          break;
        case 'needs_review':
          results.needsReviewTrials.push(result);
          break;
        default:
          results.ineligibleTrials.push(result);
      }
    }

    // Sort by confidence
    results.eligibleTrials.sort((a, b) => b.getConfidenceScore() - a.getConfidenceScore());
    results.needsReviewTrials.sort((a, b) => b.getConfidenceScore() - a.getConfidenceScore());

    return new PatientMatchResults({
      patientResponse,
      ...results,
    });
  }

  /**
   * Evaluate patient eligibility for a single trial
   * @param {string} nctId - Trial NCT ID
   * @param {Object} patientResponse - Patient response data
   * @returns {Promise<TrialEligibilityResult>} Trial eligibility result
   */
  async evaluateTrial(nctId, patientResponse) {
    const criteria = this.#trialIndex.get(nctId) || [];
    const matchedCriteria = [];
    const flaggedCriteria = [];
    const failureReasons = [];

    // Evaluate all criteria for this trial in parallel
    const evaluationPromises = criteria.map((criterion) =>
      this.evaluateCriterion(criterion, patientResponse, criterion.clusterCode)
    );

    const results = await Promise.all(evaluationPromises);

    // Process results
    for (const result of results) {
      matchedCriteria.push(result);

      if (result.requiresAI) {
        flaggedCriteria.push(result);
      }

      if (result.causesIneligibility()) {
        const reason =
          result.exclusionStrength === 'inclusion'
            ? `Failed inclusion: ${result.rawText || result.criterionId}`
            : `Matched exclusion: ${result.rawText || result.criterionId}`;
        failureReasons.push(reason);
      }
    }

    // Determine eligibility status
    const hasIneligibility = matchedCriteria.some((c) => c.causesIneligibility());
    const hasLowConfidence = flaggedCriteria.some(
      (c) => c.confidence < this.#confidenceThresholds.review
    );

    let status;
    if (hasIneligibility && !hasLowConfidence) {
      status = 'ineligible';
    } else if (hasIneligibility && hasLowConfidence) {
      status = 'needs_review';
    } else if (hasLowConfidence) {
      status = 'needs_review';
    } else {
      status = 'eligible';
    }

    return new TrialEligibilityResult({
      nctId,
      status,
      matchedCriteria,
      flaggedCriteria,
      failureReasons,
    });
  }

  /**
   * Evaluate a single criterion against patient response
   * @param {Object} criterion - Criterion to evaluate
   * @param {Object} patientResponse - Patient response
   * @param {string} clusterCode - Cluster code (AGE, BMI, etc.)
   * @returns {Promise<CriterionMatchResult>} Criterion match result
   */
  async evaluateCriterion(criterion, patientResponse, clusterCode) {
    const responses = patientResponse.responses || patientResponse;
    const exclusionStrength = criterion.EXCLUSION_STRENGTH || 'exclusion';

    let matches = false;
    let confidence = 1.0;
    let requiresAI = false;
    let aiReasoning = null;
    let patientValue = '';
    let confidenceReason = '';
    let needsAdminReview = false;
    let matchMethod = '';
    let reviewPayload = null;
    let exceptionApplied = false;
    let nestedConditionMet = null;

    try {
      // Route to appropriate evaluation method based on cluster
      const evalResult = await this.#evaluateByCluster(
        clusterCode,
        criterion,
        responses
      );

      matches = evalResult.matches;
      confidence = evalResult.confidence;
      requiresAI = evalResult.requiresAI || false;
      aiReasoning = evalResult.aiReasoning || null;
      patientValue = evalResult.patientValue || '';
      confidenceReason = evalResult.confidenceReason || '';
      needsAdminReview = evalResult.needsAdminReview || false;
      matchMethod = evalResult.matchMethod || '';
      reviewPayload = evalResult.reviewPayload || null;
      exceptionApplied = evalResult.exceptionApplied || false;
      nestedConditionMet = evalResult.nestedConditionMet;
    } catch (error) {
      console.error(`Error evaluating criterion ${criterion.id}:`, error);
      matches = false;
      confidence = getConfidenceByMatchType('errorFallback');
      confidenceReason = 'Error during evaluation';
    }

    return new CriterionMatchResult({
      criterionId: criterion.id,
      nctId: criterion.nct_id,
      matches,
      requiresAI,
      aiReasoning,
      confidence,
      exclusionStrength,
      rawText: criterion.raw_text || '',
      patientValue,
      confidenceReason,
      needsAdminReview,
      matchMethod,
      reviewPayload,
      exceptionApplied,
      nestedConditionMet,
    });
  }

  /**
   * Route evaluation to appropriate cluster handler
   * @param {string} clusterCode - Cluster code
   * @param {Object} criterion - Criterion data
   * @param {Object} responses - Patient responses
   * @returns {Object} Evaluation result
   */
  #evaluateByCluster(clusterCode, criterion, responses) {
    switch (clusterCode) {
      case 'AGE':
        return this.#evaluateAge(criterion, responses.AGE);
      case 'BMI':
        return this.#evaluateBMI(criterion, responses.BMI);
      case 'CMB':
        return this.#evaluateComorbidity(criterion, responses.CMB);
      case 'PTH':
        return this.#evaluateTreatmentHistory(criterion, responses.PTH);
      case 'AIC':
        return this.#evaluateInfection(criterion, responses.AIC);
      case 'AAO':
        return this.#evaluateMeasurements(criterion, responses.AAO);
      case 'SEV':
        return this.#evaluateSeverity(criterion, responses.SEV);
      case 'DD':
        return this.#evaluateDuration(criterion, responses.DD);
      case 'DIT':
        return this.#evaluateVariant(criterion, responses.DIT);
      case 'BIO':
        return this.#evaluateBiomarker(criterion, responses.BIO);
      default:
        return { matches: false, confidence: getConfidenceByMatchType('unknownCluster') };
    }
  }

  /**
   * Evaluate age criterion
   */
  #evaluateAge(criterion, patientAge) {
    if (!patientAge?.age) {
      return { 
        matches: false, 
        confidence: getConfidenceByMatchType('missingData'),
        patientValue: 'Age not provided',
        confidenceReason: 'Missing patient age data'
      };
    }

    const age = patientAge.age;
    const minAge = criterion.AGE_MIN;
    const maxAge = criterion.AGE_MAX;

    // Build criterion requirement string
    let criterionReq = '';
    if (minAge !== null && minAge !== undefined && maxAge !== null && maxAge !== undefined) {
      criterionReq = `Required: ${minAge}-${maxAge} years`;
    } else if (minAge !== null && minAge !== undefined) {
      criterionReq = `Required: ≥${minAge} years`;
    } else if (maxAge !== null && maxAge !== undefined) {
      criterionReq = `Required: ≤${maxAge} years`;
    }

    // For inclusion criteria: check if patient is within range
    // For exclusion criteria: check if patient matches the exclusion condition
    let matches = true;

    if (minAge !== null && minAge !== undefined && age < minAge) {
      matches = false;
    }
    if (maxAge !== null && maxAge !== undefined && age > maxAge) {
      matches = false;
    }

    // If it's an inclusion criterion, matches means patient is eligible
    // If it's exclusion criterion and we matched the range, patient is excluded
    return { 
      matches, 
      confidence: getConfidenceByMatchType('exactMatch'),
      patientValue: `Patient age: ${age} years`,
      confidenceReason: `Exact numeric comparison. ${criterionReq}`
    };
  }

  /**
   * Evaluate BMI/weight criterion
   */
  #evaluateBMI(criterion, patientBMI) {
    if (!patientBMI) {
      return { 
        matches: false, 
        confidence: getConfidenceByMatchType('missingData'),
        patientValue: 'BMI/weight not provided',
        confidenceReason: 'Missing patient BMI data'
      };
    }

    let matches = true;
    const patientValues = [];
    const requirements = [];
    let hasExplicitFields = false;

    // Check BMI
    if (patientBMI.bmi) {
      patientValues.push(`BMI: ${patientBMI.bmi}`);
    }
    if (criterion.BMI_MIN !== null && criterion.BMI_MIN !== undefined) {
      hasExplicitFields = true;
      requirements.push(`BMI ≥${criterion.BMI_MIN}`);
      if (patientBMI.bmi < criterion.BMI_MIN) {
        matches = false;
      }
    }
    if (criterion.BMI_MAX !== null && criterion.BMI_MAX !== undefined) {
      hasExplicitFields = true;
      requirements.push(`BMI ≤${criterion.BMI_MAX}`);
      if (patientBMI.bmi > criterion.BMI_MAX) {
        matches = false;
      }
    }

    // Check weight
    const weightValue = patientBMI.weight?.value || patientBMI.weight;
    const weightUnit = patientBMI.weight?.unit || 'kg';
    if (weightValue) {
      patientValues.push(`Weight: ${weightValue}${weightUnit}`);
    }
    if (criterion.WEIGHT_MIN !== null && criterion.WEIGHT_MIN !== undefined) {
      hasExplicitFields = true;
      requirements.push(`Weight ≥${criterion.WEIGHT_MIN}kg`);
      if (weightValue < criterion.WEIGHT_MIN) {
        matches = false;
      }
    }
    if (criterion.WEIGHT_MAX !== null && criterion.WEIGHT_MAX !== undefined) {
      hasExplicitFields = true;
      requirements.push(`Weight ≤${criterion.WEIGHT_MAX}kg`);
      if (weightValue > criterion.WEIGHT_MAX) {
        matches = false;
      }
    }

    // If no explicit fields present, try parsing from raw_text
    if (!hasExplicitFields && criterion.raw_text) {
      return this.#parseWeightFromRawText(criterion, patientBMI, patientValues);
    }

    return { 
      matches, 
      confidence: getConfidenceByMatchType('exactMatch'),
      patientValue: patientValues.join(', ') || 'No BMI/weight data',
      confidenceReason: `Exact numeric comparison. Required: ${requirements.join(', ') || 'N/A'}`
    };
  }

  /**
   * Parse weight/BMI requirements from raw_text for criteria without slot-filled fields
   * Handles double-negative phrasing like "must not weigh < X" or "weighing ≤ X"
   * @param {Object} criterion - Criterion object with raw_text
   * @param {Object} patientBMI - Patient BMI/weight data
   * @param {Array<string>} patientValues - Array of patient value strings for display
   * @returns {Object} Match result with matches, confidence, and reasoning
   */
  #parseWeightFromRawText(criterion, patientBMI, patientValues) {
    const rawText = criterion.raw_text;
    const weightValue = patientBMI.weight?.value || patientBMI.weight;
    const isExclusion = criterion.EXCLUSION_STRENGTH !== 'inclusion';
    
    // Pattern 1: Double-negative "must not weigh < X kg" or "must not weigh less than X kg"
    const doubleNegativePattern1 = /must\s+not\s+weigh\s*[<≤]\s*([\d.]+)\s*kg/i;
    const doubleNegativePattern2 = /must\s+not\s+weigh\s+less\s+than\s*([\d.]+)\s*kg/i;
    
    // Pattern 2: Simple "weighing ≤ X kg" or "weighing < X kg"
    const lessThanPattern = /weighing\s*[≤<]\s*([\d.]+)\s*kg/i;
    
    // Pattern 3: Simple "weighing ≥ X kg" or "weighing > X kg"
    const greaterThanPattern = /weighing\s*[≥>]\s*([\d.]+)\s*kg/i;
    
    let matches = false;
    let confidenceReason = '';
    
    // Check double-negative patterns
    let match = rawText.match(doubleNegativePattern1) || rawText.match(doubleNegativePattern2);
    if (match) {
      const threshold = parseFloat(match[1]);
      const meetsRequirement = (weightValue >= threshold);
      
      if (isExclusion) {
        // Double-negative in exclusion creates semantic inversion
        // "must NOT weigh < 30kg" semantically means "must weigh >= 30kg" (minimum weight)
        // But it's labeled as exclusion, so we invert the result
        matches = !meetsRequirement; // Inverted!
        
        confidenceReason = `Double-negative exclusion (inverted logic). Patient ${weightValue}kg, threshold ${threshold}kg. Criterion semantically means "minimum weight ${threshold}kg". Patient ${meetsRequirement ? 'MEETS' : 'FAILS'} requirement.`;
      } else {
        // Inclusion criterion with double-negative
        matches = meetsRequirement;
        confidenceReason = `Double-negative inclusion. Patient ${weightValue}kg must be ≥ ${threshold}kg. Patient ${meetsRequirement ? 'MEETS' : 'FAILS'} requirement.`;
      }
      
      return {
        matches,
        confidence: getConfidenceByMatchType('exactMatch'),
        patientValue: patientValues.join(', '),
        confidenceReason
      };
    }
    
    // Check less-than patterns
    match = rawText.match(lessThanPattern);
    if (match) {
      const threshold = parseFloat(match[1]);
      matches = (weightValue <= threshold);
      confidenceReason = `Parsed from raw text. Weight must be ≤ ${threshold}kg. Patient ${weightValue}kg ${matches ? 'MEETS' : 'FAILS'} requirement.`;
      
      return {
        matches,
        confidence: getConfidenceByMatchType('exactMatch'),
        patientValue: patientValues.join(', '),
        confidenceReason
      };
    }
    
    // Check greater-than patterns
    match = rawText.match(greaterThanPattern);
    if (match) {
      const threshold = parseFloat(match[1]);
      matches = (weightValue >= threshold);
      confidenceReason = `Parsed from raw text. Weight must be ≥ ${threshold}kg. Patient ${weightValue}kg ${matches ? 'MEETS' : 'FAILS'} requirement.`;
      
      return {
        matches,
        confidence: getConfidenceByMatchType('exactMatch'),
        patientValue: patientValues.join(', '),
        confidenceReason
      };
    }
    
    // Could not parse - flag for manual review
    return {
      matches: false,
      confidence: 0.5,
      requiresAI: true,
      patientValue: patientValues.join(', '),
      confidenceReason: `Could not parse weight requirement from: "${rawText}". Manual review needed.`
    };
  }

  /**
   * Evaluate comorbidity criterion
   * Supports EXCEPTION_CONDITION per FIELD_CATALOG_v2.1.md
   */
  async #evaluateComorbidity(criterion, patientComorbidities) {
    if (!patientComorbidities || !Array.isArray(patientComorbidities)) {
      return { 
        matches: false, 
        confidence: getConfidenceByMatchType('missingData'),
        patientValue: 'No comorbidities reported',
        confidenceReason: 'Missing patient comorbidity data'
      };
    }

    const conditions = criterion.conditions || [criterion];
    const criterionConditions = conditions.map(c => (c.CONDITION_TYPE || []).join(', ')).join('; ');
    const patientConditions = patientComorbidities.map(c => (c.CONDITION_TYPE || []).join(', ')).join('; ');

    // Check for EXCEPTION_CONDITION FIRST (per FIELD_CATALOG_v2.1.md)
    // If exception applies, patient is eligible despite general exclusion
    if (criterion.EXCEPTION_CONDITION) {
      const exceptionResult = this.#checkExceptionCondition(criterion, patientComorbidities);
      if (exceptionResult.applies) {
        return {
          matches: false, // Does NOT match exclusion - patient is eligible
          confidence: getConfidenceByMatchType('directMatch'),
          exceptionApplied: true,
          patientValue: `Patient: ${patientConditions}`,
          confidenceReason: exceptionResult.reason
        };
      }
    }

    for (const condition of conditions) {
      for (const patientCondition of patientComorbidities) {
        // Check condition type match
        const conditionTypes = condition.CONDITION_TYPE || [];
        const patientTypes = patientCondition.CONDITION_TYPE || [];

        if (arraysOverlap(conditionTypes, patientTypes, true)) {
          // Check pattern if specified
          if (condition.CONDITION_PATTERN && patientCondition.CONDITION_PATTERN) {
            if (!arraysOverlap(condition.CONDITION_PATTERN, patientCondition.CONDITION_PATTERN, true)) {
              continue;
            }
          }

          // Check severity if specified
          if (condition.SEVERITY && patientCondition.SEVERITY) {
            if (!severityMatches(condition.SEVERITY, patientCondition.SEVERITY)) {
              continue;
            }
          }

          // Check timeframe if specified
          if (condition.TIMEFRAME && patientCondition.TIMEFRAME) {
            if (!timeframeMatches(condition.TIMEFRAME, patientCondition.TIMEFRAME)) {
              continue;
            }
          }

          return { 
            matches: true, 
            confidence: getConfidenceByMatchType('directMatch'),
            patientValue: `Patient: ${patientTypes.join(', ')}`,
            confidenceReason: `Direct match with criterion: ${conditionTypes.join(', ')}. High confidence due to exact term match.`
          };
        }

        // Try synonym matching for ALL patient types, not just the first one
        for (const patientType of patientTypes) {
          const synonyms = findSynonyms(patientType);
          if (arraysOverlap(conditionTypes, synonyms, true)) {
            return { 
              matches: true, 
              confidence: getConfidenceByMatchType('synonymMatch'),
              patientValue: `Patient: ${patientTypes.join(', ')}`,
              confidenceReason: `Synonym match. Patient term "${patientType}" matched via synonym database to "${conditionTypes.join(', ')}". Reduced confidence due to indirect match.`
            };
          }
        }
      }
    }

    // Try AI matching if available and no match found
    // Check ALL conditions and comorbidities, not just the first ones
    if (this.#aiClient && conditions.length > 0 && patientComorbidities.length > 0) {
      // Collect all patient condition terms
      const patientTerms = patientComorbidities
        .flatMap(c => c.CONDITION_TYPE || [])
        .filter(Boolean);
      
      // Collect all criterion condition terms
      const criterionTerms = conditions
        .flatMap(c => c.CONDITION_TYPE || [])
        .filter(Boolean);

      if (patientTerms.length > 0 && criterionTerms.length > 0) {
        const aiResult = await this.#aiClient.semanticMatch(
          patientTerms.join(', '),
          criterionTerms.join(', '),
          'medical condition'
        );

        if (aiResult.match && aiResult.confidence >= this.#confidenceThresholds.ignore) {
          return {
            matches: true,
            confidence: aiResult.confidence,
            requiresAI: true,
            aiReasoning: aiResult.reasoning,
            patientValue: `Patient: ${patientTerms.join(', ')}`,
            confidenceReason: `AI semantic analysis. Criterion: "${criterionTerms.join(', ')}". ${aiResult.reasoning || ''}`
          };
        }
      }
    }

    return { 
      matches: false, 
      confidence: getConfidenceByMatchType('noMatch'),
      patientValue: `Patient conditions: ${patientConditions || 'none'}`,
      confidenceReason: `No match found. Criterion required: ${criterionConditions}. High confidence in no-match.`
    };
  }

  /**
   * Evaluate treatment history criterion
   * Uses 3-step cascade: 1) Database match 2) Direct string match 3) AI fallback
   * Unknown drugs are flagged for admin review
   */
  async #evaluateTreatmentHistory(criterion, patientTreatments) {
    if (!patientTreatments || !Array.isArray(patientTreatments)) {
      return { 
        matches: false, 
        confidence: getConfidenceByMatchType('missingData'),
        patientValue: 'No treatment history reported',
        confidenceReason: 'Missing patient treatment data'
      };
    }

    const conditions = criterion.conditions || [criterion];
    const criterionDrugs = conditions.map(c => (c.TREATMENT_TYPE || []).join(', ')).join('; ');
    const patientDrugs = patientTreatments.map(t => (t.TREATMENT_TYPE || []).join(', ')).join('; ');

    // Collect unknown drugs for potential AI fallback
    const unknownDrugsForAI = [];

    for (const condition of conditions) {
      for (const patientTreatment of patientTreatments) {
        const treatmentTypes = condition.TREATMENT_TYPE || [];
        const patientTypes = patientTreatment.TREATMENT_TYPE || [];

        for (const patientDrug of patientTypes) {
          // STEP 1: Check if drug is in database (most reliable)
          if (isKnownDrug(patientDrug)) {
            // Use database matching (synonym/class matching)
            for (const criterionDrug of treatmentTypes) {
              if (drugsMatch(criterionDrug, patientDrug)) {
                // Check timeframe if specified
                if (condition.TIMEFRAME && patientTreatment.TIMEFRAME) {
                  if (!timeframeMatches(condition.TIMEFRAME, patientTreatment.TIMEFRAME)) {
                    continue;
                  }
                }
                return { 
                  matches: true, 
                  confidence: getConfidenceByMatchType('databaseMatch'),
                  needsAdminReview: false,
                  matchMethod: 'database',
                  patientValue: `Patient drug: ${patientDrug}`,
                  confidenceReason: `Database match. "${patientDrug}" matched to "${criterionDrug}" via drug database.`
                };
              }
            }

            // Check drug class match
            const drugClass = condition.TREATMENT_PATTERN?.[0] || '';
            if (drugClass && drugBelongsToClass(patientDrug, drugClass)) {
              return { 
                matches: true, 
                confidence: getConfidenceByMatchType('classMatch'),
                needsAdminReview: false,
                matchMethod: 'database_class',
                patientValue: `Patient drug: ${patientDrug}`,
                confidenceReason: `Drug class match. "${patientDrug}" belongs to class "${drugClass}".`
              };
            }
          } else {
            // STEP 2: Drug NOT in database - try direct string match
            // This handles cases where criterion explicitly lists the drug name
            if (directStringMatch(patientDrug, treatmentTypes)) {
              // Check timeframe if specified
              if (condition.TIMEFRAME && patientTreatment.TIMEFRAME) {
                if (!timeframeMatches(condition.TIMEFRAME, patientTreatment.TIMEFRAME)) {
                  continue;
                }
              }
              return { 
                matches: true, 
                confidence: getConfidenceByMatchType('classMatch'),
                needsAdminReview: true,
                matchMethod: 'direct_unverified',
                reviewPayload: {
                  drugName: patientDrug,
                  criterionId: criterion.id,
                  nctId: criterion.nct_id,
                  matchedWith: treatmentTypes.find(t => t.toLowerCase() === patientDrug.toLowerCase())
                },
                patientValue: `Patient drug: ${patientDrug}`,
                confidenceReason: `Direct string match (unverified). "${patientDrug}" matched criterion. Drug not in database - requires admin review.`
              };
            }
            
            // STEP 3: Collect for AI fallback
            unknownDrugsForAI.push({
              patientDrug,
              treatmentTypes,
              condition,
              rawText: criterion.raw_text
            });
          }
        }
      }
    }

    // STEP 3: AI Fallback - only for unknown drugs that didn't match in steps 1-2
    if (unknownDrugsForAI.length > 0 && this.#aiFallback.isEnabled()) {
      for (const { patientDrug, treatmentTypes, rawText } of unknownDrugsForAI) {
        try {
          const aiResult = await this.#aiFallback.matchTreatmentHistory(
            patientDrug,
            treatmentTypes,
            rawText,
            criterion
          );
          
          if (aiResult.matches) {
            return aiResult;
          }
        } catch (error) {
          console.error('AI fallback error for drug:', patientDrug, error);
        }
      }
    }

    return { 
      matches: false, 
      confidence: getConfidenceByMatchType('noMatch'),
      needsAdminReview: false,
      patientValue: `Patient treatments: ${patientDrugs || 'none'}`,
      confidenceReason: `No match found. Criterion required: ${criterionDrugs}. High confidence in no-match.`
    };
  }

  /**
   * Evaluate infection criterion
   */
  #evaluateInfection(criterion, patientInfections) {
    if (!patientInfections || !Array.isArray(patientInfections)) {
      return { 
        matches: false, 
        confidence: getConfidenceByMatchType('missingData'),
        patientValue: 'No infections reported',
        confidenceReason: 'Missing patient infection data'
      };
    }

    const conditions = criterion.conditions || [criterion];
    const criterionInfections = conditions.map(c => (c.INFECTION_TYPE || []).join(', ')).join('; ');
    const patientInfectionTypes = patientInfections.map(i => (i.INFECTION_TYPE || []).join(', ')).join('; ');

    for (const condition of conditions) {
      for (const patientInfection of patientInfections) {
        const infectionTypes = condition.INFECTION_TYPE || [];
        const patientTypes = patientInfection.INFECTION_TYPE || [];

        if (arraysOverlap(infectionTypes, patientTypes)) {
          // Check severity and timeframe
          if (condition.SEVERITY && patientInfection.SEVERITY) {
            if (!severityMatches(condition.SEVERITY, patientInfection.SEVERITY)) {
              continue;
            }
          }

          if (condition.TIMEFRAME && patientInfection.TIMEFRAME) {
            if (!timeframeMatches(condition.TIMEFRAME, patientInfection.TIMEFRAME)) {
              continue;
            }
          }

          return { 
            matches: true, 
            confidence: getConfidenceByMatchType('directMatch'),
            patientValue: `Patient infection: ${patientTypes.join(', ')}`,
            confidenceReason: `Direct infection match with: ${infectionTypes.join(', ')}. High confidence match.`
          };
        }

        // Try synonym matching for ALL patient types, not just the first one
        for (const patientType of patientTypes) {
          const synonyms = findSynonyms(patientType);
          if (arraysOverlap(infectionTypes, synonyms)) {
            return { 
              matches: true, 
              confidence: getConfidenceByMatchType('synonymMatch'),
              patientValue: `Patient infection: ${patientTypes.join(', ')}`,
              confidenceReason: `Synonym match for infection type. Reduced confidence due to indirect match.`
            };
          }
        }
      }
    }

    return { 
      matches: false, 
      confidence: getConfidenceByMatchType('noMatch'),
      patientValue: `Patient infections: ${patientInfectionTypes || 'none'}`,
      confidenceReason: `No match found. Criterion required: ${criterionInfections}. High confidence in no-match.`
    };
  }

  /**
   * Evaluate measurement criterion (BSA, PASI, etc.)
   */
  #evaluateMeasurements(criterion, patientMeasurements) {
    if (!patientMeasurements) {
      return { 
        matches: false, 
        confidence: getConfidenceByMatchType('missingData'),
        patientValue: 'No measurements provided',
        confidenceReason: 'Missing patient measurement data'
      };
    }

    // Check various measurement types - loaded from config
    const measurements = getMeasurementTypes('AAO').length > 0 ? getMeasurementTypes('AAO') : ['BSA', 'PASI', 'IGA', 'DLQI', 'PGA'];
    const patientValues = [];
    const requirements = [];

    // First try structured threshold fields
    for (const type of measurements) {
      let threshold = criterion[`${type}_THRESHOLD`] || criterion[`${type}_MIN`];
      let comparison = criterion[`${type}_COMPARISON`] || '>=';
      const patientValue = patientMeasurements[type]?.value ?? patientMeasurements[type];

      // If no structured threshold, try parsing from raw_text
      if ((threshold === null || threshold === undefined) && criterion.raw_text) {
        const parsed = this.#parseThresholdFromRawText(criterion.raw_text, type);
        if (parsed) {
          threshold = parsed.value;
          comparison = parsed.operator;
        }
      }

      if (patientValue !== null && patientValue !== undefined) {
        patientValues.push(`${type}: ${patientValue}`);
      }
      
      if (threshold !== null && threshold !== undefined) {
        requirements.push(`${type} ${comparison} ${threshold}`);
        
        if (patientValue !== null && patientValue !== undefined) {
          if (measurementMeetsThreshold(patientValue, threshold, comparison)) {
            return { 
              matches: true, 
              confidence: getConfidenceByMatchType('exactMatch'),
              patientValue: patientValues.join(', '),
              confidenceReason: `Exact numeric comparison. ${type} ${patientValue} meets ${comparison} ${threshold}`
            };
          }
        }
      }
    }

    return { 
      matches: false, 
      confidence: getConfidenceByMatchType('partialMatch'),
      patientValue: patientValues.join(', ') || 'No measurements',
      confidenceReason: `No measurement threshold met. Required: ${requirements.join(', ') || 'N/A'}. ${Math.round(getConfidenceByMatchType('partialMatch') * 100)}% due to possible missing data.`
    };
  }

  /**
   * Parse threshold from raw_text for a specific measurement type
   * Examples:
   * - "BSA involvement ≥10%" → { value: 10, operator: '>=' }
   * - "PASI score ≥12" → { value: 12, operator: '>=' }
   * - "BSA covered 2% to 20%" → { value: 2, max: 20, operator: 'between' }
   */
  #parseThresholdFromRawText(rawText, measurementType) {
    if (!rawText || !measurementType) {return null;}
    
    const text = rawText.toLowerCase();
    const type = measurementType.toLowerCase();
    
    // Check if this criterion mentions this measurement type
    if (!text.includes(type)) {return null;}
    
    // Pattern: "BSA ≥10%" or "BSA involvement ≥10%" or "BSA >= 10"
    // Use [^0-9]* to match any non-digit characters between type and number
    // Match ≥, >=, >, or just spaces before the number
    const gtePattern = new RegExp(type + '[^0-9]*[≥>]+=?\\s*(\\d+(?:\\.\\d+)?)', 'i');
    const gteMatch = rawText.match(gtePattern);
    if (gteMatch) {
      return { value: parseFloat(gteMatch[1]), operator: '>=' };
    }
    
    // Pattern: "BSA ≤10%" or "BSA <= 10"
    const ltePattern = new RegExp(type + '[^0-9]*[≤<]+=?\\s*(\\d+(?:\\.\\d+)?)', 'i');
    const lteMatch = rawText.match(ltePattern);
    if (lteMatch) {
      return { value: parseFloat(lteMatch[1]), operator: '<=' };
    }
    
    // Pattern: "BSA of at least 10" or "BSA at least 10%"
    const atLeastPattern = new RegExp(type + '[^0-9]*at\\s+least\\s+(\\d+(?:\\.\\d+)?)', 'i');
    const atLeastMatch = rawText.match(atLeastPattern);
    if (atLeastMatch) {
      return { value: parseFloat(atLeastMatch[1]), operator: '>=' };
    }
    
    // Pattern: "BSA minimum 10" or "minimum BSA of 10"
    const minPattern = new RegExp('(?:' + type + '[^0-9]*minimum|minimum[^0-9]*' + type + ')[^0-9]*(\\d+(?:\\.\\d+)?)', 'i');
    const minMatch = rawText.match(minPattern);
    if (minMatch) {
      return { value: parseFloat(minMatch[1]), operator: '>=' };
    }
    
    // Pattern: "BSA covered 2% to 20%" or "BSA between 2 and 20"
    const rangePattern = new RegExp(type + '[^0-9]*(\\d+(?:\\.\\d+)?)[^0-9]*(?:to|and|-)\\s*(\\d+(?:\\.\\d+)?)', 'i');
    const rangeMatch = rawText.match(rangePattern);
    if (rangeMatch) {
      return { 
        value: parseFloat(rangeMatch[1]), 
        max: parseFloat(rangeMatch[2]), 
        operator: 'between' 
      };
    }
    
    return null;
  }

  /**
   * Evaluate severity criterion
   * Handles PASI, PGA, IGA, DLQI, PHQ-9 scores
   * Supports NESTED_CONDITION per FIELD_CATALOG_v2.1.md
   */
  #evaluateSeverity(criterion, patientSeverity) {
    if (!patientSeverity) {
      return { 
        matches: false, 
        confidence: getConfidenceByMatchType('missingData'),
        patientValue: 'No severity data provided',
        confidenceReason: 'Missing patient severity data'
      };
    }

    // Check for NESTED_CONDITION FIRST (per FIELD_CATALOG_v2.1.md)
    // Example: "PASI 10-12 with at least one of facial/scalp involvement"
    if (criterion.NESTED_CONDITION) {
      const nestedResult = this.#evaluateNestedCondition(criterion.NESTED_CONDITION, patientSeverity);
      
      // Both main AND nested conditions must be met
      const overallMatch = nestedResult.mainConditionMet && nestedResult.nestedConditionMet;
      
      return {
        matches: overallMatch,
        confidence: overallMatch ? getConfidenceByMatchType('exactMatch') : getConfidenceByMatchType('partialMatch'),
        nestedConditionMet: nestedResult.nestedConditionMet,
        patientValue: this.#formatPatientSeverityValue(patientSeverity),
        confidenceReason: `NESTED_CONDITION evaluation. ${nestedResult.reason}`
      };
    }

    // Check various severity score types (original logic)
    const scoreTypes = ['PASI', 'PGA', 'IGA', 'DLQI', 'PHQ'];
    const patientValues = [];
    const requirements = [];

    for (const type of scoreTypes) {
      // Try structured field first
      let threshold = criterion[`${type}_THRESHOLD`] || criterion[`${type}_MIN`];
      let comparison = criterion[`${type}_COMPARISON`] || '>=';
      
      // Get patient value (handle both object and direct value formats)
      const patientValue = patientSeverity[type]?.value ?? patientSeverity[type] ?? patientSeverity[type.toLowerCase()]?.value ?? patientSeverity[type.toLowerCase()];

      // If no structured threshold, try parsing from raw_text
      if ((threshold === null || threshold === undefined) && criterion.raw_text) {
        const parsed = this.#parseThresholdFromRawText(criterion.raw_text, type);
        if (parsed) {
          threshold = parsed.value;
          comparison = parsed.operator;
        }
      }

      if (patientValue !== null && patientValue !== undefined) {
        patientValues.push(`${type}: ${patientValue}`);
      }
      
      if (threshold !== null && threshold !== undefined) {
        requirements.push(`${type} ${comparison} ${threshold}`);
        
        if (patientValue !== null && patientValue !== undefined) {
          if (measurementMeetsThreshold(patientValue, threshold, comparison)) {
            return { 
              matches: true, 
              confidence: getConfidenceByMatchType('exactMatch'),
              patientValue: patientValues.join(', '),
              confidenceReason: `Exact numeric comparison. ${type} ${patientValue} meets ${comparison} ${threshold}`
            };
          }
        }
      }
    }

    // Fallback to generic severity matching if no specific scores matched
    const requiredSeverity = criterion.SEVERITY || criterion.SEVERITY_MIN;
    const patientSeverityValue = patientSeverity.severity || patientSeverity;

    if (requiredSeverity && severityMatches(requiredSeverity, patientSeverityValue)) {
      return { 
        matches: true, 
        confidence: getConfidenceByMatchType('noMatch'),
        patientValue: `Patient severity: ${patientSeverityValue}`,
        confidenceReason: `Severity match. Required: ${requiredSeverity}. ${Math.round(getConfidenceByMatchType('noMatch') * 100)}% due to subjective severity assessment.`
      };
    }

    return { 
      matches: false, 
      confidence: getConfidenceByMatchType('partialMatch'),
      patientValue: patientValues.join(', ') || 'No severity scores',
      confidenceReason: `No severity threshold met. Required: ${requirements.join(', ') || 'N/A'}. ${Math.round(getConfidenceByMatchType('partialMatch') * 100)}% due to possible missing data.`
    };
  }

  /**
   * Evaluate disease duration criterion
   * Supports both DURATION_MIN/DURATION_UNIT and TIMEFRAME formats
   */
  #evaluateDuration(criterion, patientDuration) {
    if (!patientDuration) {
      return { 
        matches: false, 
        confidence: getConfidenceByMatchType('missingData'),
        patientValue: 'No duration data provided',
        confidenceReason: 'Missing patient duration data'
      };
    }

    // Support both DURATION_MIN/DURATION_UNIT and TIMEFRAME formats
    let minDuration, minUnit;
    if (criterion.TIMEFRAME && criterion.TIMEFRAME.amount !== undefined) {
      minDuration = criterion.TIMEFRAME.amount;
      minUnit = criterion.TIMEFRAME.unit || 'months';
    } else {
      minDuration = criterion.DURATION_MIN;
      minUnit = criterion.DURATION_UNIT || 'months';
    }

    const patientDurationValue = patientDuration.duration;
    const patientUnit = patientDuration.unit || 'months';

    if (minDuration !== null && minDuration !== undefined && patientDurationValue !== null && patientDurationValue !== undefined) {
      // Convert both to weeks for comparison using timeframeMatches
      // For inclusion criteria: patient duration must be >= criterion minimum
      const criterionTimeframe = { amount: minDuration, unit: minUnit, relation: 'for' };
      const patientTimeframe = { amount: patientDurationValue, unit: patientUnit };

      if (timeframeMatches(criterionTimeframe, patientTimeframe)) {
        return { 
          matches: true, 
          confidence: getConfidenceByMatchType('exactMatch'),
          patientValue: `Patient duration: ${patientDurationValue} ${patientUnit}`,
          confidenceReason: `Duration meets requirement. Required: ≥${minDuration} ${minUnit}`
        };
      }
    }

    return { 
      matches: false, 
      confidence: getConfidenceByMatchType('partialMatch'),
      patientValue: `Patient duration: ${patientDurationValue || 'unknown'} ${patientUnit}`,
      confidenceReason: `Duration insufficient. Required: ≥${minDuration || 'N/A'} ${minUnit}. ${Math.round(getConfidenceByMatchType('partialMatch') * 100)}% due to possible unit conversion issues.`
    };
  }

  /**
   * Evaluate variant criterion
   */
  #evaluateVariant(criterion, patientVariant) {
    if (!patientVariant) {
      return { 
        matches: false, 
        confidence: getConfidenceByMatchType('missingData'),
        patientValue: 'No variant data provided',
        confidenceReason: 'Missing patient variant data'
      };
    }

    const variants = criterion.VARIANT_TYPE || [];
    const patientVariantType = patientVariant.variant;

    if (variants.includes(patientVariantType)) {
      return { 
        matches: true, 
        confidence: getConfidenceByMatchType('exactMatch'),
        patientValue: `Patient variant: ${patientVariantType}`,
        confidenceReason: `Exact variant match. Required: ${variants.join(' or ')}`
      };
    }

    return { 
      matches: false, 
      confidence: getConfidenceByMatchType('noMatch'),
      patientValue: `Patient variant: ${patientVariantType || 'unknown'}`,
      confidenceReason: `Variant mismatch. Required: ${variants.join(' or ')}. ${Math.round(getConfidenceByMatchType('noMatch') * 100)}% confidence in no-match.`
    };
  }

  /**
   * Evaluate biomarker criterion
   */
  #evaluateBiomarker(criterion, patientBiomarkers) {
    if (!patientBiomarkers) {
      return { 
        matches: false, 
        confidence: getConfidenceByMatchType('missingData'),
        patientValue: 'No biomarker data provided',
        confidenceReason: 'Missing patient biomarker data'
      };
    }

    const biomarkerType = criterion.BIOMARKER_TYPE;
    const threshold = criterion.THRESHOLD;
    const comparison = criterion.COMPARISON || '>=';

    if (biomarkerType && patientBiomarkers[biomarkerType]) {
      const patientValue = patientBiomarkers[biomarkerType];
      if (measurementMeetsThreshold(patientValue, threshold, comparison)) {
        return { 
          matches: true, 
          confidence: getConfidenceByMatchType('exactMatch'),
          patientValue: `${biomarkerType}: ${patientValue}`,
          confidenceReason: `Exact biomarker comparison. ${biomarkerType} ${patientValue} meets ${comparison} ${threshold}`
        };
      }
      return {
        matches: false,
        confidence: getConfidenceByMatchType('noMatch'),
        patientValue: `${biomarkerType}: ${patientValue}`,
        confidenceReason: `Biomarker mismatch. Required: ${biomarkerType} ${comparison} ${threshold}`
      };
    }

    return { 
      matches: false, 
      confidence: getConfidenceByMatchType('partialMatch'),
      patientValue: `${biomarkerType || 'Biomarker'}: not available`,
      confidenceReason: `Biomarker not found in patient data. ${Math.round(getConfidenceByMatchType('partialMatch') * 100)}% due to missing data.`
    };
  }

  /**
   * Evaluate flare history criterion
   */
  #evaluateFlare(criterion, patientFlare) {
    if (!patientFlare) {
      return { 
        matches: false, 
        confidence: getConfidenceByMatchType('missingData'),
        patientValue: 'No flare history provided',
        confidenceReason: 'Missing patient flare data'
      };
    }

    const flareCount = criterion.FLARE_COUNT;
    const timeframe = criterion.TIMEFRAME;
    const patientFlareCount = patientFlare.count;

    if (flareCount !== null && flareCount !== undefined && patientFlareCount !== null && patientFlareCount !== undefined) {
      if (patientFlareCount >= flareCount) {
        if (timeframe && patientFlare.timeframe) {
          if (timeframeMatches(timeframe, patientFlare.timeframe)) {
            return { 
              matches: true, 
              confidence: getConfidenceByMatchType('directMatch'),
              patientValue: `Patient flares: ${patientFlareCount} in ${patientFlare.timeframe.amount || ''} ${patientFlare.timeframe.unit || ''}`,
              confidenceReason: `Flare count match with timeframe. Required: ≥${flareCount} flares. ${Math.round(getConfidenceByMatchType('directMatch') * 100)}% due to timeframe interpretation.`
            };
          }
        } else {
          return { 
            matches: true, 
            confidence: getConfidenceByMatchType('noMatch'),
            patientValue: `Patient flares: ${patientFlareCount}`,
            confidenceReason: `Flare count match. Required: ≥${flareCount}. ${Math.round(getConfidenceByMatchType('noMatch') * 100)}% due to missing timeframe.`
          };
        }
      }
    }

    return { 
      matches: false, 
      confidence: getConfidenceByMatchType('partialMatch'),
      patientValue: `Patient flares: ${patientFlareCount || 'unknown'}`,
      confidenceReason: `Flare count insufficient. Required: ≥${flareCount || 'N/A'}. ${Math.round(getConfidenceByMatchType('partialMatch') * 100)}% due to possible missing data.`
    };
  }
}

export default ClinicalTrialMatcher;
