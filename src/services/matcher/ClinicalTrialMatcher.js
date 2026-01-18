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

/**
 * @typedef {Object} AIConfig
 * @property {string} apiKey - Anthropic API key
 * @property {string} [model] - Model to use
 * @property {Object} [confidenceThresholds] - Confidence thresholds
 */

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
    this.#confidenceThresholds = aiConfig?.confidenceThresholds || {
      exclude: 0.8,
      review: 0.5,
      ignore: 0.3,
    };

    // Initialize AI client if config provided
    if (aiConfig?.apiKey) {
      this.#aiClient = new ClaudeAPIClient(aiConfig.apiKey, aiConfig.model);
      this.#aiFallback = new AIFallbackHandler({ 
        claudeClient: this.#aiClient, 
        enabled: true 
      });
    } else {
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
    } catch (error) {
      console.error(`Error evaluating criterion ${criterion.id}:`, error);
      matches = false;
      confidence = 0.5;
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
      case 'CPD':
        return this.#evaluateDuration(criterion, responses.CPD);
      case 'NPV':
        return this.#evaluateVariant(criterion, responses.NPV);
      case 'BIO':
        return this.#evaluateBiomarker(criterion, responses.BIO);
      case 'FLR':
        return this.#evaluateFlare(criterion, responses.FLR);
      default:
        return { matches: false, confidence: 0.5 };
    }
  }

  /**
   * Evaluate age criterion
   */
  #evaluateAge(criterion, patientAge) {
    if (!patientAge?.age) {
      return { 
        matches: false, 
        confidence: 0.5,
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
      confidence: 1.0,
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
        confidence: 0.5,
        patientValue: 'BMI/weight not provided',
        confidenceReason: 'Missing patient BMI data'
      };
    }

    let matches = true;
    const patientValues = [];
    const requirements = [];

    // Check BMI
    if (patientBMI.bmi) {
      patientValues.push(`BMI: ${patientBMI.bmi}`);
    }
    if (criterion.BMI_MIN !== null && criterion.BMI_MIN !== undefined) {
      requirements.push(`BMI ≥${criterion.BMI_MIN}`);
      if (patientBMI.bmi < criterion.BMI_MIN) {
        matches = false;
      }
    }
    if (criterion.BMI_MAX !== null && criterion.BMI_MAX !== undefined) {
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
      requirements.push(`Weight ≥${criterion.WEIGHT_MIN}kg`);
      if (weightValue < criterion.WEIGHT_MIN) {
        matches = false;
      }
    }
    if (criterion.WEIGHT_MAX !== null && criterion.WEIGHT_MAX !== undefined) {
      requirements.push(`Weight ≤${criterion.WEIGHT_MAX}kg`);
      if (weightValue > criterion.WEIGHT_MAX) {
        matches = false;
      }
    }

    return { 
      matches, 
      confidence: 1.0,
      patientValue: patientValues.join(', ') || 'No BMI/weight data',
      confidenceReason: `Exact numeric comparison. Required: ${requirements.join(', ') || 'N/A'}`
    };
  }

  /**
   * Evaluate comorbidity criterion
   */
  async #evaluateComorbidity(criterion, patientComorbidities) {
    if (!patientComorbidities || !Array.isArray(patientComorbidities)) {
      return { 
        matches: false, 
        confidence: 0.5,
        patientValue: 'No comorbidities reported',
        confidenceReason: 'Missing patient comorbidity data'
      };
    }

    const conditions = criterion.conditions || [criterion];
    const criterionConditions = conditions.map(c => (c.CONDITION_TYPE || []).join(', ')).join('; ');
    const patientConditions = patientComorbidities.map(c => (c.CONDITION_TYPE || []).join(', ')).join('; ');

    for (const condition of conditions) {
      for (const patientCondition of patientComorbidities) {
        // Check condition type match
        const conditionTypes = condition.CONDITION_TYPE || [];
        const patientTypes = patientCondition.CONDITION_TYPE || [];

        if (arraysOverlap(conditionTypes, patientTypes)) {
          // Check pattern if specified
          if (condition.CONDITION_PATTERN && patientCondition.CONDITION_PATTERN) {
            if (!arraysOverlap(condition.CONDITION_PATTERN, patientCondition.CONDITION_PATTERN)) {
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
            confidence: 0.95,
            patientValue: `Patient: ${patientTypes.join(', ')}`,
            confidenceReason: `Direct match with criterion: ${conditionTypes.join(', ')}. 95% due to possible semantic variations.`
          };
        }

        // Try synonym matching
        const synonyms = findSynonyms(patientTypes[0]);
        if (arraysOverlap(conditionTypes, synonyms)) {
          return { 
            matches: true, 
            confidence: 0.85,
            patientValue: `Patient: ${patientTypes.join(', ')}`,
            confidenceReason: `Synonym match. Patient term "${patientTypes[0]}" matched via synonym database to "${conditionTypes.join(', ')}". 85% due to indirect match.`
          };
        }
      }
    }

    // Try AI matching if available and no match found
    if (this.#aiClient && conditions.length > 0 && patientComorbidities.length > 0) {
      const patientTerm = patientComorbidities[0].CONDITION_TYPE?.[0] || '';
      const criterionTerm = conditions[0].CONDITION_TYPE?.[0] || '';

      if (patientTerm && criterionTerm) {
        const aiResult = await this.#aiClient.semanticMatch(
          patientTerm,
          criterionTerm,
          'medical condition'
        );

        if (aiResult.match && aiResult.confidence >= this.#confidenceThresholds.ignore) {
          return {
            matches: true,
            confidence: aiResult.confidence,
            requiresAI: true,
            aiReasoning: aiResult.reasoning,
            patientValue: `Patient: ${patientTerm}`,
            confidenceReason: `AI semantic analysis. Criterion: "${criterionTerm}". ${aiResult.reasoning || ''}`
          };
        }
      }
    }

    return { 
      matches: false, 
      confidence: 0.9,
      patientValue: `Patient conditions: ${patientConditions || 'none'}`,
      confidenceReason: `No match found. Criterion required: ${criterionConditions}. 90% confidence in no-match.`
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
        confidence: 0.5,
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
                  confidence: 0.95,
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
                confidence: 0.9,
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
                confidence: 0.9,
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
      confidence: 0.9,
      needsAdminReview: false,
      patientValue: `Patient treatments: ${patientDrugs || 'none'}`,
      confidenceReason: `No match found. Criterion required: ${criterionDrugs}. 90% confidence in no-match.`
    };
  }

  /**
   * Evaluate infection criterion
   */
  #evaluateInfection(criterion, patientInfections) {
    if (!patientInfections || !Array.isArray(patientInfections)) {
      return { 
        matches: false, 
        confidence: 0.5,
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
            confidence: 0.95,
            patientValue: `Patient infection: ${patientTypes.join(', ')}`,
            confidenceReason: `Direct infection match with: ${infectionTypes.join(', ')}. 95% due to possible semantic variations.`
          };
        }

        // Try synonym matching
        const synonyms = findSynonyms(patientTypes[0]);
        if (arraysOverlap(infectionTypes, synonyms)) {
          return { 
            matches: true, 
            confidence: 0.85,
            patientValue: `Patient infection: ${patientTypes.join(', ')}`,
            confidenceReason: `Synonym match for infection type. 85% due to indirect match.`
          };
        }
      }
    }

    return { 
      matches: false, 
      confidence: 0.9,
      patientValue: `Patient infections: ${patientInfectionTypes || 'none'}`,
      confidenceReason: `No match found. Criterion required: ${criterionInfections}. 90% confidence in no-match.`
    };
  }

  /**
   * Evaluate measurement criterion (BSA, PASI, etc.)
   */
  #evaluateMeasurements(criterion, patientMeasurements) {
    if (!patientMeasurements) {
      return { 
        matches: false, 
        confidence: 0.5,
        patientValue: 'No measurements provided',
        confidenceReason: 'Missing patient measurement data'
      };
    }

    // Check various measurement types
    const measurements = ['BSA', 'PASI', 'IGA', 'DLQI'];
    const patientValues = [];
    const requirements = [];

    for (const type of measurements) {
      const threshold = criterion[`${type}_THRESHOLD`] || criterion[`${type}_MIN`];
      const comparison = criterion[`${type}_COMPARISON`] || '>=';
      const patientValue = patientMeasurements[type]?.value;

      if (patientValue !== null && patientValue !== undefined) {
        patientValues.push(`${type}: ${patientValue}`);
      }
      if (threshold !== null && threshold !== undefined) {
        requirements.push(`${type} ${comparison} ${threshold}`);
        
        if (patientValue !== null && patientValue !== undefined) {
          if (measurementMeetsThreshold(patientValue, threshold, comparison)) {
            return { 
              matches: true, 
              confidence: 1.0,
              patientValue: patientValues.join(', '),
              confidenceReason: `Exact numeric comparison. ${type} ${patientValue} meets ${comparison} ${threshold}`
            };
          }
        }
      }
    }

    return { 
      matches: false, 
      confidence: 0.8,
      patientValue: patientValues.join(', ') || 'No measurements',
      confidenceReason: `No measurement threshold met. Required: ${requirements.join(', ') || 'N/A'}. 80% due to possible missing data.`
    };
  }

  /**
   * Evaluate severity criterion
   */
  #evaluateSeverity(criterion, patientSeverity) {
    if (!patientSeverity) {
      return { 
        matches: false, 
        confidence: 0.5,
        patientValue: 'No severity data provided',
        confidenceReason: 'Missing patient severity data'
      };
    }

    const requiredSeverity = criterion.SEVERITY || criterion.SEVERITY_MIN;
    const patientSeverityValue = patientSeverity.severity || patientSeverity;

    if (severityMatches(requiredSeverity, patientSeverityValue)) {
      return { 
        matches: true, 
        confidence: 0.9,
        patientValue: `Patient severity: ${patientSeverityValue}`,
        confidenceReason: `Severity match. Required: ${requiredSeverity}. 90% due to subjective severity assessment.`
      };
    }

    return { 
      matches: false, 
      confidence: 0.9,
      patientValue: `Patient severity: ${patientSeverityValue}`,
      confidenceReason: `Severity mismatch. Required: ${requiredSeverity}, got: ${patientSeverityValue}. 90% confidence in no-match.`
    };
  }

  /**
   * Evaluate disease duration criterion
   */
  #evaluateDuration(criterion, patientDuration) {
    if (!patientDuration) {
      return { 
        matches: false, 
        confidence: 0.5,
        patientValue: 'No duration data provided',
        confidenceReason: 'Missing patient duration data'
      };
    }

    const minDuration = criterion.DURATION_MIN;
    const minUnit = criterion.DURATION_UNIT || 'months';
    const patientDurationValue = patientDuration.duration;
    const patientUnit = patientDuration.unit || 'months';

    if (minDuration !== null && minDuration !== undefined && patientDurationValue !== null && patientDurationValue !== undefined) {
      // Convert both to weeks for comparison
      const criterionTimeframe = { amount: minDuration, unit: minUnit, relation: 'for' };
      const patientTimeframe = { amount: patientDurationValue, unit: patientUnit };

      if (timeframeMatches(criterionTimeframe, patientTimeframe)) {
        return { 
          matches: true, 
          confidence: 1.0,
          patientValue: `Patient duration: ${patientDurationValue} ${patientUnit}`,
          confidenceReason: `Exact duration comparison. Required: ≥${minDuration} ${minUnit}`
        };
      }
    }

    return { 
      matches: false, 
      confidence: 0.8,
      patientValue: `Patient duration: ${patientDurationValue || 'unknown'} ${patientUnit}`,
      confidenceReason: `Duration insufficient. Required: ≥${minDuration || 'N/A'} ${minUnit}. 80% due to possible unit conversion issues.`
    };
  }

  /**
   * Evaluate variant criterion
   */
  #evaluateVariant(criterion, patientVariant) {
    if (!patientVariant) {
      return { 
        matches: false, 
        confidence: 0.5,
        patientValue: 'No variant data provided',
        confidenceReason: 'Missing patient variant data'
      };
    }

    const variants = criterion.VARIANT_TYPE || [];
    const patientVariantType = patientVariant.variant;

    if (variants.includes(patientVariantType)) {
      return { 
        matches: true, 
        confidence: 1.0,
        patientValue: `Patient variant: ${patientVariantType}`,
        confidenceReason: `Exact variant match. Required: ${variants.join(' or ')}`
      };
    }

    return { 
      matches: false, 
      confidence: 0.9,
      patientValue: `Patient variant: ${patientVariantType || 'unknown'}`,
      confidenceReason: `Variant mismatch. Required: ${variants.join(' or ')}. 90% confidence in no-match.`
    };
  }

  /**
   * Evaluate biomarker criterion
   */
  #evaluateBiomarker(criterion, patientBiomarkers) {
    if (!patientBiomarkers) {
      return { 
        matches: false, 
        confidence: 0.5,
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
          confidence: 1.0,
          patientValue: `${biomarkerType}: ${patientValue}`,
          confidenceReason: `Exact biomarker comparison. ${biomarkerType} ${patientValue} meets ${comparison} ${threshold}`
        };
      }
      return {
        matches: false,
        confidence: 0.9,
        patientValue: `${biomarkerType}: ${patientValue}`,
        confidenceReason: `Biomarker mismatch. Required: ${biomarkerType} ${comparison} ${threshold}`
      };
    }

    return { 
      matches: false, 
      confidence: 0.8,
      patientValue: `${biomarkerType || 'Biomarker'}: not available`,
      confidenceReason: `Biomarker not found in patient data. 80% due to missing data.`
    };
  }

  /**
   * Evaluate flare history criterion
   */
  #evaluateFlare(criterion, patientFlare) {
    if (!patientFlare) {
      return { 
        matches: false, 
        confidence: 0.5,
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
              confidence: 0.95,
              patientValue: `Patient flares: ${patientFlareCount} in ${patientFlare.timeframe.amount || ''} ${patientFlare.timeframe.unit || ''}`,
              confidenceReason: `Flare count match with timeframe. Required: ≥${flareCount} flares. 95% due to timeframe interpretation.`
            };
          }
        } else {
          return { 
            matches: true, 
            confidence: 0.9,
            patientValue: `Patient flares: ${patientFlareCount}`,
            confidenceReason: `Flare count match. Required: ≥${flareCount}. 90% due to missing timeframe.`
          };
        }
      }
    }

    return { 
      matches: false, 
      confidence: 0.8,
      patientValue: `Patient flares: ${patientFlareCount || 'unknown'}`,
      confidenceReason: `Flare count insufficient. Required: ≥${flareCount || 'N/A'}. 80% due to possible missing data.`
    };
  }
}

export default ClinicalTrialMatcher;
