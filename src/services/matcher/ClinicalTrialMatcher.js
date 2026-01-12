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
import { drugsMatch, drugBelongsToClass, findSynonyms } from './drugDatabase.js';
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
    } catch (error) {
      console.error(`Error evaluating criterion ${criterion.id}:`, error);
      matches = false;
      confidence = 0.5;
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
      return { matches: false, confidence: 0.5 };
    }

    const age = patientAge.age;
    const minAge = criterion.AGE_MIN;
    const maxAge = criterion.AGE_MAX;

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
    return { matches, confidence: 1.0 };
  }

  /**
   * Evaluate BMI/weight criterion
   */
  #evaluateBMI(criterion, patientBMI) {
    if (!patientBMI) {
      return { matches: false, confidence: 0.5 };
    }

    let matches = true;

    // Check BMI
    if (criterion.BMI_MIN !== null && criterion.BMI_MIN !== undefined && patientBMI.bmi < criterion.BMI_MIN) {
      matches = false;
    }
    if (criterion.BMI_MAX !== null && criterion.BMI_MAX !== undefined && patientBMI.bmi > criterion.BMI_MAX) {
      matches = false;
    }

    // Check weight
    const weightValue = patientBMI.weight?.value || patientBMI.weight;
    if (criterion.WEIGHT_MIN !== null && criterion.WEIGHT_MIN !== undefined && weightValue < criterion.WEIGHT_MIN) {
      matches = false;
    }
    if (criterion.WEIGHT_MAX !== null && criterion.WEIGHT_MAX !== undefined && weightValue > criterion.WEIGHT_MAX) {
      matches = false;
    }

    return { matches, confidence: 1.0 };
  }

  /**
   * Evaluate comorbidity criterion
   */
  async #evaluateComorbidity(criterion, patientComorbidities) {
    if (!patientComorbidities || !Array.isArray(patientComorbidities)) {
      return { matches: false, confidence: 0.5 };
    }

    const conditions = criterion.conditions || [criterion];

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

          return { matches: true, confidence: 0.95 };
        }

        // Try synonym matching
        const synonyms = findSynonyms(patientTypes[0]);
        if (arraysOverlap(conditionTypes, synonyms)) {
          return { matches: true, confidence: 0.85 };
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
          };
        }
      }
    }

    return { matches: false, confidence: 0.9 };
  }

  /**
   * Evaluate treatment history criterion
   */
  #evaluateTreatmentHistory(criterion, patientTreatments) {
    if (!patientTreatments || !Array.isArray(patientTreatments)) {
      return { matches: false, confidence: 0.5 };
    }

    const conditions = criterion.conditions || [criterion];

    for (const condition of conditions) {
      for (const patientTreatment of patientTreatments) {
        // Check treatment type match
        const treatmentTypes = condition.TREATMENT_TYPE || [];
        const patientTypes = patientTreatment.TREATMENT_TYPE || [];

        // Direct match
        if (arraysOverlap(treatmentTypes, patientTypes)) {
          // Check timeframe if specified
          if (condition.TIMEFRAME && patientTreatment.TIMEFRAME) {
            if (!timeframeMatches(condition.TIMEFRAME, patientTreatment.TIMEFRAME)) {
              continue;
            }
          }
          return { matches: true, confidence: 0.95 };
        }

        // Drug name match
        for (const criterionDrug of treatmentTypes) {
          for (const patientDrug of patientTypes) {
            if (drugsMatch(criterionDrug, patientDrug)) {
              return { matches: true, confidence: 0.95 };
            }
          }
        }

        // Drug class match
        const drugClass = condition.TREATMENT_PATTERN?.[0] || '';
        if (drugClass) {
          for (const patientDrug of patientTypes) {
            if (drugBelongsToClass(patientDrug, drugClass)) {
              return { matches: true, confidence: 0.9 };
            }
          }
        }
      }
    }

    return { matches: false, confidence: 0.9 };
  }

  /**
   * Evaluate infection criterion
   */
  #evaluateInfection(criterion, patientInfections) {
    if (!patientInfections || !Array.isArray(patientInfections)) {
      return { matches: false, confidence: 0.5 };
    }

    const conditions = criterion.conditions || [criterion];

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

          return { matches: true, confidence: 0.95 };
        }

        // Try synonym matching
        const synonyms = findSynonyms(patientTypes[0]);
        if (arraysOverlap(infectionTypes, synonyms)) {
          return { matches: true, confidence: 0.85 };
        }
      }
    }

    return { matches: false, confidence: 0.9 };
  }

  /**
   * Evaluate measurement criterion (BSA, PASI, etc.)
   */
  #evaluateMeasurements(criterion, patientMeasurements) {
    if (!patientMeasurements) {
      return { matches: false, confidence: 0.5 };
    }

    // Check various measurement types
    const measurements = ['BSA', 'PASI', 'IGA', 'DLQI'];

    for (const type of measurements) {
      const threshold = criterion[`${type}_THRESHOLD`] || criterion[`${type}_MIN`];
      const comparison = criterion[`${type}_COMPARISON`] || '>=';
      const patientValue = patientMeasurements[type]?.value;

      if (threshold !== null && threshold !== undefined && patientValue !== null && patientValue !== undefined) {
        if (measurementMeetsThreshold(patientValue, threshold, comparison)) {
          return { matches: true, confidence: 1.0 };
        }
      }
    }

    return { matches: false, confidence: 0.8 };
  }

  /**
   * Evaluate severity criterion
   */
  #evaluateSeverity(criterion, patientSeverity) {
    if (!patientSeverity) {
      return { matches: false, confidence: 0.5 };
    }

    const requiredSeverity = criterion.SEVERITY || criterion.SEVERITY_MIN;
    const patientSeverityValue = patientSeverity.severity || patientSeverity;

    if (severityMatches(requiredSeverity, patientSeverityValue)) {
      return { matches: true, confidence: 0.9 };
    }

    return { matches: false, confidence: 0.9 };
  }

  /**
   * Evaluate disease duration criterion
   */
  #evaluateDuration(criterion, patientDuration) {
    if (!patientDuration) {
      return { matches: false, confidence: 0.5 };
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
        return { matches: true, confidence: 1.0 };
      }
    }

    return { matches: false, confidence: 0.8 };
  }

  /**
   * Evaluate variant criterion
   */
  #evaluateVariant(criterion, patientVariant) {
    if (!patientVariant) {
      return { matches: false, confidence: 0.5 };
    }

    const variants = criterion.VARIANT_TYPE || [];
    const patientVariantType = patientVariant.variant;

    if (variants.includes(patientVariantType)) {
      return { matches: true, confidence: 1.0 };
    }

    return { matches: false, confidence: 0.9 };
  }

  /**
   * Evaluate biomarker criterion
   */
  #evaluateBiomarker(criterion, patientBiomarkers) {
    if (!patientBiomarkers) {
      return { matches: false, confidence: 0.5 };
    }

    const biomarkerType = criterion.BIOMARKER_TYPE;
    const threshold = criterion.THRESHOLD;
    const comparison = criterion.COMPARISON || '>=';

    if (biomarkerType && patientBiomarkers[biomarkerType]) {
      const patientValue = patientBiomarkers[biomarkerType];
      if (measurementMeetsThreshold(patientValue, threshold, comparison)) {
        return { matches: true, confidence: 1.0 };
      }
    }

    return { matches: false, confidence: 0.8 };
  }

  /**
   * Evaluate flare history criterion
   */
  #evaluateFlare(criterion, patientFlare) {
    if (!patientFlare) {
      return { matches: false, confidence: 0.5 };
    }

    const flareCount = criterion.FLARE_COUNT;
    const timeframe = criterion.TIMEFRAME;
    const patientFlareCount = patientFlare.count;

    if (flareCount !== null && flareCount !== undefined && patientFlareCount !== null && patientFlareCount !== undefined) {
      if (patientFlareCount >= flareCount) {
        if (timeframe && patientFlare.timeframe) {
          if (timeframeMatches(timeframe, patientFlare.timeframe)) {
            return { matches: true, confidence: 0.95 };
          }
        } else {
          return { matches: true, confidence: 0.9 };
        }
      }
    }

    return { matches: false, confidence: 0.8 };
  }
}

export default ClinicalTrialMatcher;
