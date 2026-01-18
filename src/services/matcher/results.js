/**
 * Result classes for matching operations
 * @module services/matcher/results
 */

/**
 * Result of matching a patient against a single criterion
 */
export class CriterionMatchResult {
  /**
   * @param {Object} params
   * @param {string} params.criterionId - Criterion ID
   * @param {string} params.nctId - Trial NCT ID
   * @param {boolean} params.matches - Whether criterion matches
   * @param {boolean} [params.requiresAI=false] - Whether AI was used
   * @param {string|null} [params.aiReasoning=null] - AI explanation
   * @param {number} [params.confidence=1.0] - Confidence score (0-1)
   * @param {string} [params.exclusionStrength='exclusion'] - 'inclusion' or 'exclusion'
   * @param {string} [params.rawText=''] - Original criterion text
   * @param {string} [params.patientValue=''] - Patient's value for this criterion
   * @param {string} [params.confidenceReason=''] - Why this confidence was assigned
   * @param {boolean} [params.needsAdminReview=false] - Whether this needs admin review
   * @param {string} [params.matchMethod=''] - How match was made (database, direct_unverified, ai_fallback)
   * @param {Object|null} [params.reviewPayload=null] - Data for admin review
   */
  constructor({
    criterionId,
    nctId,
    matches,
    requiresAI = false,
    aiReasoning = null,
    confidence = 1.0,
    exclusionStrength = 'exclusion',
    rawText = '',
    patientValue = '',
    confidenceReason = '',
    needsAdminReview = false,
    matchMethod = '',
    reviewPayload = null,
  }) {
    this.criterionId = criterionId;
    this.nctId = nctId;
    this.matches = matches;
    this.requiresAI = requiresAI;
    this.aiReasoning = aiReasoning;
    this.confidence = Math.max(0, Math.min(1, confidence));
    this.exclusionStrength = exclusionStrength;
    this.rawText = rawText;
    this.patientValue = patientValue;
    this.confidenceReason = confidenceReason;
    this.needsAdminReview = needsAdminReview;
    this.matchMethod = matchMethod;
    this.reviewPayload = reviewPayload;
  }

  /**
   * Check if this criterion caused ineligibility
   * @returns {boolean} True if criterion makes patient ineligible
   */
  causesIneligibility() {
    if (this.exclusionStrength === 'inclusion') {
      return !this.matches; // Failed inclusion = ineligible
    }
    return this.matches; // Matched exclusion = ineligible
  }

  /**
   * Get human-readable status
   * @returns {string} Status description
   */
  getStatus() {
    if (this.exclusionStrength === 'inclusion') {
      return this.matches ? 'Meets inclusion requirement' : 'Fails inclusion requirement';
    }
    return this.matches ? 'Matches exclusion criterion' : 'Does not match exclusion';
  }

  /**
   * Convert to plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      criterionId: this.criterionId,
      nctId: this.nctId,
      matches: this.matches,
      requiresAI: this.requiresAI,
      aiReasoning: this.aiReasoning,
      confidence: this.confidence,
      exclusionStrength: this.exclusionStrength,
      rawText: this.rawText,
      patientValue: this.patientValue,
      confidenceReason: this.confidenceReason,
      causesIneligibility: this.causesIneligibility(),
      needsAdminReview: this.needsAdminReview,
      matchMethod: this.matchMethod,
      reviewPayload: this.reviewPayload,
    };
  }
}

/**
 * Result of evaluating a patient against a single trial
 */
export class TrialEligibilityResult {
  /**
   * @param {Object} params
   * @param {string} params.nctId - Trial NCT ID
   * @param {'eligible'|'ineligible'|'needs_review'} params.status - Eligibility status
   * @param {CriterionMatchResult[]} [params.matchedCriteria=[]] - All evaluated criteria
   * @param {CriterionMatchResult[]} [params.flaggedCriteria=[]] - Criteria needing review
   * @param {string[]} [params.failureReasons=[]] - Reasons for ineligibility
   */
  constructor({
    nctId,
    status,
    matchedCriteria = [],
    flaggedCriteria = [],
    failureReasons = [],
  }) {
    this.nctId = nctId;
    this.status = status;
    this.matchedCriteria = matchedCriteria;
    this.flaggedCriteria = flaggedCriteria;
    this.failureReasons = failureReasons;
  }

  /**
   * Get overall confidence score
   * @returns {number} Average confidence (0-1)
   */
  getConfidenceScore() {
    if (this.matchedCriteria.length === 0) {
      return 1.0;
    }
    const sum = this.matchedCriteria.reduce((acc, c) => acc + c.confidence, 0);
    return parseFloat((sum / this.matchedCriteria.length).toFixed(3));
  }

  /**
   * Get criteria that caused ineligibility
   * @returns {CriterionMatchResult[]} Criteria causing ineligibility
   */
  getIneligibilityCriteria() {
    return this.matchedCriteria.filter((c) => c.causesIneligibility());
  }

  /**
   * Get failed inclusion criteria
   * @returns {CriterionMatchResult[]} Failed inclusions
   */
  getFailedInclusions() {
    return this.matchedCriteria.filter(
      (c) => c.exclusionStrength === 'inclusion' && !c.matches
    );
  }

  /**
   * Get matched exclusion criteria
   * @returns {CriterionMatchResult[]} Matched exclusions
   */
  getMatchedExclusions() {
    return this.matchedCriteria.filter(
      (c) => c.exclusionStrength !== 'inclusion' && c.matches
    );
  }

  /**
   * Convert to plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      nctId: this.nctId,
      status: this.status,
      confidence: this.getConfidenceScore(),
      totalCriteria: this.matchedCriteria.length,
      flaggedCount: this.flaggedCriteria.length,
      failedInclusions: this.getFailedInclusions().map((c) => c.toJSON()),
      matchedExclusions: this.getMatchedExclusions().map((c) => c.toJSON()),
      failureReasons: this.failureReasons,
    };
  }
}

/**
 * Complete matching results for a patient
 */
export class PatientMatchResults {
  /**
   * @param {Object} params
   * @param {Object} params.patientResponse - Original patient response
   * @param {TrialEligibilityResult[]} [params.eligibleTrials=[]] - Eligible trials
   * @param {TrialEligibilityResult[]} [params.ineligibleTrials=[]] - Ineligible trials
   * @param {TrialEligibilityResult[]} [params.needsReviewTrials=[]] - Trials needing review
   */
  constructor({
    patientResponse,
    eligibleTrials = [],
    ineligibleTrials = [],
    needsReviewTrials = [],
  }) {
    this.timestamp = new Date().toISOString();
    this.patientResponse = patientResponse;
    this.eligibleTrials = eligibleTrials;
    this.ineligibleTrials = ineligibleTrials;
    this.needsReviewTrials = needsReviewTrials;
  }

  /**
   * Get total number of trials evaluated
   * @returns {number} Total trials
   */
  getTotalTrialsEvaluated() {
    return this.eligibleTrials.length + this.ineligibleTrials.length + this.needsReviewTrials.length;
  }

  /**
   * Get summary statistics
   * @returns {Object} Summary stats
   */
  getSummary() {
    return {
      timestamp: this.timestamp,
      totalEvaluated: this.getTotalTrialsEvaluated(),
      eligible: this.eligibleTrials.length,
      ineligible: this.ineligibleTrials.length,
      needsReview: this.needsReviewTrials.length,
      eligibilityRate: this.getTotalTrialsEvaluated() > 0
        ? ((this.eligibleTrials.length / this.getTotalTrialsEvaluated()) * 100).toFixed(1)
        : 0,
    };
  }

  /**
   * Convert to plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      timestamp: this.timestamp,
      summary: this.getSummary(),
      eligibleTrials: this.eligibleTrials.map((t) => t.toJSON()),
      needsReviewTrials: this.needsReviewTrials.map((t) => t.toJSON()),
      ineligibleTrials: this.ineligibleTrials.map((t) => t.toJSON()),
    };
  }
}
