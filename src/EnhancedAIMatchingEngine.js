/**
 * ENHANCED AI MATCHING ENGINE
 * Integrates Claude API with sophisticated slot-based matching
 * Combines rule-based heuristics with real AI semantic analysis
 */

import AISemanticMatcher from './aiSemanticMatcher';

/**
 * Normalize strings for comparison
 */
function normalizeString(str) {
  if (!str) return '';
  return str.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Enhanced AI Matching Engine with Claude API Integration
 */
class EnhancedAIMatchingEngine {
  constructor(apiKey, modelPreference = 'claude-sonnet-4-5-20250929', confidenceThresholds = null) {
    this.claudeAPI = apiKey ? new AISemanticMatcher(apiKey, modelPreference) : null;
    this.confidenceThresholds = confidenceThresholds || {
      exclude: 0.8,
      review: 0.5,
      ignore: 0.3
    };

    // Medical synonym dictionary (fallback for when API is not available)
    this.synonyms = {
      'depression': ['major depressive disorder', 'clinical depression', 'depressive episode', 'mdd'],
      'heart failure': ['cardiac insufficiency', 'congestive heart failure', 'CHF', 'cardiac failure'],
      'myocardial infarction': ['heart attack', 'MI', 'cardiac infarction', 'AMI', 'acute MI'],
      'stroke': ['cerebrovascular accident', 'CVA', 'brain attack', 'cerebral infarction'],
      'diabetes': ['diabetes mellitus', 'type 1 diabetes', 'type 2 diabetes', 'DM', 't1dm', 't2dm'],
      'tuberculosis': ['TB', 'mycobacterium tuberculosis infection', 'pulmonary TB'],
      'hepatitis b': ['hep b', 'HBV', 'hepatitis B infection', 'hepatitis B virus'],
      'hepatitis c': ['hep c', 'HCV', 'hepatitis C infection', 'hepatitis C virus'],
      'hypertension': ['high blood pressure', 'HTN', 'elevated blood pressure'],
      'hyperlipidemia': ['high cholesterol', 'dyslipidemia', 'elevated lipids'],
      'cancer': ['malignancy', 'malignant tumor', 'malignant neoplasm', 'carcinoma'],
      'psoriasis': ['plaque psoriasis', 'psoriatic disease'],
      'rheumatoid arthritis': ['RA', 'rheumatoid disease'],
      'crohn\'s disease': ['crohns', 'inflammatory bowel disease', 'IBD'],
      'ulcerative colitis': ['UC', 'inflammatory bowel disease', 'IBD']
    };

    // Drug classification keywords
    this.drugClassKeywords = {
      biologics: ['biologic', 'monoclonal antibody', 'fusion protein', 'mab'],
      tnf: ['tnf', 'tumor necrosis factor', 'anti-tnf', 'tnf inhibitor', 'tnf-alpha'],
      il17: ['il-17', 'il17', 'interleukin-17', 'interleukin 17'],
      il23: ['il-23', 'il23', 'interleukin-23', 'interleukin 23'],
      il12: ['il-12', 'il12', 'interleukin-12', 'interleukin 12']
    };

    // Common drug name mappings
    this.drugAliases = {
      'humira': { generic: 'adalimumab', class: 'TNF inhibitor', is_tnf: true, is_biologic: true },
      'adalimumab': { aliases: ['humira'], class: 'TNF inhibitor', is_tnf: true, is_biologic: true },
      'enbrel': { generic: 'etanercept', class: 'TNF inhibitor', is_tnf: true, is_biologic: true },
      'etanercept': { aliases: ['enbrel'], class: 'TNF inhibitor', is_tnf: true, is_biologic: true },
      'remicade': { generic: 'infliximab', class: 'TNF inhibitor', is_tnf: true, is_biologic: true },
      'infliximab': { aliases: ['remicade'], class: 'TNF inhibitor', is_tnf: true, is_biologic: true },
      'cosentyx': { generic: 'secukinumab', class: 'IL-17 inhibitor', is_il17: true, is_biologic: true },
      'secukinumab': { aliases: ['cosentyx'], class: 'IL-17 inhibitor', is_il17: true, is_biologic: true },
      'taltz': { generic: 'ixekizumab', class: 'IL-17 inhibitor', is_il17: true, is_biologic: true },
      'ixekizumab': { aliases: ['taltz'], class: 'IL-17 inhibitor', is_il17: true, is_biologic: true },
      'skyrizi': { generic: 'risankizumab', class: 'IL-23 inhibitor', is_il23: true, is_biologic: true },
      'risankizumab': { aliases: ['skyrizi'], class: 'IL-23 inhibitor', is_il23: true, is_biologic: true },
      'tremfya': { generic: 'guselkumab', class: 'IL-23 inhibitor', is_il23: true, is_biologic: true },
      'guselkumab': { aliases: ['tremfya'], class: 'IL-23 inhibitor', is_il23: true, is_biologic: true },
      'stelara': { generic: 'ustekinumab', class: 'IL-12/23 inhibitor', is_il12: true, is_il23: true, is_biologic: true },
      'ustekinumab': { aliases: ['stelara'], class: 'IL-12/23 inhibitor', is_il12: true, is_il23: true, is_biologic: true },
      'methotrexate': { class: 'DMARD', is_biologic: false },
      'cyclosporine': { class: 'Immunosuppressant', is_biologic: false },
      'apremilast': { aliases: ['otezla'], class: 'PDE4 inhibitor', is_biologic: false },
      'otezla': { generic: 'apremilast', class: 'PDE4 inhibitor', is_biologic: false }
    };
  }

  /**
   * Main evaluation method - tries rule-based first, then Claude API
   */
  async evaluateMatch(patientResponse, criterion, patientSlot, criterionSlot) {
    const reasoning = {
      requiresAI: false,
      explanation: '',
      confidence: 0.5,
      matches: false
    };

    // STEP 1: Try exact slot matching (fastest, highest confidence)
    const exactMatch = this.checkExactMatch(patientSlot, criterionSlot);
    if (exactMatch.matches) {
      return exactMatch;
    }

    // STEP 2: Try rule-based heuristics (fast, no API cost)
    const heuristicMatch = await this.checkHeuristicMatch(patientSlot, criterionSlot);
    if (heuristicMatch.matches && heuristicMatch.confidence >= 0.85) {
      return heuristicMatch;
    }

    // STEP 3: Use Claude API for semantic analysis (accurate but costs money)
    if (this.claudeAPI) {
      reasoning.requiresAI = true;
      const aiMatch = await this.checkClaudeAPIMatch(patientSlot, criterionSlot);
      if (aiMatch.matches) {
        return {
          ...aiMatch,
          requiresAI: true
        };
      }
    }

    // STEP 4: If heuristic found weak match, return it
    if (heuristicMatch.matches) {
      return heuristicMatch;
    }

    // No match found
    reasoning.explanation = 'No semantic match detected. Slots do not align sufficiently for exclusion.';
    return reasoning;
  }

  /**
   * Check for exact matches (highest confidence)
   */
  checkExactMatch(patientSlot, criterionSlot) {
    // Check conditions
    if (criterionSlot.CONDITION_TYPE && patientSlot.CONDITION_TYPE) {
      for (const criterionCond of criterionSlot.CONDITION_TYPE) {
        for (const patientCond of patientSlot.CONDITION_TYPE) {
          if (normalizeString(criterionCond) === normalizeString(patientCond)) {
            return {
              matches: true,
              confidence: 1.0,
              explanation: `Exact condition match: "${patientCond}"`,
              requiresAI: false
            };
          }
        }
      }
    }

    // Check treatments
    if (criterionSlot.TREATMENT_TYPE && patientSlot.TREATMENT_TYPE) {
      for (const criterionTreat of criterionSlot.TREATMENT_TYPE) {
        for (const patientTreat of patientSlot.TREATMENT_TYPE) {
          if (normalizeString(criterionTreat) === normalizeString(patientTreat)) {
            return {
              matches: true,
              confidence: 1.0,
              explanation: `Exact treatment match: "${patientTreat}"`,
              requiresAI: false
            };
          }
        }
      }
    }

    return { matches: false, confidence: 0 };
  }

  /**
   * Check using rule-based heuristics (synonyms, substrings, drug classifications)
   */
  async checkHeuristicMatch(patientSlot, criterionSlot) {
    // Check for condition type matches
    if (criterionSlot.CONDITION_TYPE && patientSlot.CONDITION_TYPE) {
      const condMatch = this.checkPartialConditionMatch(
        criterionSlot.CONDITION_TYPE,
        patientSlot.CONDITION_TYPE
      );
      if (condMatch.matches) {
        return {
          matches: true,
          confidence: condMatch.confidence,
          explanation: `Heuristic match: "${patientSlot.CONDITION_TYPE.join(', ')}" relates to "${criterionSlot.CONDITION_TYPE.join(', ')}". Confidence: ${(condMatch.confidence * 100).toFixed(0)}%`,
          requiresAI: false
        };
      }
    }

    // Check for treatment type matches with drug classification
    if (criterionSlot.TREATMENT_TYPE && patientSlot.TREATMENT_TYPE) {
      const treatMatch = this.checkTreatmentClassMatch(
        criterionSlot.TREATMENT_TYPE,
        patientSlot.TREATMENT_TYPE,
        patientSlot.DRUG_CLASSIFICATION
      );
      if (treatMatch.matches) {
        return {
          matches: true,
          confidence: treatMatch.confidence,
          explanation: treatMatch.explanation,
          requiresAI: false
        };
      }
    }

    return { matches: false, confidence: 0 };
  }

  /**
   * Use Claude API for semantic matching
   */
  async checkClaudeAPIMatch(patientSlot, criterionSlot) {
    try {
      // For conditions
      if (criterionSlot.CONDITION_TYPE && patientSlot.CONDITION_TYPE) {
        const patientTerm = patientSlot.CONDITION_TYPE.join(', ');
        const criterionTerm = criterionSlot.CONDITION_TYPE.join(', ');

        const result = await this.claudeAPI.semanticMatch(
          patientTerm,
          criterionTerm,
          'medical condition'
        );

        if (result.match) {
          return {
            matches: true,
            confidence: result.confidence,
            explanation: `Claude AI: ${result.reasoning}`,
            requiresAI: true
          };
        }
      }

      // For treatments
      if (criterionSlot.TREATMENT_TYPE && patientSlot.TREATMENT_TYPE) {
        const patientTerm = patientSlot.TREATMENT_TYPE.join(', ');
        const criterionTerm = criterionSlot.TREATMENT_TYPE.join(', ');

        const result = await this.claudeAPI.semanticMatch(
          patientTerm,
          criterionTerm,
          'medical treatment'
        );

        if (result.match) {
          return {
            matches: true,
            confidence: result.confidence,
            explanation: `Claude AI: ${result.reasoning}`,
            requiresAI: true
          };
        }
      }

      return { matches: false, confidence: 0 };
    } catch (error) {
      console.error('Claude API error:', error);
      return { matches: false, confidence: 0, explanation: `AI Error: ${error.message}` };
    }
  }

  /**
   * Check if conditions are semantically similar using synonym dictionary
   */
  checkPartialConditionMatch(criterionConditions, patientConditions) {
    for (const criterionCond of criterionConditions) {
      const normCriterion = normalizeString(criterionCond);

      for (const patientCond of patientConditions) {
        const normPatient = normalizeString(patientCond);

        // Substring match
        if (normCriterion.includes(normPatient) || normPatient.includes(normCriterion)) {
          return { matches: true, confidence: 0.9 };
        }

        // Synonym match
        for (const [key, synonymList] of Object.entries(this.synonyms)) {
          const normKey = normalizeString(key);
          if (normCriterion === normKey || synonymList.some(syn => normalizeString(syn) === normCriterion)) {
            if (normPatient === normKey || synonymList.some(syn => normalizeString(syn) === normPatient)) {
              return { matches: true, confidence: 0.85 };
            }
          }
        }
      }
    }

    return { matches: false, confidence: 0 };
  }

  /**
   * Check if patient's treatment matches criterion based on drug classification
   */
  checkTreatmentClassMatch(criterionTreatments, patientTreatments, drugClassification) {
    for (const criterionTreatment of criterionTreatments) {
      const normCriterion = criterionTreatment.toLowerCase();

      // Check if criterion specifies a drug class
      for (const [classType, keywords] of Object.entries(this.drugClassKeywords)) {
        if (keywords.some(kw => normCriterion.includes(kw))) {
          // Check if patient's drug matches this class
          const matchesClass = this.checkDrugClassMatch(patientTreatments, classType, drugClassification);
          if (matchesClass.matches) {
            return matchesClass;
          }
        }
      }

      // Check direct treatment name match with aliases
      for (const patientTreatment of patientTreatments) {
        const normPatient = normalizeString(patientTreatment);
        const normCrit = normalizeString(criterionTreatment);

        // Check if either is an alias of the other
        const patientDrugInfo = this.drugAliases[normPatient];
        const criterionDrugInfo = this.drugAliases[normCrit];

        if (patientDrugInfo) {
          // Check generic name match
          if (patientDrugInfo.generic && normalizeString(patientDrugInfo.generic) === normCrit) {
            return {
              matches: true,
              confidence: 1.0,
              explanation: `Treatment "${patientTreatment}" (generic: ${patientDrugInfo.generic}) matches criterion.`
            };
          }

          // Check aliases
          if (patientDrugInfo.aliases && patientDrugInfo.aliases.some(alias => normalizeString(alias) === normCrit)) {
            return {
              matches: true,
              confidence: 1.0,
              explanation: `Treatment "${patientTreatment}" is also known as "${criterionTreatment}".`
            };
          }
        }

        // Check substring match
        if (normPatient.includes(normCrit) || normCrit.includes(normPatient)) {
          return {
            matches: true,
            confidence: 0.85,
            explanation: `Treatment name similarity: "${patientTreatment}" and "${criterionTreatment}"`
          };
        }
      }
    }

    return { matches: false, confidence: 0, explanation: 'No treatment match detected.' };
  }

  /**
   * Check if patient's treatment matches a specific drug class
   */
  checkDrugClassMatch(patientTreatments, classType, drugClassification) {
    for (const treatment of patientTreatments) {
      const normTreatment = normalizeString(treatment);
      const drugInfo = this.drugAliases[normTreatment];

      if (drugInfo) {
        // Check based on drug class type
        if (classType === 'tnf' && drugInfo.is_tnf) {
          return {
            matches: true,
            confidence: 0.95,
            explanation: `"${treatment}" is a TNF inhibitor (${drugInfo.class}), matching criterion.`
          };
        }

        if (classType === 'biologics' && drugInfo.is_biologic) {
          return {
            matches: true,
            confidence: 0.9,
            explanation: `"${treatment}" is a biologic (${drugInfo.class}), matching criterion.`
          };
        }

        if (classType === 'il17' && drugInfo.is_il17) {
          return {
            matches: true,
            confidence: 0.95,
            explanation: `"${treatment}" is an IL-17 inhibitor (${drugInfo.class}), matching criterion.`
          };
        }

        if (classType === 'il23' && drugInfo.is_il23) {
          return {
            matches: true,
            confidence: 0.95,
            explanation: `"${treatment}" is an IL-23 inhibitor (${drugInfo.class}), matching criterion.`
          };
        }
      }

      // Check provided drug classification object
      if (drugClassification) {
        if (classType === 'tnf' && (drugClassification.is_tnf || drugClassification.drug_class?.toLowerCase().includes('tnf'))) {
          return {
            matches: true,
            confidence: 0.95,
            explanation: `"${treatment}" is classified as ${drugClassification.drug_class}, matching TNF criterion.`
          };
        }

        if (classType === 'biologics' && drugClassification.is_biologic) {
          return {
            matches: true,
            confidence: 0.9,
            explanation: `"${treatment}" is a biologic, matching criterion.`
          };
        }
      }
    }

    return { matches: false, confidence: 0 };
  }

  /**
   * Get cache statistics from Claude API
   */
  getCacheStats() {
    if (this.claudeAPI) {
      return this.claudeAPI.getCacheStats();
    }
    return { size: 0, entries: [] };
  }

  /**
   * Clear the cache
   */
  clearCache() {
    if (this.claudeAPI) {
      this.claudeAPI.clearCache();
    }
  }
}

export default EnhancedAIMatchingEngine;
