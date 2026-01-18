/**
 * AI Fallback Handler for cluster-specific semantic matching
 * @module services/matcher/AIFallbackHandler
 */

/**
 * Cluster-specific prompts for AI fallback matching
 */
const CLUSTER_PROMPTS = {
  PTH: {
    systemPrompt: `You are a clinical pharmacology expert. Analyze whether a patient's treatment matches the clinical trial criterion.
Consider drug classes, mechanisms, synonyms, and related treatments.
Return JSON: { "matches": boolean, "confidence": number (0.7-0.95), "reasoning": string, "suggestedClass": string }`,
    userPromptTemplate: (patientDrug, criterionDrugs, rawText) =>
      `Patient reports using: "${patientDrug}"
Criterion drugs/classes: ${JSON.stringify(criterionDrugs)}
Original criterion: "${rawText}"

Does the patient's treatment match this criterion? Consider drug synonyms, brand/generic names, and drug classes.`,
  },

  CMB: {
    systemPrompt: `You are a medical expert. Analyze whether a patient's condition matches the clinical trial criterion.
Consider medical synonyms, related conditions, and severity.
Return JSON: { "matches": boolean, "confidence": number (0.7-0.95), "reasoning": string }`,
    userPromptTemplate: (patientCondition, criterionConditions, rawText) =>
      `Patient reports: "${patientCondition}"
Criterion conditions: ${JSON.stringify(criterionConditions)}
Original criterion: "${rawText}"

Does the patient's condition match this criterion?`,
  },

  SEV: {
    systemPrompt: `You are a dermatology expert specializing in psoriasis severity assessment.
Analyze whether patient's severity matches the trial criterion.
Return JSON: { "matches": boolean, "confidence": number (0.7-0.95), "reasoning": string }`,
    userPromptTemplate: (patientSeverity, criterionSeverity, rawText) =>
      `Patient severity data: ${JSON.stringify(patientSeverity)}
Required severity: ${JSON.stringify(criterionSeverity)}
Original criterion: "${rawText}"

Does the patient meet this severity requirement?`,
  },

  AIC: {
    systemPrompt: `You are an infectious disease expert.
Analyze whether patient's infection status matches the trial criterion.
Return JSON: { "matches": boolean, "confidence": number (0.7-0.95), "reasoning": string }`,
    userPromptTemplate: (patientInfection, criterionInfection, rawText) =>
      `Patient infection data: ${JSON.stringify(patientInfection)}
Criterion requirement: ${JSON.stringify(criterionInfection)}
Original criterion: "${rawText}"

Does the patient match this infection criterion?`,
  },

  DEFAULT: {
    systemPrompt: `You are a clinical trial eligibility expert.
Analyze whether patient data matches the criterion requirement.
Return JSON: { "matches": boolean, "confidence": number (0.7-0.95), "reasoning": string }`,
    userPromptTemplate: (patientData, criterionData, rawText) =>
      `Patient data: ${JSON.stringify(patientData)}
Criterion requirement: ${JSON.stringify(criterionData)}
Original criterion: "${rawText}"

Does the patient match this criterion?`,
  },
};

/**
 * AI Fallback Handler for semantic matching when rule-based matching fails
 */
export class AIFallbackHandler {
  #claudeClient;
  #enabled;

  /**
   * @param {Object} options
   * @param {Object} options.claudeClient - ClaudeAPIClient instance
   * @param {boolean} [options.enabled=true] - Whether AI fallback is enabled
   */
  constructor({ claudeClient, enabled = true }) {
    this.#claudeClient = claudeClient;
    this.#enabled = enabled;
  }

  /**
   * Check if AI fallback is available
   * @returns {boolean}
   */
  isEnabled() {
    return this.#enabled && this.#claudeClient !== null;
  }

  /**
   * Get cluster-specific prompts
   * @param {string} clusterCode - Cluster code (PTH, CMB, etc.)
   * @returns {Object} Prompt configuration
   */
  getClusterPrompts(clusterCode) {
    return CLUSTER_PROMPTS[clusterCode] || CLUSTER_PROMPTS.DEFAULT;
  }

  /**
   * Perform AI fallback matching for treatment history
   * @param {string} patientDrug - Drug the patient reported
   * @param {string[]} criterionDrugs - Drugs in the criterion
   * @param {string} rawText - Original criterion text
   * @param {Object} criterion - Full criterion object
   * @returns {Promise<Object>} Match result with AI reasoning
   */
  async matchTreatmentHistory(patientDrug, criterionDrugs, rawText, criterion) {
    if (!this.isEnabled()) {
      return {
        matches: false,
        confidence: 0.5,
        requiresAI: true,
        aiReasoning: 'AI fallback not available',
        needsAdminReview: true,
        matchMethod: 'ai_unavailable',
      };
    }

    try {
      const prompts = this.getClusterPrompts('PTH');
      const userPrompt = prompts.userPromptTemplate(patientDrug, criterionDrugs, rawText);

      const result = await this.#claudeClient.semanticMatch(
        patientDrug,
        criterionDrugs.join(', '),
        { context: rawText }
      );

      return {
        matches: result.matches,
        confidence: Math.min(result.confidence, 0.9), // Cap AI confidence at 0.9
        requiresAI: true,
        aiReasoning: result.reasoning || 'AI-based match',
        needsAdminReview: true, // Always flag AI results for review
        matchMethod: 'ai_fallback',
        reviewPayload: {
          drugName: patientDrug,
          criterionId: criterion.id,
          nctId: criterion.nct_id,
          aiSuggestion: {
            class: result.suggestedClass || 'Unknown',
            confidence: result.confidence,
            reasoning: result.reasoning,
          },
        },
      };
    } catch (error) {
      console.error('AI fallback error:', error);
      return {
        matches: false,
        confidence: 0.5,
        requiresAI: true,
        aiReasoning: `AI error: ${error.message}`,
        needsAdminReview: true,
        matchMethod: 'ai_error',
      };
    }
  }

  /**
   * Perform AI fallback matching for comorbidities
   * @param {Object} patientCondition - Patient's condition data
   * @param {Object} criterionCondition - Criterion condition requirements
   * @param {string} rawText - Original criterion text
   * @param {Object} criterion - Full criterion object
   * @returns {Promise<Object>} Match result with AI reasoning
   */
  async matchComorbidity(patientCondition, criterionCondition, rawText, criterion) {
    if (!this.isEnabled()) {
      return {
        matches: false,
        confidence: 0.5,
        requiresAI: true,
        aiReasoning: 'AI fallback not available',
      };
    }

    try {
      const patientValue = patientCondition.CONDITION_TYPE?.join(', ') || JSON.stringify(patientCondition);
      const criterionValue = criterionCondition.CONDITION_TYPE?.join(', ') || JSON.stringify(criterionCondition);

      const result = await this.#claudeClient.semanticMatch(
        patientValue,
        criterionValue,
        { context: rawText }
      );

      return {
        matches: result.matches,
        confidence: Math.min(result.confidence, 0.9),
        requiresAI: true,
        aiReasoning: result.reasoning || 'AI-based comorbidity match',
      };
    } catch (error) {
      console.error('AI fallback error for comorbidity:', error);
      return {
        matches: false,
        confidence: 0.5,
        requiresAI: true,
        aiReasoning: `AI error: ${error.message}`,
      };
    }
  }

  /**
   * Perform AI fallback matching for severity assessment
   * @param {Object} patientSeverity - Patient's severity data
   * @param {Object} criterionSeverity - Criterion severity requirements
   * @param {string} rawText - Original criterion text
   * @param {Object} criterion - Full criterion object
   * @returns {Promise<Object>} Match result with AI reasoning
   */
  async matchSeverity(patientSeverity, criterionSeverity, rawText, criterion) {
    if (!this.isEnabled()) {
      return {
        matches: false,
        confidence: 0.5,
        requiresAI: true,
        aiReasoning: 'AI fallback not available',
      };
    }

    try {
      const result = await this.#claudeClient.semanticMatch(
        JSON.stringify(patientSeverity),
        JSON.stringify(criterionSeverity),
        { context: rawText }
      );

      return {
        matches: result.matches,
        confidence: Math.min(result.confidence, 0.9),
        requiresAI: true,
        aiReasoning: result.reasoning || 'AI-based severity match',
      };
    } catch (error) {
      console.error('AI fallback error for severity:', error);
      return {
        matches: false,
        confidence: 0.5,
        requiresAI: true,
        aiReasoning: `AI error: ${error.message}`,
      };
    }
  }

  /**
   * Perform AI fallback matching for active infections
   * @param {Object} patientInfection - Patient's infection data
   * @param {Object} criterionInfection - Criterion infection requirements
   * @param {string} rawText - Original criterion text
   * @param {Object} criterion - Full criterion object
   * @returns {Promise<Object>} Match result with AI reasoning
   */
  async matchInfection(patientInfection, criterionInfection, rawText, criterion) {
    if (!this.isEnabled()) {
      return {
        matches: false,
        confidence: 0.5,
        requiresAI: true,
        aiReasoning: 'AI fallback not available',
      };
    }

    try {
      const result = await this.#claudeClient.semanticMatch(
        JSON.stringify(patientInfection),
        JSON.stringify(criterionInfection),
        { context: rawText }
      );

      return {
        matches: result.matches,
        confidence: Math.min(result.confidence, 0.9),
        requiresAI: true,
        aiReasoning: result.reasoning || 'AI-based infection match',
      };
    } catch (error) {
      console.error('AI fallback error for infection:', error);
      return {
        matches: false,
        confidence: 0.5,
        requiresAI: true,
        aiReasoning: `AI error: ${error.message}`,
      };
    }
  }

  /**
   * Generic AI fallback for any cluster
   * @param {string} clusterCode - Cluster code
   * @param {Object} patientData - Patient's data for this cluster
   * @param {Object} criterionData - Criterion requirements
   * @param {string} rawText - Original criterion text
   * @param {Object} criterion - Full criterion object
   * @returns {Promise<Object>} Match result with AI reasoning
   */
  async matchGeneric(clusterCode, patientData, criterionData, rawText, criterion) {
    if (!this.isEnabled()) {
      return {
        matches: false,
        confidence: 0.5,
        requiresAI: true,
        aiReasoning: 'AI fallback not available',
      };
    }

    try {
      const result = await this.#claudeClient.semanticMatch(
        JSON.stringify(patientData),
        JSON.stringify(criterionData),
        { context: rawText }
      );

      return {
        matches: result.matches,
        confidence: Math.min(result.confidence, 0.9),
        requiresAI: true,
        aiReasoning: result.reasoning || `AI-based ${clusterCode} match`,
      };
    } catch (error) {
      console.error(`AI fallback error for ${clusterCode}:`, error);
      return {
        matches: false,
        confidence: 0.5,
        requiresAI: true,
        aiReasoning: `AI error: ${error.message}`,
      };
    }
  }
}

export default AIFallbackHandler;
