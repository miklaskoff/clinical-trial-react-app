/**
 * @file Follow-up Question Generator
 * @description AI-driven generation of follow-up questions based on drug/condition category and matching criteria
 */

import { getClaudeClient } from './ClaudeClient.js';
import { resolveDrugCategory, getClassSearchTerms } from './DrugCategoryResolver.js';
import { getDatabase } from '../db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {Map<string, { questions: any[], expiresAt: number }>} */
const memoryCache = new Map();

/** @type {Map<string, { questions: any[], expiresAt: number }>} */
const conditionCache = new Map();

/** Cache TTL: 24 hours */
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Condition type mappings
 */
const CONDITION_TYPES = {
  cancer: ['cancer', 'tumor', 'malignancy', 'carcinoma', 'lymphoma', 'leukemia', 'melanoma', 'sarcoma', 'neoplasm', 'oncology', 'metastatic', 'brain cancer', 'lung cancer', 'breast cancer'],
  autoimmune: ['lupus', 'rheumatoid', 'psoriasis', 'psoriatic', 'crohn', 'colitis', 'multiple sclerosis', 'ms', 'scleroderma', 'vasculitis', 'sjogren'],
  cardiovascular: ['heart', 'cardiac', 'hypertension', 'arrhythmia', 'coronary', 'atrial fibrillation', 'heart failure', 'myocardial'],
  neurological: ['alzheimer', 'parkinson', 'epilepsy', 'seizure', 'stroke', 'dementia', 'neuropathy', 'migraine'],
  infectious: ['hiv', 'aids', 'hepatitis', 'tuberculosis', 'tb', 'covid', 'infection'],
  metabolic: ['diabetes', 'thyroid', 'obesity', 'hyperlipidemia', 'gout'],
  psychiatric: ['depression', 'anxiety', 'bipolar', 'schizophrenia', 'ptsd', 'adhd'],
  respiratory: ['asthma', 'copd', 'pulmonary', 'lung disease', 'fibrosis'],
  gastrointestinal: ['ibd', 'ibs', 'gastric', 'liver', 'cirrhosis', 'hepatic']
};

/**
 * Resolve condition category
 * @param {string} conditionName 
 * @returns {{ conditionType: string, found: boolean }}
 */
function resolveConditionCategory(conditionName) {
  const normalized = conditionName.toLowerCase();
  
  for (const [type, keywords] of Object.entries(CONDITION_TYPES)) {
    if (keywords.some(keyword => normalized.includes(keyword))) {
      return { conditionType: type, found: true };
    }
  }
  
  return { conditionType: 'unknown', found: false };
}

/**
 * Load criteria database
 * @returns {Promise<Object>}
 */
async function loadCriteriaDatabase() {
  try {
    const dbPath = path.join(__dirname, '../../src/data/improved_slot_filled_database.json');
    const content = await fs.readFile(dbPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load criteria database:', error.message);
    return {};
  }
}

/**
 * Find criteria matching a drug or its class
 * @param {Object} database 
 * @param {string} drugName 
 * @param {string} drugClass 
 * @returns {Array<Object>}
 */
function findMatchingCriteria(database, drugName, drugClass) {
  const searchTerms = [
    drugName.toLowerCase(),
    ...getClassSearchTerms(drugClass).map(t => t.toLowerCase())
  ];

  const matchingCriteria = [];
  const clusters = ['CLUSTER_PTH', 'CLUSTER_FLR', 'CLUSTER_CMB'];

  for (const clusterKey of clusters) {
    const cluster = database[clusterKey];
    if (!cluster?.criteria) continue;

    for (const criterion of cluster.criteria) {
      const rawText = (criterion.raw_text || '').toLowerCase();
      const conditionTypes = criterion.conditions?.flatMap(c => c.TREATMENT_TYPE || []) || [];
      const treatmentTypes = criterion.CONDITION_TYPE || [];
      
      const allText = [
        rawText,
        ...conditionTypes.map(t => t.toLowerCase()),
        ...treatmentTypes.map(t => t.toLowerCase())
      ].join(' ');

      // Check if any search term appears in the criterion
      const matches = searchTerms.some(term => allText.includes(term));
      
      if (matches) {
        matchingCriteria.push({
          id: criterion.id,
          nct_id: criterion.nct_id,
          raw_text: criterion.raw_text,
          conditions: criterion.conditions,
          exclusionStrength: criterion.EXCLUSION_STRENGTH
        });
      }
    }
  }

  return matchingCriteria;
}

/**
 * Generate follow-up questions using AI
 * @param {string} drugName 
 * @param {string} drugClass 
 * @param {Array<Object>} criteria 
 * @returns {Promise<Array<Object>>}
 */
async function generateQuestionsWithAI(drugName, drugClass, criteria) {
  const client = getClaudeClient();

  // Try to initialize from database if not configured
  if (!client.isConfigured()) {
    await client.initFromDatabase();
  }

  if (!client.isConfigured()) {
    // Return default questions if no AI configured
    console.log('⚠ AI not configured, using default treatment questions');
    return { questions: getDefaultQuestions(drugClass), aiGenerated: false };
  }
  
  console.log(`🤖 Generating AI questions for drug: ${drugName} (class: ${drugClass})`);

  const criteriaText = criteria
    .slice(0, 10) // Limit to 10 most relevant
    .map(c => `- ${c.id}: "${c.raw_text}"`)
    .join('\n');

  const prompt = `You are a clinical trial eligibility expert. Generate follow-up questions for a patient who reports taking "${drugName}" (drug class: ${drugClass}).

Related eligibility criteria from clinical trials:
${criteriaText}

Based on these criteria, generate follow-up questions needed to determine eligibility. Focus on:
1. Timing/recency of use (if criteria have TIMEFRAME requirements)
2. Current vs previous use (if criteria distinguish ongoing/prior use)
3. Treatment response (if criteria mention response/efficacy)
4. Dosage stability (if criteria require stable doses)

Return ONLY valid JSON in this format:
{
  "questions": [
    {
      "id": "q1",
      "text": "Question text here",
      "type": "radio|number|select",
      "options": ["Option1", "Option2"], // for radio/select only
      "unit": "weeks", // for number type only
      "required": true
    }
  ]
}

Generate 2-5 relevant questions. Be concise.`;

  try {
    const response = await client.generateQuestions(prompt);
    
    // Check if AI returned aiGenerated: false (API error occurred)
    if (response && response.aiGenerated === false) {
      console.log(`⚠ AI API failed for drug: ${drugName}, using blocking response`);
      return { questions: [], aiGenerated: false };  // Return empty to trigger blocking
    }
    
    if (response && response.questions && Array.isArray(response.questions) && response.questions.length > 0) {
      console.log(`✅ AI generated ${response.questions.length} questions for drug: ${drugName}`);
      return { questions: response.questions, aiGenerated: true };
    }
    
    console.log(`⚠ AI returned no questions, using defaults for drug: ${drugName}`);
    return { questions: getDefaultQuestions(drugClass), aiGenerated: false };

  } catch (error) {
    console.error('AI question generation failed:', error.message);
    return { questions: getDefaultQuestions(drugClass), aiGenerated: false };
  }
}

/**
 * Get default follow-up questions based on drug class
 * @param {string} drugClass 
 * @returns {Array<Object>}
 */
function getDefaultQuestions(drugClass) {
  const baseQuestions = [
    {
      id: 'usage_status',
      text: 'Are you currently taking this medication?',
      type: 'radio',
      options: ['Yes, currently taking', 'No, stopped taking'],
      required: true
    },
    {
      id: 'last_dose',
      text: 'How many weeks ago was your last dose?',
      type: 'number',
      unit: 'weeks',
      required: true
    }
  ];

  // Add class-specific questions
  const classQuestions = {
    TNF_inhibitors: [
      {
        id: 'response',
        text: 'How did you respond to this treatment?',
        type: 'select',
        options: ['Good response', 'Partial response', 'No response', 'Lost response over time', 'Could not tolerate'],
        required: true
      }
    ],
    IL17_inhibitors: [
      {
        id: 'response',
        text: 'How did you respond to this IL-17 inhibitor?',
        type: 'select',
        options: ['Good response', 'Partial response', 'No response', 'Lost response', 'Intolerant'],
        required: true
      }
    ],
    JAK_inhibitors: [
      {
        id: 'dose_stable',
        text: 'Has your dose been stable for at least 4 weeks?',
        type: 'radio',
        options: ['Yes', 'No'],
        required: true
      }
    ],
    systemic_corticosteroids: [
      {
        id: 'daily_dose',
        text: 'What is your current daily dose (in mg prednisone equivalent)?',
        type: 'number',
        unit: 'mg',
        required: true
      },
      {
        id: 'dose_stable',
        text: 'Has your dose been stable for at least 4 weeks?',
        type: 'radio',
        options: ['Yes', 'No'],
        required: true
      }
    ]
  };

  return [...baseQuestions, ...(classQuestions[drugClass] || [])];
}

/**
 * Find criteria matching a condition
 * @param {Object} database 
 * @param {string} conditionName 
 * @param {string} conditionType 
 * @returns {Array<Object>}
 */
function findMatchingConditionCriteria(database, conditionName, conditionType) {
  const searchTerms = [
    conditionName.toLowerCase(),
    conditionType.toLowerCase(),
    ...(CONDITION_TYPES[conditionType] || [])
  ];

  const matchingCriteria = [];
  const clusters = ['CLUSTER_CMB', 'CLUSTER_AIC', 'CLUSTER_NPV']; // Condition-related clusters

  for (const clusterKey of clusters) {
    const cluster = database[clusterKey];
    if (!cluster?.criteria) continue;

    for (const criterion of cluster.criteria) {
      const rawText = (criterion.raw_text || '').toLowerCase();
      const conditionTypes = criterion.CONDITION_TYPE || [];
      const patterns = criterion.CONDITION_PATTERN || [];
      
      const allText = [
        rawText,
        ...(Array.isArray(conditionTypes) ? conditionTypes : [conditionTypes]).map(t => String(t).toLowerCase()),
        ...(Array.isArray(patterns) ? patterns : [patterns]).map(t => String(t).toLowerCase())
      ].join(' ');

      // Check if any search term appears in the criterion
      const matches = searchTerms.some(term => allText.includes(term));
      
      if (matches) {
        matchingCriteria.push({
          id: criterion.id,
          nct_id: criterion.nct_id,
          raw_text: criterion.raw_text,
          conditionType: criterion.CONDITION_TYPE,
          conditionPattern: criterion.CONDITION_PATTERN,
          timeframe: criterion.TIMEFRAME,
          exclusionStrength: criterion.EXCLUSION_STRENGTH
        });
      }
    }
  }

  return matchingCriteria;
}

/**
 * Generate follow-up questions for CONDITIONS using AI
 * @param {string} conditionName 
 * @param {string} conditionType 
 * @param {Array<Object>} criteria 
 * @returns {Promise<Array<Object>>}
 */
async function generateConditionQuestionsWithAI(conditionName, conditionType, criteria) {
  const client = getClaudeClient();

  // Try to initialize from database if not configured
  if (!client.isConfigured()) {
    await client.initFromDatabase();
  }

  if (!client.isConfigured()) {
    // Return default questions if no AI configured
    console.log('⚠ AI not configured, using default condition questions');
    return { questions: getDefaultConditionQuestions(conditionType), aiGenerated: false };
  }
  
  console.log(`🤖 Generating AI questions for condition: ${conditionName} (type: ${conditionType})`);

  const criteriaText = criteria
    .slice(0, 10) // Limit to 10 most relevant
    .map(c => `- ${c.id}: "${c.raw_text}"`)
    .join('\n');

  const prompt = `You are a clinical trial eligibility expert. Generate follow-up questions for a patient who reports having "${conditionName}" (condition type: ${conditionType}).

Related eligibility criteria from clinical trials:
${criteriaText || '(No specific criteria found - generate general questions for this condition type)'}

Based on these criteria, generate follow-up questions needed to determine eligibility. Focus on:
1. Current status (active, remission, controlled, resolved)
2. Duration/diagnosis date (how long they've had it)
3. Severity (mild, moderate, severe)
4. Treatment status (treated, untreated, under control)
5. Recent episodes or flares (if applicable)

IMPORTANT: These are questions about a MEDICAL CONDITION (disease), NOT a medication.
Do NOT ask about doses, medication timing, or drug-related questions.

Return ONLY valid JSON in this format:
{
  "questions": [
    {
      "id": "q1",
      "text": "Question text here",
      "type": "radio|select|text|number",
      "options": ["Option1", "Option2"], // for radio/select only
      "required": true
    }
  ]
}

Generate 2-5 relevant questions. Be concise.`;

  try {
    const response = await client.generateQuestions(prompt);
    
    // Check if AI returned aiGenerated: false (API error occurred)
    if (response && response.aiGenerated === false) {
      console.log(`⚠ AI API failed for condition: ${conditionName}, using blocking response`);
      return { questions: [], aiGenerated: false };  // Return empty to trigger blocking
    }
    
    if (response && response.questions && Array.isArray(response.questions) && response.questions.length > 0) {
      console.log(`✅ AI generated ${response.questions.length} questions for condition: ${conditionName}`);
      // Return with source marker
      return { questions: response.questions, aiGenerated: true };
    }
    
    console.log(`⚠ AI returned no questions, using defaults for: ${conditionName}`);
    return { questions: getDefaultConditionQuestions(conditionType), aiGenerated: false };

  } catch (error) {
    console.error('AI condition question generation failed:', error.message);
    return { questions: getDefaultConditionQuestions(conditionType), aiGenerated: false };
  }
}

/**
 * Get default follow-up questions for conditions based on condition type
 * @param {string} conditionType 
 * @returns {Array<Object>}
 */
function getDefaultConditionQuestions(conditionType) {
  const baseQuestions = [
    {
      id: 'current_status',
      text: 'What is the current status of this condition?',
      type: 'select',
      options: ['Active - currently experiencing symptoms', 'Controlled - stable with treatment', 'In remission', 'Resolved - no longer have it', 'History - had it in the past'],
      required: true
    },
    {
      id: 'diagnosis_timeframe',
      text: 'When were you diagnosed?',
      type: 'select',
      options: ['Within the last month', 'Within the last 6 months', 'Within the last year', '1-5 years ago', 'More than 5 years ago'],
      required: true
    }
  ];

  // Add type-specific questions
  const typeQuestions = {
    cancer: [
      {
        id: 'stage',
        text: 'What stage is/was the cancer?',
        type: 'select',
        options: ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Unknown', 'Not applicable'],
        required: true
      },
      {
        id: 'treatment_status',
        text: 'Are you currently receiving treatment?',
        type: 'select',
        options: ['Yes - active treatment', 'No - completed treatment', 'No - not yet started', 'No - not receiving treatment'],
        required: true
      },
      {
        id: 'metastatic',
        text: 'Has the cancer spread (metastasized)?',
        type: 'radio',
        options: ['Yes', 'No', 'Unknown'],
        required: true
      }
    ],
    autoimmune: [
      {
        id: 'severity',
        text: 'How severe is your condition currently?',
        type: 'select',
        options: ['Mild', 'Moderate', 'Severe', 'In remission'],
        required: true
      },
      {
        id: 'flare_frequency',
        text: 'How often do you experience flares?',
        type: 'select',
        options: ['Rarely (less than once a year)', 'Occasionally (1-2 times per year)', 'Frequently (monthly)', 'Constantly active'],
        required: true
      }
    ],
    cardiovascular: [
      {
        id: 'controlled',
        text: 'Is the condition controlled with medication?',
        type: 'radio',
        options: ['Yes', 'No', 'Partially'],
        required: true
      },
      {
        id: 'recent_event',
        text: 'Have you had any cardiovascular events in the last 6 months?',
        type: 'radio',
        options: ['Yes', 'No'],
        required: true
      }
    ],
    neurological: [
      {
        id: 'progression',
        text: 'Is the condition stable or progressing?',
        type: 'select',
        options: ['Stable', 'Slowly progressing', 'Rapidly progressing', 'Improving'],
        required: true
      },
      {
        id: 'functional_impact',
        text: 'How much does it affect your daily activities?',
        type: 'select',
        options: ['No impact', 'Mild impact', 'Moderate impact', 'Severe impact'],
        required: true
      }
    ],
    infectious: [
      {
        id: 'active',
        text: 'Is the infection currently active?',
        type: 'radio',
        options: ['Yes - active infection', 'No - cleared/resolved', 'Chronic but controlled'],
        required: true
      },
      {
        id: 'on_treatment',
        text: 'Are you currently on treatment for this infection?',
        type: 'radio',
        options: ['Yes', 'No', 'Completed treatment'],
        required: true
      }
    ],
    psychiatric: [
      {
        id: 'severity_current',
        text: 'How would you rate your current symptom severity?',
        type: 'select',
        options: ['Minimal/None', 'Mild', 'Moderate', 'Severe'],
        required: true
      },
      {
        id: 'hospitalization',
        text: 'Have you been hospitalized for this condition in the past year?',
        type: 'radio',
        options: ['Yes', 'No'],
        required: true
      }
    ]
  };

  return [...baseQuestions, ...(typeQuestions[conditionType] || [])];
}

/**
 * Generate follow-up questions for a CONDITION (not a drug)
 * @param {string} conditionName 
 * @returns {Promise<{ questions: Array<Object>, conditionType: string, matchingCriteriaCount: number, cached: boolean }>}
 */
export async function generateConditionFollowUpQuestions(conditionName) {
  // Resolve condition category
  const { conditionType, found } = resolveConditionCategory(conditionName);

  // Check memory cache first
  const cacheKey = `condition_${conditionType}`;
  const cached = conditionCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    return {
      questions: cached.questions,
      conditionType,
      conditionName,
      matchingCriteriaCount: cached.matchingCriteriaCount || 0,
      cached: true,
      source: 'cache',
      aiGenerated: cached.aiGenerated !== undefined ? cached.aiGenerated : true  // Preserve AI status from cache
    };
  }

  // Load criteria database and find matching criteria
  const database = await loadCriteriaDatabase();
  const matchingCriteria = findMatchingConditionCriteria(database, conditionName, conditionType);

  // Generate questions
  let questions;
  let source = 'default';
  let aiGenerated = false;  // Track if AI actually generated
  
  if (matchingCriteria.length > 0) {
    const result = await generateConditionQuestionsWithAI(conditionName, conditionType, matchingCriteria);
    questions = result.questions;
    aiGenerated = result.aiGenerated;
    source = result.aiGenerated ? 'ai' : 'default';
  } else {
    questions = getDefaultConditionQuestions(conditionType);
    source = 'default';
    aiGenerated = false;
  }

  // Store in cache
  const expiresAt = Date.now() + CACHE_TTL;
  conditionCache.set(cacheKey, {
    questions,
    matchingCriteriaCount: matchingCriteria.length,
    source,
    aiGenerated,
    expiresAt
  });

  return {
    questions,
    conditionType,
    conditionName,
    matchingCriteriaCount: matchingCriteria.length,
    cached: false,
    source,
    aiGenerated  // Frontend will use this to block if false
  };
}

/**
 * Generate follow-up questions for a drug
 * @param {string} drugName 
 * @returns {Promise<{ questions: Array<Object>, drugClass: string, matchingCriteriaCount: number, cached: boolean }>}
 */
export async function generateFollowUpQuestions(drugName) {
  // Resolve drug category
  const { drugClass, isBiologic, found } = resolveDrugCategory(drugName);

  // Check memory cache first
  // Use 'treatment:' prefix to separate from condition cache
  const cacheKey = `treatment:${drugClass}`;
  const cached = memoryCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    return {
      questions: cached.questions,
      drugClass,
      drugName,
      isBiologic,
      matchingCriteriaCount: cached.matchingCriteriaCount || 0,
      cached: true,
      aiGenerated: cached.aiGenerated !== undefined ? cached.aiGenerated : true  // Preserve AI status from cache
    };
  }

  // Check database cache
  const db = getDatabase();
  if (db) {
    try {
      const dbCached = await db.getAsync(
        'SELECT * FROM followup_cache WHERE drug_class = ? AND expires_at > ?',
        [`treatment:${drugClass}`, new Date().toISOString()]
      );

      if (dbCached) {
        const questions = JSON.parse(dbCached.questions);
        // DB cache doesn't store aiGenerated, so we assume true if questions exist
        // (DB cache is only used for AI-generated content)
        const aiGenerated = questions && questions.length > 0;
        
        // Also store in memory cache
        memoryCache.set(cacheKey, {
          questions,
          matchingCriteriaCount: 0,
          aiGenerated,
          expiresAt: new Date(dbCached.expires_at).getTime()
        });

        return {
          questions,
          drugClass,
          drugName,
          isBiologic,
          matchingCriteriaCount: 0,
          cached: true,
          aiGenerated
        };
      }
    } catch (error) {
      console.error('DB cache lookup failed:', error.message);
    }
  }

  // Load criteria database and find matching criteria
  const database = await loadCriteriaDatabase();
  const matchingCriteria = findMatchingCriteria(database, drugName, drugClass);

  // Generate questions
  let questions;
  let source = 'default';
  let aiGenerated = false;  // Track if AI actually generated
  
  if (matchingCriteria.length > 0) {
    const result = await generateQuestionsWithAI(drugName, drugClass, matchingCriteria);
    questions = result.questions;
    aiGenerated = result.aiGenerated;
    source = result.aiGenerated ? 'ai' : 'default';
  } else {
    questions = getDefaultQuestions(drugClass);
    source = 'default';
    aiGenerated = false;
  }

  // Store in caches
  const expiresAt = Date.now() + CACHE_TTL;
  memoryCache.set(cacheKey, {
    questions,
    matchingCriteriaCount: matchingCriteria.length,
    source,
    aiGenerated,
    expiresAt
  });

  // Store in database cache (with treatment prefix)
  if (db) {
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO followup_cache (drug_class, questions, created_at, expires_at) 
         VALUES (?, ?, ?, ?)`,
        [`treatment:${drugClass}`, JSON.stringify(questions), new Date().toISOString(), new Date(expiresAt).toISOString()]
      );
    } catch (error) {
      console.error('DB cache store failed:', error.message);
    }
  }

  return {
    questions,
    drugClass,
    drugName,
    isBiologic,
    matchingCriteriaCount: matchingCriteria.length,
    cached: false,
    source,
    aiGenerated  // Frontend will use this to block if false
  };
}

/**
 * Get cache statistics
 * @returns {{ size: number, entries: Array<{ drugClass: string, expiresAt: string }> }}
 */
export function getCacheStats() {
  const entries = [];
  for (const [key, value] of memoryCache.entries()) {
    entries.push({
      drugClass: key,
      expiresAt: new Date(value.expiresAt).toISOString()
    });
  }
  return { size: memoryCache.size, entries };
}

/**
 * Clear the follow-up cache
 */
export async function clearCache() {
  memoryCache.clear();
  conditionCache.clear();  // Also clear condition cache
  
  const db = getDatabase();
  if (db) {
    try {
      await db.runAsync('DELETE FROM followup_cache');
    } catch (error) {
      console.error('DB cache clear failed:', error.message);
    }
  }
}
