/**
 * CLINICAL TRIAL MATCHER
 * Version: 3.0
 * Date: 2026-01-11
 * 
 * This matcher compares slot-filled patient responses against slot-filled database criteria
 * to determine eligibility for clinical trials. Uses AI reasoning when exact slot matching
 * is not possible.
 */

// ==============================================================================
// IMPORT DATABASE AND AI ENGINE
// ==============================================================================
import SLOT_FILLED_DATABASE from './improved_slot_filled_database.json';
import EnhancedAIMatchingEngine from './EnhancedAIMatchingEngine';

// ==============================================================================
// MATCHING LOGIC CLASSES
// ==============================================================================

/**
 * Represents the result of matching a patient response against a single criterion
 */
class CriterionMatchResult {
  constructor(criterionId, nctId, matches, requiresAI = false, aiReasoning = null, confidence = 1.0) {
    this.criterionId = criterionId;
    this.nctId = nctId;
    this.matches = matches; // true = patient matches this criterion's requirements
                            // For EXCLUSION: matches=true means patient is excluded
                            // For INCLUSION: matches=true means patient meets requirement
    this.requiresAI = requiresAI;
    this.aiReasoning = aiReasoning;
    this.confidence = confidence; // 0.0 to 1.0
  }
}

/**
 * Represents eligibility status for a single trial
 */
class TrialEligibilityResult {
  constructor(nctId, status, matchedCriteria = [], flaggedCriteria = []) {
    this.nctId = nctId;
    this.status = status; // 'eligible', 'ineligible', 'needs_review'
    this.matchedCriteria = matchedCriteria; // Array of CriterionMatchResult
    this.flaggedCriteria = flaggedCriteria; // Criteria that needed AI reasoning
    this.eligibleCriteriaCount = matchedCriteria.filter(c => !c.matches).length;
    this.ineligibleCriteriaCount = matchedCriteria.filter(c => c.matches).length;
  }
  
  getConfidenceScore() {
    if (this.matchedCriteria.length === 0) return 1.0;
    const sum = this.matchedCriteria.reduce((acc, c) => acc + c.confidence, 0);
    return (sum / this.matchedCriteria.length).toFixed(3);
  }
}

// ==============================================================================
// SLOT MATCHING UTILITIES
// ==============================================================================

/**
 * Compare two arrays to see if there's any overlap
 */
function arraysOverlap(arr1, arr2) {
  if (!arr1 || !arr2) return false;
  if (!Array.isArray(arr1)) arr1 = [arr1];
  if (!Array.isArray(arr2)) arr2 = [arr2];
  
  return arr1.some(item1 => 
    arr2.some(item2 => 
      normalizeString(item1) === normalizeString(item2)
    )
  );
}

/**
 * Normalize strings for comparison
 */
function normalizeString(str) {
  if (!str) return '';
  return str.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Check if timeframes match or patient's timeframe is within criterion's timeframe
 */
function timeframeMatches(criterionTimeframe, patientTimeframe) {
  if (!criterionTimeframe && !patientTimeframe) return true;
  if (!criterionTimeframe) return true; // No restriction
  if (!patientTimeframe) return false; // Patient didn't provide timeframe
  
  // Convert both to weeks for comparison
  const criterionWeeks = convertToWeeks(criterionTimeframe);
  const patientWeeks = convertToWeeks(patientTimeframe);
  
  if (criterionTimeframe.relation === 'within') {
    // Patient's timeframe should be within the criterion's window
    return patientWeeks <= criterionWeeks;
  } else if (criterionTimeframe.relation === 'after') {
    return patientWeeks >= criterionWeeks;
  } else if (criterionTimeframe.relation === 'before') {
    return patientWeeks <= criterionWeeks;
  }
  
  return false;
}

/**
 * Convert timeframe to weeks for standardized comparison
 */
function convertToWeeks(timeframe) {
  if (!timeframe || !timeframe.amount) return 0;
  
  const amount = parseInt(timeframe.amount);
  const unit = timeframe.unit?.toLowerCase() || 'weeks';
  
  switch (unit) {
    case 'days': return amount / 7;
    case 'weeks': return amount;
    case 'months': return amount * 4.33; // Average weeks per month
    case 'years': return amount * 52;
    default: return amount;
  }
}

/**
 * Check if severity matches
 */
function severityMatches(criterionSeverity, patientSeverity) {
  if (!criterionSeverity || criterionSeverity === 'none_specified') return true;
  if (!patientSeverity || patientSeverity === 'none_specified') return false;
  
  // Severity hierarchy
  const severityLevels = {
    'mild': 1,
    'moderate': 2,
    'moderate-to-severe': 2.5,
    'severe': 3,
    'significant': 3,
    'serious': 4,
    'major': 4
  };
  
  const criterionLevel = severityLevels[normalizeString(criterionSeverity)] || 2;
  const patientLevel = severityLevels[normalizeString(patientSeverity)] || 2;
  
  return patientLevel >= criterionLevel;
}

/**
 * Check if measurement meets threshold
 */
function measurementMeetsThreshold(measurementType, patientValue, criterionThreshold, comparison) {
  if (!criterionThreshold) return true;
  if (!patientValue) return false;
  
  const value = parseFloat(patientValue);
  const threshold = parseFloat(criterionThreshold);
  
  switch (comparison) {
    case '>=': return value >= threshold;
    case '>': return value > threshold;
    case '<=': return value <= threshold;
    case '<': return value < threshold;
    case '=': return Math.abs(value - threshold) < 0.01;
    default: return false;
  }
}

// ==============================================================================
// NOTE: AI REASONING ENGINE
// ==============================================================================
// The AI matching logic is now handled by EnhancedAIMatchingEngine
// which integrates Claude API with sophisticated rule-based heuristics

// ==============================================================================
// MAIN MATCHER CLASS
// ==============================================================================

class ClinicalTrialMatcher {
  constructor(database = SLOT_FILLED_DATABASE, aiConfig = null) {
    this.database = database;

    // Initialize AI Matching Engine if config provided
    if (aiConfig && aiConfig.apiKey) {
      this.aiEngine = new EnhancedAIMatchingEngine(
        aiConfig.apiKey,
        aiConfig.model || 'claude-sonnet-4-5-20250929',
        aiConfig.confidenceThresholds || { exclude: 0.8, review: 0.5, ignore: 0.3 }
      );
    } else {
      this.aiEngine = null;
    }
  }
  
  /**
   * Match patient response against all trials in database
   */
  async matchPatient(patientResponse) {
    const results = {
      timestamp: new Date().toISOString(),
      patientResponse: patientResponse,
      eligibleTrials: [],
      ineligibleTrials: [],
      needsReviewTrials: [],
      totalTrialsEvaluated: 0
    };
    
    // Get all unique trials from database
    const trials = this.extractAllTrials();
    results.totalTrialsEvaluated = trials.size;
    
    // Evaluate each trial
    for (const nctId of trials) {
      const trialResult = await this.evaluateTrial(nctId, patientResponse);
      
      if (trialResult.status === 'eligible') {
        results.eligibleTrials.push(trialResult);
      } else if (trialResult.status === 'needs_review') {
        results.needsReviewTrials.push(trialResult);
      } else {
        results.ineligibleTrials.push(trialResult);
      }
    }
    
    // Sort by confidence
    results.eligibleTrials.sort((a, b) => b.getConfidenceScore() - a.getConfidenceScore());
    results.needsReviewTrials.sort((a, b) => b.getConfidenceScore() - a.getConfidenceScore());
    
    return results;
  }
  
  /**
   * Extract all unique NCT IDs from database
   */
  extractAllTrials() {
    const trials = new Set();
    
    Object.keys(this.database).forEach(key => {
      if (key.startsWith('CLUSTER_')) {
        const cluster = this.database[key];
        if (cluster.criteria) {
          cluster.criteria.forEach(criterion => {
            trials.add(criterion.nct_id);
          });
        }
      }
    });
    
    return trials;
  }
  
  /**
   * Evaluate patient eligibility for a single trial
   */
  async evaluateTrial(nctId, patientResponse) {
    const matchedCriteria = [];
    const flaggedCriteria = [];
    const inclusionCriteria = [];
    const exclusionCriteria = [];

    // Check each cluster
    for (const clusterKey of Object.keys(this.database)) {
      if (!clusterKey.startsWith('CLUSTER_')) continue;

      const cluster = this.database[clusterKey];
      const criteriaForTrial = cluster.criteria.filter(c => c.nct_id === nctId);

      for (const criterion of criteriaForTrial) {
        const matchResult = await this.evaluateCriterion(
          criterion,
          patientResponse,
          cluster.cluster_code
        );

        matchedCriteria.push(matchResult);

        // Separate inclusion and exclusion criteria
        if (criterion.EXCLUSION_STRENGTH === 'inclusion') {
          inclusionCriteria.push(matchResult);
        } else {
          exclusionCriteria.push(matchResult);
        }

        if (matchResult.requiresAI) {
          flaggedCriteria.push(matchResult);
        }
      }
    }

    // Determine overall eligibility
    // For INCLUSION criteria: patient MUST match (matches = true means eligible)
    // For EXCLUSION criteria: patient must NOT match (matches = true means ineligible)

    const failedInclusions = inclusionCriteria.filter(c => !c.matches);
    const matchedExclusions = exclusionCriteria.filter(c => c.matches);
    const hasLowConfidence = flaggedCriteria.some(c => c.confidence < 0.8);

    let status;
    if ((failedInclusions.length > 0 || matchedExclusions.length > 0) && hasLowConfidence) {
      // Patient failed some criteria AND there's low confidence - needs manual review
      status = 'needs_review';
    } else if (failedInclusions.length > 0) {
      // Patient doesn't meet required inclusion criteria - ineligible
      status = 'ineligible';
    } else if (matchedExclusions.length > 0) {
      // Patient matches exclusion criteria - ineligible
      status = 'ineligible';
    } else {
      // Patient meets all inclusions and avoids all exclusions - eligible
      status = 'eligible';
    }

    return new TrialEligibilityResult(nctId, status, matchedCriteria, flaggedCriteria);
  }
  
  /**
   * Evaluate a single criterion against patient response
   * Note: The "matches" field in CriterionMatchResult means:
   *   - For EXCLUSION criteria: matches=true means patient violates criterion (excluded)
   *   - For INCLUSION criteria: matches=true means patient satisfies criterion (included)
   */
  async evaluateCriterion(criterion, patientResponse, clusterCode) {
    const patientData = patientResponse.responses[clusterCode];
    const isInclusion = criterion.EXCLUSION_STRENGTH === 'inclusion';

    if (!patientData) {
      // Patient didn't provide data for this cluster
      // For EXCLUSION: no data = assume doesn't match exclusion = eligible
      // For INCLUSION: no data = doesn't meet requirement = ineligible
      return new CriterionMatchResult(
        criterion.id,
        criterion.nct_id,
        false, // doesn't match criterion
        false,
        null,
        1.0
      );
    }

    // Evaluate criterion - handle both formats:
    // 1. New format: criterion has conditions array
    // 2. Old format: criterion IS the condition (direct slot fields)

    const conditionsToEvaluate = criterion.conditions && criterion.conditions.length > 0
      ? criterion.conditions
      : [criterion]; // Treat the criterion itself as a condition

    for (const criterionCondition of conditionsToEvaluate) {
      const matchResult = await this.evaluateCondition(
        criterionCondition,
        patientData,
        clusterCode
      );

      if (matchResult.matches) {
        // Patient matches this criterion's requirements
        return new CriterionMatchResult(
          criterion.id,
          criterion.nct_id,
          true, // matches criterion
          matchResult.requiresAI,
          matchResult.aiReasoning,
          matchResult.confidence
        );
      }
    }

    // Patient doesn't match any conditions in this criterion
    return new CriterionMatchResult(
      criterion.id,
      criterion.nct_id,
      false,
      false,
      null,
      1.0
    );
  }
  
  /**
   * Evaluate a single condition against patient data
   */
  async evaluateCondition(criterionCondition, patientData, clusterCode) {
    let matches = false;
    let requiresAI = false;
    let aiReasoning = null;
    let confidence = 1.0;
    
    // Handle different cluster types
    if (clusterCode === 'CMB' || clusterCode === 'AIC') {
      // Comorbid conditions or infections - array of conditions
      if (!Array.isArray(patientData)) {
        patientData = [patientData];
      }
      
      for (const patientCondition of patientData) {
        // Check CONDITION_TYPE / INFECTION_TYPE
        const conditionTypeField = clusterCode === 'AIC' ? 'INFECTION_TYPE' : 'CONDITION_TYPE';
        
        if (arraysOverlap(criterionCondition[conditionTypeField], patientCondition[conditionTypeField])) {
          // Condition type matches - check additional constraints
          
          // Check pattern
          if (criterionCondition.CONDITION_PATTERN && criterionCondition.CONDITION_PATTERN.length > 0) {
            const patternField = clusterCode === 'AIC' ? 'INFECTION_PATTERN' : 'CONDITION_PATTERN';
            if (!arraysOverlap(criterionCondition[patternField], patientCondition[patternField])) {
              continue; // Pattern doesn't match
            }
          }
          
          // Check timeframe
          if (criterionCondition.TIMEFRAME) {
            if (!timeframeMatches(criterionCondition.TIMEFRAME, patientCondition.TIMEFRAME)) {
              continue; // Timeframe doesn't match
            }
          }
          
          // Check severity
          if (criterionCondition.SEVERITY && criterionCondition.SEVERITY !== 'none_specified') {
            if (!severityMatches(criterionCondition.SEVERITY, patientCondition.SEVERITY)) {
              continue; // Severity doesn't match
            }
          }
          
          // Check exception condition
          if (criterionCondition.EXCEPTION_CONDITION) {
            // If exception applies, patient is eligible despite matching
            if (this.evaluateException(criterionCondition.EXCEPTION_CONDITION, patientCondition)) {
              continue;
            }
          }
          
          // All checks passed - this is a match
          matches = true;
          break;
        } else if (this.aiEngine) {
          // No exact match - try AI reasoning
          const aiResult = await this.aiEngine.evaluateMatch(
            patientData,
            criterionCondition,
            patientCondition,
            criterionCondition
          );

          if (aiResult.matches) {
            matches = true;
            requiresAI = true;
            aiReasoning = aiResult.explanation;
            confidence = aiResult.confidence;
            break;
          }
        }
      }
    } else if (clusterCode === 'PTH') {
      // Treatment history
      if (!Array.isArray(patientData)) {
        patientData = [patientData];
      }
      
      for (const patientTreatment of patientData) {
        if (arraysOverlap(criterionCondition.TREATMENT_TYPE, patientTreatment.TREATMENT_TYPE)) {
          // Treatment type matches - check pattern and timeframe
          
          if (criterionCondition.TREATMENT_PATTERN && criterionCondition.TREATMENT_PATTERN.length > 0) {
            if (!arraysOverlap(criterionCondition.TREATMENT_PATTERN, patientTreatment.TREATMENT_PATTERN)) {
              continue;
            }
          }
          
          if (criterionCondition.TIMEFRAME) {
            if (!timeframeMatches(criterionCondition.TIMEFRAME, patientTreatment.TIMEFRAME)) {
              continue;
            }
          }
          
          matches = true;
          break;
        } else if (this.aiEngine) {
          // Try AI matching with drug classification
          const aiResult = await this.aiEngine.evaluateMatch(
            patientData,
            criterionCondition,
            patientTreatment,
            criterionCondition
          );

          if (aiResult.matches) {
            matches = true;
            requiresAI = true;
            aiReasoning = aiResult.explanation;
            confidence = aiResult.confidence;
            break;
          }
        }
      }
    } else if (clusterCode === 'AAO' || clusterCode === 'SEV') {
      // Measurements
      for (const [measureType, measureData] of Object.entries(patientData)) {
        if (criterionCondition.MEASUREMENT_TYPE === measureType) {
          const meetsThreshold = measurementMeetsThreshold(
            measureType,
            measureData.value,
            criterionCondition.THRESHOLD_MIN || criterionCondition.THRESHOLD_MAX,
            criterionCondition.COMPARISON
          );
          
          if (meetsThreshold) {
            matches = true;
            break;
          }
        }
      }
    } else if (clusterCode === 'AGE') {
      // Age check
      const age = patientData.age;
      
      if (criterionCondition.AGE_MIN && age < criterionCondition.AGE_MIN) {
        matches = true;
      }
      
      if (criterionCondition.AGE_MAX && age > criterionCondition.AGE_MAX) {
        matches = true;
      }
    } else if (clusterCode === 'BMI') {
      // BMI check
      const bmi = parseFloat(patientData.bmi);
      
      if (criterionCondition.BMI_MIN && bmi < criterionCondition.BMI_MIN) {
        matches = true;
      }
      
      if (criterionCondition.BMI_MAX && bmi > criterionCondition.BMI_MAX) {
        matches = true;
      }
    }
    
    return { matches, requiresAI, aiReasoning, confidence };
  }
  
  /**
   * Evaluate exception condition
   */
  evaluateException(exceptionCondition, patientData) {
    if (!exceptionCondition.makes_eligible) return false;
    
    // Check if exception conditions are met
    // This would need specific logic based on exception structure
    // For now, return false (exception doesn't apply)
    return false;
  }
}

// ==============================================================================
// REPORT GENERATOR
// ==============================================================================

class MatchReportGenerator {
  static generateReport(matchResults) {
    const report = [];
    
    report.push('═══════════════════════════════════════════════════════════');
    report.push('         CLINICAL TRIAL ELIGIBILITY MATCH REPORT          ');
    report.push('═══════════════════════════════════════════════════════════');
    report.push('');
    report.push(`Timestamp: ${matchResults.timestamp}`);
    report.push(`Total Trials Evaluated: ${matchResults.totalTrialsEvaluated}`);
    report.push(`Eligible Trials: ${matchResults.eligibleTrials.length}`);
    report.push(`Ineligible Trials: ${matchResults.ineligibleTrials.length}`);
    report.push(`Needs Review: ${matchResults.needsReviewTrials.length}`);
    report.push('');
    
    // Eligible Trials
    if (matchResults.eligibleTrials.length > 0) {
      report.push('───────────────────────────────────────────────────────────');
      report.push('✓ ELIGIBLE TRIALS');
      report.push('───────────────────────────────────────────────────────────');
      
      matchResults.eligibleTrials.forEach((trial, idx) => {
        report.push('');
        report.push(`${idx + 1}. ${trial.nctId}`);
        report.push(`   Confidence: ${(trial.getConfidenceScore() * 100).toFixed(1)}%`);
        report.push(`   Criteria Evaluated: ${trial.matchedCriteria.length}`);
        
        if (trial.flaggedCriteria.length > 0) {
          report.push(`   ⚠️  AI-Flagged Criteria: ${trial.flaggedCriteria.length}`);
          trial.flaggedCriteria.forEach(flag => {
            report.push(`      - ${flag.criterionId}: ${flag.aiReasoning}`);
          });
        }
      });
    }
    
    // Needs Review
    if (matchResults.needsReviewTrials.length > 0) {
      report.push('');
      report.push('───────────────────────────────────────────────────────────');
      report.push('⚠️  NEEDS MANUAL REVIEW');
      report.push('───────────────────────────────────────────────────────────');
      
      matchResults.needsReviewTrials.forEach((trial, idx) => {
        report.push('');
        report.push(`${idx + 1}. ${trial.nctId}`);
        report.push(`   Confidence: ${(trial.getConfidenceScore() * 100).toFixed(1)}%`);
        report.push(`   Flagged Criteria: ${trial.flaggedCriteria.length}`);
        
        trial.flaggedCriteria.forEach(flag => {
          report.push(`   - ${flag.criterionId}`);
          report.push(`     Reasoning: ${flag.aiReasoning}`);
          report.push(`     Confidence: ${(flag.confidence * 100).toFixed(1)}%`);
        });
      });
    }
    
    // Ineligible Trials (summary only)
    if (matchResults.ineligibleTrials.length > 0) {
      report.push('');
      report.push('───────────────────────────────────────────────────────────');
      report.push('✗ INELIGIBLE TRIALS (Summary)');
      report.push('───────────────────────────────────────────────────────────');
      report.push('');
      
      const ineligibleSummary = matchResults.ineligibleTrials.slice(0, 5);
      ineligibleSummary.forEach((trial, idx) => {
        const exclusions = trial.matchedCriteria.filter(c => c.matches);
        report.push(`${idx + 1}. ${trial.nctId} - ${exclusions.length} exclusion(s) matched`);
      });
      
      if (matchResults.ineligibleTrials.length > 5) {
        report.push(`... and ${matchResults.ineligibleTrials.length - 5} more ineligible trials`);
      }
    }
    
    report.push('');
    report.push('═══════════════════════════════════════════════════════════');
    
    return report.join('\n');
  }
  
  static generateJSONReport(matchResults) {
    return JSON.stringify({
      summary: {
        timestamp: matchResults.timestamp,
        totalTrialsEvaluated: matchResults.totalTrialsEvaluated,
        eligible: matchResults.eligibleTrials.length,
        ineligible: matchResults.ineligibleTrials.length,
        needsReview: matchResults.needsReviewTrials.length
      },
      eligibleTrials: matchResults.eligibleTrials.map(t => ({
        nctId: t.nctId,
        confidence: t.getConfidenceScore(),
        criteriaEvaluated: t.matchedCriteria.length,
        flaggedCount: t.flaggedCriteria.length,
        flaggedCriteria: t.flaggedCriteria.map(f => ({
          id: f.criterionId,
          reasoning: f.aiReasoning,
          confidence: f.confidence
        }))
      })),
      needsReview: matchResults.needsReviewTrials.map(t => ({
        nctId: t.nctId,
        confidence: t.getConfidenceScore(),
        flaggedCriteria: t.flaggedCriteria.map(f => ({
          id: f.criterionId,
          reasoning: f.aiReasoning,
          confidence: f.confidence
        }))
      })),
      ineligibleTrials: matchResults.ineligibleTrials.map(t => ({
        nctId: t.nctId,
        exclusionCount: t.ineligibleCriteriaCount,
        matchedExclusions: t.matchedCriteria
          .filter(c => c.matches)
          .map(c => c.criterionId)
      }))
    }, null, 2);
  }
}

// ==============================================================================
// USAGE EXAMPLE
// ==============================================================================

async function runMatcher(patientResponse) {
  console.log('Starting Clinical Trial Matcher...\n');
  
  const matcher = new ClinicalTrialMatcher();
  const results = await matcher.matchPatient(patientResponse);
  
  // Generate text report
  const textReport = MatchReportGenerator.generateReport(results);
  console.log(textReport);
  
  // Generate JSON report
  const jsonReport = MatchReportGenerator.generateJSONReport(results);
  
  return {
    textReport,
    jsonReport,
    results
  };
}

// Export for use in React components
export { ClinicalTrialMatcher, MatchReportGenerator, runMatcher };
export default ClinicalTrialMatcher;

// Example patient response format
const EXAMPLE_PATIENT_RESPONSE = {
  "timestamp": "2026-01-11T10:30:00Z",
  "version": "3.0",
  "responses": {
    "CMB": [
      {
        "CONDITION_TYPE": ["depression"],
        "CONDITION_PATTERN": ["current"],
        "SEVERITY": "moderate",
        "TIMEFRAME": null,
        "ANATOMICAL_LOCATION": []
      }
    ],
    "PTH": [
      {
        "TREATMENT_TYPE": ["humira"],
        "TREATMENT_PATTERN": ["used previously"],
        "TIMEFRAME": {
          "relation": "within",
          "amount": 12,
          "unit": "weeks",
          "reference": "last use"
        },
        "DRUG_CLASSIFICATION": {
          "drug_class": "TNF inhibitor",
          "mechanism": "Anti-TNFα",
          "is_tnf": true,
          "is_biologic": true,
          "aliases": ["adalimumab"]
        }
      }
    ],
    "AGE": {
      "age": 45
    },
    "AAO": {
      "BSA": { "value": 15, "threshold": null },
      "PASI": { "value": 18, "threshold": null }
    },
    "BMI": {
      "weight": { "value": 75, "unit": "kg" },
      "height": { "value": 175, "unit": "cm" },
      "bmi": 24.49
    }
  }
};
