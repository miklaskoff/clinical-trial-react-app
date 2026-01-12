/**
 * AI Semantic Matching Service
 * Uses Anthropic Claude API for semantic similarity analysis when exact matching fails
 */

class AISemanticMatcher {
  constructor(apiKey, modelPreference = 'claude-sonnet-4-5-20250929') {
    this.apiKey = apiKey;
    this.apiUrl = 'https://api.anthropic.com/v1/messages';
    this.model = modelPreference; // Can be sonnet, opus, or haiku
    this.cache = new Map(); // Cache for reducing API calls
  }

  /**
   * Generate a cache key for matching queries
   */
  getCacheKey(patientTerm, criterionTerm) {
    return `${patientTerm.toLowerCase()}::${criterionTerm.toLowerCase()}`;
  }

  /**
   * Perform semantic matching using Claude API
   * @param {string} patientTerm - Patient's condition/treatment
   * @param {string} criterionTerm - Trial criterion condition/treatment
   * @param {string} context - Additional context (e.g., "medical condition", "treatment")
   * @returns {Promise<{match: boolean, confidence: number, reasoning: string}>}
   */
  async semanticMatch(patientTerm, criterionTerm, context = 'medical term') {
    // Check cache first
    const cacheKey = this.getCacheKey(patientTerm, criterionTerm);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const prompt = this.buildMatchingPrompt(patientTerm, criterionTerm, context);
      const response = await this.callClaude(prompt);
      const result = this.parseResponse(response);

      // Cache the result
      this.cache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error('AI Semantic Matching Error:', error);
      return {
        match: false,
        confidence: 0,
        reasoning: `Error: ${error.message}`,
        error: true
      };
    }
  }

  /**
   * Build the prompt for semantic matching
   */
  buildMatchingPrompt(patientTerm, criterionTerm, context) {
    return `You are a medical expert AI assistant specializing in clinical trial eligibility matching.

Task: Determine if a patient's ${context} semantically matches a clinical trial exclusion criterion.

Patient's ${context}: "${patientTerm}"
Trial Criterion ${context}: "${criterionTerm}"

Instructions:
1. Analyze if these terms are semantically equivalent or if the patient's term falls under the trial criterion
2. Consider medical synonyms, related conditions, and clinical relationships
3. Provide a confidence score between 0.0 and 1.0:
   - 0.9-1.0: Very strong match (e.g., exact synonym or direct relationship)
   - 0.7-0.89: Strong match (e.g., closely related or typically associated)
   - 0.5-0.69: Moderate match (e.g., potentially related, needs review)
   - 0.3-0.49: Weak match (e.g., distantly related)
   - 0.0-0.29: No meaningful match

Respond ONLY with valid JSON in this exact format:
{
  "match": true/false,
  "confidence": 0.X,
  "reasoning": "Brief explanation of the medical relationship"
}

Example responses:
- For "diabetes type 2" vs "diabetes mellitus": {"match": true, "confidence": 0.95, "reasoning": "Type 2 diabetes is a form of diabetes mellitus"}
- For "depression" vs "psychoneuro-related disease": {"match": true, "confidence": 0.85, "reasoning": "Depression is a psychoneurological disorder"}
- For "headache" vs "cancer": {"match": false, "confidence": 0.1, "reasoning": "No meaningful medical relationship"}

Now analyze the terms provided above:`;
  }

  /**
   * Call Anthropic Claude API
   */
  async callClaude(prompt) {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 500,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  /**
   * Parse OpenAI response
   */
  parseResponse(responseText) {
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate response structure
      if (typeof parsed.match !== 'boolean' ||
          typeof parsed.confidence !== 'number' ||
          typeof parsed.reasoning !== 'string') {
        throw new Error('Invalid response structure');
      }

      // Ensure confidence is in valid range
      parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

      return parsed;
    } catch (error) {
      console.error('Failed to parse AI response:', error, responseText);
      return {
        match: false,
        confidence: 0,
        reasoning: 'Failed to parse AI response',
        error: true
      };
    }
  }

  /**
   * Batch matching for multiple terms
   */
  async batchSemanticMatch(matches) {
    const results = [];

    // Process sequentially to avoid rate limits
    for (const match of matches) {
      const result = await this.semanticMatch(
        match.patientTerm,
        match.criterionTerm,
        match.context
      );
      results.push({
        ...match,
        ...result
      });

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

export default AISemanticMatcher;
