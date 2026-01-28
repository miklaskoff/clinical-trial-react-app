/**
 * @file Follow-up Question Generator
 * @description AI-driven generation of follow-up questions based on drug/condition category and matching criteria
 */

import { getClaudeClient } from './ClaudeClient.js';
import { resolveDrugCategory, getClassSearchTerms, getGenericSearchTerms } from './DrugCategoryResolver.js';
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
 * Normalize timeframe to weeks for comparison
 * @param {{ amount: number, unit: string }} timeframe
 * @returns {number} Weeks
 */
function normalizeToWeeks(timeframe) {
  if (!timeframe || !timeframe.amount) return 0;
  const { amount, unit } = timeframe;
  switch (unit?.toLowerCase()) {
    case 'days': return Math.ceil(amount / 7);
    case 'weeks': return amount;
    case 'months': return amount * 4; // Approximate
    case 'years': return amount * 52;
    default: return amount; // Assume weeks
  }
}

/**
 * Format weeks as human-readable range
 * @param {number} weeks
 * @returns {string}
 */
function formatWeeksAsLabel(weeks) {
  if (weeks <= 4) return `${weeks} weeks`;
  if (weeks <= 12) return `${Math.round(weeks / 4)} months`;
  return `${Math.round(weeks / 4)} months`;
}

/**
 * Derive timing options from matched criteria timeframes
 * @param {Array<Object>} criteria - Matched criteria with TIMEFRAME fields
 * @returns {Array<{ label: string, slotValue: Object }>}
 */
export function deriveTimingOptions(criteria) {
  const boundaries = new Set();
  let hasCurrentUse = false;
  
  for (const c of criteria) {
    if (c.TIMEFRAME) {
      const weeks = normalizeToWeeks(c.TIMEFRAME);
      if (weeks > 0) boundaries.add(weeks);
    }
    // Check for "currently" in raw_text
    if (c.raw_text?.toLowerCase().includes('currently')) {
      hasCurrentUse = true;
    }
  }
  
  // Always include "currently taking"
  const options = [
    {
      label: 'Currently taking',
      slotValue: { usage_current: true, TIMEFRAME: { amount: 0, unit: 'weeks', relation: 'current' } }
    }
  ];
  
  // Sort boundaries and create ranges
  const sortedBoundaries = [...boundaries].sort((a, b) => a - b);
  
  let prev = 0;
  for (const weeks of sortedBoundaries) {
    const label = prev === 0 
      ? `Stopped within last ${formatWeeksAsLabel(weeks)}`
      : `Stopped ${formatWeeksAsLabel(prev)} to ${formatWeeksAsLabel(weeks)} ago`;
    
    options.push({
      label,
      slotValue: {
        usage_current: false,
        TIMEFRAME: { amount: weeks, unit: 'weeks', relation: 'within' }
      }
    });
    prev = weeks;
  }
  
  // Add "beyond all thresholds" option
  const maxWeeks = sortedBoundaries.length > 0 ? sortedBoundaries[sortedBoundaries.length - 1] : 26; // Default 6 months
  options.push({
    label: `Stopped over ${formatWeeksAsLabel(maxWeeks)} ago`,
    slotValue: {
      usage_current: false,
      TIMEFRAME: { amount: maxWeeks, unit: 'weeks', relation: 'beyond' }
    }
  });
  
  return options;
}

/**
 * Check app version and invalidate cache if version changed
 * @param {string} currentVersion - Current app version from package.json
 * @returns {Promise<boolean>} - True if cache was invalidated
 */
export async function checkAndInvalidateCache(currentVersion) {
  const db = getDatabase();
  if (!db) return false;
  
  try {
    // Get stored version
    const stored = await db.getAsync('SELECT version FROM app_version WHERE id = 1');
    
    if (!stored) {
      // First run - store version, no invalidation needed
      await db.runAsync(
        'INSERT INTO app_version (id, version, updated_at) VALUES (1, ?, ?)',
        [currentVersion, new Date().toISOString()]
      );
      return false;
    }
    
    if (stored.version !== currentVersion) {
      console.log(`🔄 App version changed: ${stored.version} → ${currentVersion}. Clearing caches...`);
      
      // Clear all caches
      memoryCache.clear();
      conditionCache.clear();
      await db.runAsync('DELETE FROM followup_cache');
      
      // Update stored version
      await db.runAsync(
        'UPDATE app_version SET version = ?, updated_at = ? WHERE id = 1',
        [currentVersion, new Date().toISOString()]
      );
      
      console.log('✅ Caches cleared due to version change');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Version check failed:', error.message);
    return false;
  }
}

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
/**
 * Interleukin subtype mappings - subtypes should match their parent
 * IL-17A, IL-17F → IL-17; IL-23p19 → IL-23; etc.
 */
const IL_SUBTYPE_MAPPINGS = {
  'il-17a': ['il-17', 'il17', 'interleukin-17', 'interleukin 17'],
  'il-17f': ['il-17', 'il17', 'interleukin-17', 'interleukin 17'],
  'il-17a/17f': ['il-17', 'il17', 'interleukin-17', 'interleukin 17'],
  'il-23p19': ['il-23', 'il23', 'interleukin-23', 'interleukin 23'],
  'il-12/23': ['il-12', 'il12', 'il-23', 'il23'],
  'il-12p40': ['il-12', 'il12', 'il-23', 'il23'], // p40 is shared subunit
};

/**
 * Expand search terms to include parent IL types
 * @param {string} term 
 * @returns {string[]}
 */
function expandILTerms(term) {
  const normalized = term.toLowerCase().replace(/\s+/g, '-');
  const expanded = [term];
  
  // Check for IL subtype patterns
  for (const [subtype, parents] of Object.entries(IL_SUBTYPE_MAPPINGS)) {
    if (normalized.includes(subtype) || term.toLowerCase().includes(subtype.replace(/-/g, ''))) {
      expanded.push(...parents);
    }
  }
  
  // Also extract base IL number from patterns like "IL-17A inhibitor"
  const ilMatch = term.match(/il[- ]?(\d+)([a-z])?/i);
  if (ilMatch) {
    const baseIL = `il-${ilMatch[1]}`;
    if (!expanded.includes(baseIL)) {
      expanded.push(baseIL);
      expanded.push(`il${ilMatch[1]}`);
      expanded.push(`interleukin-${ilMatch[1]}`);
    }
  }
  
  return [...new Set(expanded)];
}

function findMatchingCriteria(database, drugName, drugClass, targetCluster = 'CLUSTER_PTH') {
  // Get drug info for generic term lookup
  const drugInfo = resolveDrugCategory(drugName);
  
  // Build comprehensive search terms:
  // 1. Drug name
  // 2. Class-specific terms (TNF, IL-17, etc.)
  // 3. Generic terms (biologic, DMARD, monoclonal antibody, etc.)
  const baseTerms = [
    drugName.toLowerCase(),
    ...getClassSearchTerms(drugClass).map(t => t.toLowerCase()),
    ...getGenericSearchTerms(drugInfo).map(t => t.toLowerCase())
  ];
  
  // Expand IL subtypes to their parent types
  const searchTerms = [...new Set(baseTerms.flatMap(term => expandILTerms(term)))];
  
  console.log(`🔍 Search terms for "${drugName}" (${searchTerms.length} terms): ${searchTerms.slice(0, 15).join(', ')}${searchTerms.length > 15 ? '...' : ''}`);
  console.log(`🎯 Searching in cluster: ${targetCluster}`);

  const matchingCriteria = [];
  // Only search the target cluster for treatments (default: CLUSTER_PTH)
  const clusters = [targetCluster];

  for (const clusterKey of clusters) {
    const cluster = database[clusterKey];
    if (!cluster?.criteria) continue;

    for (const criterion of cluster.criteria) {
      const rawText = (criterion.raw_text || '').toLowerCase();
      const conditionTypes = criterion.conditions?.flatMap(c => c.TREATMENT_TYPE || []) || [];
      const treatmentTypes = criterion.CONDITION_TYPE || [];
      
      // Collect all criterion terms for bidirectional matching
      const criterionTerms = [
        ...conditionTypes.map(t => t.toLowerCase()),
        ...treatmentTypes.map(t => t.toLowerCase())
      ];
      
      const allText = [rawText, ...criterionTerms].join(' ');

      // BIDIRECTIONAL MATCHING:
      // 1. Search term appears in criterion text (original logic)
      const forwardMatch = searchTerms.some(term => allText.includes(term));
      
      // 2. Criterion treatment types appear in search term (catches IL-17 matching IL-17A inhibitor)
      const reverseMatch = criterionTerms.some(criterionTerm => {
        // Expand criterion terms too for IL matching
        const expandedCriterionTerms = expandILTerms(criterionTerm);
        return searchTerms.some(searchTerm => 
          searchTerm.includes(criterionTerm) || 
          expandedCriterionTerms.some(expanded => searchTerm.includes(expanded))
        );
      });
      
      if (forwardMatch || reverseMatch) {
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
    return { questions: getDefaultQuestionsWithSlotMapping(drugClass, criteria), aiGenerated: false };
  }
  
  console.log(`🤖 Generating AI questions for drug: ${drugName} (class: ${drugClass})`);

  // Derive timing options from criteria BEFORE calling AI
  const timingOptions = deriveTimingOptions(criteria);
  const timingOptionsJson = JSON.stringify(timingOptions.map(o => o.label));

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

CRITICAL RULES:
1. NEVER use type "text" for any question. Use "select" or "radio" instead.
2. For timing/status questions, you MUST use these exact options: ${timingOptionsJson}
3. Each question must have "slotMapping" that maps option labels to slot-filled values.

Return ONLY valid JSON in this format:
{
  "questions": [
    {
      "id": "timing",
      "text": "Are you currently taking this medication, or have you taken it in the past?",
      "type": "select",
      "options": ${timingOptionsJson},
      "slotMapping": {
        "Currently taking": { "usage_current": true },
        "Stopped within last 12 weeks": { "usage_current": false, "TIMEFRAME": { "amount": 12, "unit": "weeks", "relation": "within" } }
      },
      "required": true,
      "criterionIds": ["PTH_XXXX", "PTH_YYYY"]
    },
    {
      "id": "response",
      "text": "How did you respond to this treatment?",
      "type": "select",
      "options": ["Good response", "Partial response", "No response", "Lost response over time", "Could not tolerate"],
      "slotMapping": {
        "Good response": { "response": "good" },
        "Partial response": { "response": "partial" },
        "No response": { "response": "none" },
        "Lost response over time": { "response": "lost" },
        "Could not tolerate": { "response": "intolerant" }
      },
      "required": true,
      "criterionIds": ["PTH_XXXX"]
    }
  ]
}

Generate 2-5 relevant questions. For each question, include the "criterionIds" field as an array with ALL relevant criterion IDs from the list above.`;

  try {
    const response = await client.generateQuestions(prompt);
    
    // Check if AI returned aiGenerated: false (API error occurred)
    if (response && response.aiGenerated === false) {
      console.log(`⚠ AI API failed for drug: ${drugName}, using blocking response`);
      return { questions: [], aiGenerated: false };
    }
    
    if (response && response.questions && Array.isArray(response.questions) && response.questions.length > 0) {
      // Post-process: ensure all questions have slotMapping and no text type
      const processedQuestions = postProcessQuestions(response.questions, timingOptions);
      console.log(`✅ AI generated ${processedQuestions.length} questions for drug: ${drugName}`);
      return { questions: processedQuestions, aiGenerated: true };
    }
    
    console.log(`⚠ AI returned no questions, using defaults for drug: ${drugName}`);
    return { questions: getDefaultQuestionsWithSlotMapping(drugClass, criteria), aiGenerated: false };

  } catch (error) {
    console.error('AI question generation failed:', error.message);
    return { questions: getDefaultQuestionsWithSlotMapping(drugClass, criteria), aiGenerated: false };
  }
}

/**
 * Post-process AI questions to ensure they have slotMapping and valid types
 * @param {Array<Object>} questions 
 * @param {Array<Object>} timingOptions - Derived timing options
 * @returns {Array<Object>}
 */
function postProcessQuestions(questions, timingOptions) {
  return questions.map(q => {
    // Convert text type to select with default options
    if (q.type === 'text' || !q.type) {
      q.type = 'select';
      if (!q.options || q.options.length === 0) {
        // Determine appropriate options based on question content
        if (q.text?.toLowerCase().includes('currently') || q.text?.toLowerCase().includes('taking')) {
          q.options = timingOptions.map(o => o.label);
          q.slotMapping = {};
          timingOptions.forEach(o => {
            q.slotMapping[o.label] = o.slotValue;
          });
        } else {
          q.options = ['Yes', 'No', 'Not sure'];
          q.slotMapping = {
            'Yes': { [q.id]: true },
            'No': { [q.id]: false },
            'Not sure': { [q.id]: 'unknown' }
          };
        }
      }
    }
    
    // Ensure slotMapping exists for select/radio types
    if ((q.type === 'select' || q.type === 'radio') && !q.slotMapping && q.options) {
      q.slotMapping = {};
      q.options.forEach(opt => {
        q.slotMapping[opt] = { [q.id]: opt };
      });
    }
    
    // Ensure criterionIds is an array
    if (q.criterionId && !q.criterionIds) {
      q.criterionIds = [q.criterionId];
    }
    
    return q;
  });
}

/**
 * Post-process condition questions to ensure all have proper type and options
 * Converts any 'text' type questions to 'select' with appropriate options
 * @param {Array<Object>} questions 
 * @returns {Array<Object>}
 */
function postProcessConditionQuestions(questions) {
  // Common options for different question types
  const timingOptions = ['Less than 6 months ago', '6-12 months ago', '1-2 years ago', '2-5 years ago', 'More than 5 years ago'];
  const statusOptions = ['Currently active', 'In remission', 'Resolved/cured', 'Controlled with treatment'];
  const severityOptions = ['Mild', 'Moderate', 'Severe'];
  const yesNoOptions = ['Yes', 'No', 'Not sure'];

  return questions.map(q => {
    // Convert text/number type to select with appropriate options
    if (q.type === 'text' || q.type === 'number' || !q.type) {
      q.type = 'select';
      
      if (!q.options || q.options.length === 0) {
        const textLower = q.text?.toLowerCase() || '';
        
        // Determine appropriate options based on question content
        if (textLower.includes('when') || textLower.includes('diagnosed') || textLower.includes('how long')) {
          q.options = timingOptions;
        } else if (textLower.includes('status') || textLower.includes('active') || textLower.includes('remission')) {
          q.options = statusOptions;
        } else if (textLower.includes('severe') || textLower.includes('severity')) {
          q.options = severityOptions;
        } else {
          q.options = yesNoOptions;
        }
      }
    }
    
    // Convert radio to select for consistency
    if (q.type === 'radio') {
      q.type = 'select';
    }
    
    // Ensure criterionIds is an array
    if (q.criterionId && !q.criterionIds) {
      q.criterionIds = [q.criterionId];
    }
    
    return q;
  });
}

/**
 * Get default follow-up questions with slot mapping
 * @param {string} drugClass 
 * @param {Array<Object>} criteria - Matched criteria for deriving options
 * @returns {Array<Object>}
 */
function getDefaultQuestionsWithSlotMapping(drugClass, criteria = []) {
  const timingOptions = deriveTimingOptions(criteria);
  const timingSlotMapping = {};
  timingOptions.forEach(o => {
    timingSlotMapping[o.label] = o.slotValue;
  });
  
  const baseQuestions = [
    {
      id: 'timing',
      text: 'Are you currently taking this medication, or have you taken it in the past?',
      type: 'select',
      options: timingOptions.map(o => o.label),
      slotMapping: timingSlotMapping,
      required: true
    },
    {
      id: 'response',
      text: 'How did you respond to this treatment?',
      type: 'select',
      options: ['Good response', 'Partial response', 'No response', 'Lost response over time', 'Could not tolerate'],
      slotMapping: {
        'Good response': { response: 'good' },
        'Partial response': { response: 'partial' },
        'No response': { response: 'none' },
        'Lost response over time': { response: 'lost' },
        'Could not tolerate': { response: 'intolerant' }
      },
      required: true
    }
  ];

  // Add class-specific questions
  const classQuestions = {
    JAK_inhibitors: [
      {
        id: 'dose_stable',
        text: 'Has your dose been stable for at least 4 weeks?',
        type: 'radio',
        options: ['Yes', 'No'],
        slotMapping: {
          'Yes': { dose_stable: true, dose_stable_weeks: 4 },
          'No': { dose_stable: false }
        },
        required: true
      }
    ],
    systemic_corticosteroids: [
      {
        id: 'daily_dose',
        text: 'What is your current daily dose (in mg prednisone equivalent)?',
        type: 'select',
        options: ['Less than 5mg', '5-10mg', '10-20mg', 'More than 20mg'],
        slotMapping: {
          'Less than 5mg': { daily_dose_mg: 2.5 },
          '5-10mg': { daily_dose_mg: 7.5 },
          '10-20mg': { daily_dose_mg: 15 },
          'More than 20mg': { daily_dose_mg: 25 }
        },
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

CRITICAL RULES:
1. NEVER use type "text" for any question - ALWAYS use "select" with predefined options.
2. For timing questions (when diagnosed, how long), use these options: ["Less than 6 months ago", "6-12 months ago", "1-2 years ago", "2-5 years ago", "More than 5 years ago"]
3. For status questions, use options like: ["Currently active", "In remission", "Resolved/cured", "Controlled with treatment"]
4. For severity questions, use options like: ["Mild", "Moderate", "Severe"]

Return ONLY valid JSON in this format:
{
  "questions": [
    {
      "id": "q1",
      "text": "Question text here",
      "type": "select",
      "options": ["Option1", "Option2", "Option3"],
      "required": true,
      "criterionIds": ["CMB_XXXX", "CMB_YYYY"]
    }
  ]
}

IMPORTANT: For each question, include the "criterionIds" field as an array with ALL relevant criterion IDs (e.g., ["CMB_1234", "CMB_5678"]) that this question addresses. If a question addresses multiple related criteria, include all of them.

Generate 2-5 relevant questions. Be concise.`;

  try {
    const response = await client.generateQuestions(prompt);
    
    // Check if AI returned aiGenerated: false (API error occurred)
    if (response && response.aiGenerated === false) {
      console.log(`⚠ AI API failed for condition: ${conditionName}, using blocking response`);
      return { questions: [], aiGenerated: false };  // Return empty to trigger blocking
    }
    
    if (response && response.questions && Array.isArray(response.questions) && response.questions.length > 0) {
      // Post-process to ensure all questions are select type with proper options
      const processedQuestions = postProcessConditionQuestions(response.questions);
      console.log(`✅ AI generated ${processedQuestions.length} questions for condition: ${conditionName}`);
      // Return with source marker
      return { questions: processedQuestions, aiGenerated: true };
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
  const cacheKey = `condition:${conditionType}`;
  const cached = conditionCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    return {
      questions: cached.questions,
      conditionType,
      conditionName,
      matchingCriteriaCount: cached.matchingCriteriaCount || 0,
      cached: true,
      source: 'memory_cache',
      aiGenerated: cached.aiGenerated !== undefined ? cached.aiGenerated : true
    };
  }

  // Check database cache (NEW: parity with treatments)
  const db = getDatabase();
  if (db) {
    try {
      const dbCached = await db.getAsync(
        'SELECT * FROM followup_cache WHERE drug_class = ? AND expires_at > ?',
        [cacheKey, new Date().toISOString()]
      );

      if (dbCached) {
        const questions = JSON.parse(dbCached.questions);
        const aiGenerated = questions && questions.length > 0;
        
        // Also store in memory cache
        conditionCache.set(cacheKey, {
          questions,
          matchingCriteriaCount: 0,
          aiGenerated,
          expiresAt: new Date(dbCached.expires_at).getTime()
        });

        return {
          questions,
          conditionType,
          conditionName,
          matchingCriteriaCount: 0,
          cached: true,
          source: 'db_cache',
          aiGenerated
        };
      }
    } catch (error) {
      console.error('DB cache lookup failed for condition:', error.message);
    }
  }

  // Load criteria database and find matching criteria
  const database = await loadCriteriaDatabase();
  const matchingCriteria = findMatchingConditionCriteria(database, conditionName, conditionType);

  // Generate questions
  let questions;
  let source = 'default';
  let aiGenerated = false;
  
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

  // Store in memory cache
  const expiresAt = Date.now() + CACHE_TTL;
  conditionCache.set(cacheKey, {
    questions,
    matchingCriteriaCount: matchingCriteria.length,
    source,
    aiGenerated,
    expiresAt
  });

  // Store in database cache (NEW: parity with treatments)
  if (db) {
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO followup_cache (drug_class, questions, created_at, expires_at) 
         VALUES (?, ?, ?, ?)`,
        [cacheKey, JSON.stringify(questions), new Date().toISOString(), new Date(expiresAt).toISOString()]
      );
    } catch (error) {
      console.error('DB cache store failed for condition:', error.message);
    }
  }

  return {
    questions,
    conditionType,
    conditionName,
    matchingCriteriaCount: matchingCriteria.length,
    matchedCriteriaIds: matchingCriteria.map(c => c.id),
    cached: false,
    source,
    aiGenerated
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
      matchedCriteriaIds: cached.matchedCriteriaIds || [], // Preserve from cache
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

  console.log(`📊 Found ${matchingCriteria.length} matching criteria for ${drugName} (class: ${drugClass})`);
  if (matchingCriteria.length > 0) {
    console.log(`📋 Criterion IDs: ${matchingCriteria.slice(0, 10).map(c => c.id).join(', ')}`);
  }

  // Generate questions
  let questions;
  let source = 'default';
  let aiGenerated = false;  // Track if AI actually generated
  
  if (matchingCriteria.length > 0) {
    const result = await generateQuestionsWithAI(drugName, drugClass, matchingCriteria);
    questions = result.questions;
    aiGenerated = result.aiGenerated;
    source = result.aiGenerated ? 'ai' : 'default';
    console.log(`📋 Raw AI response questions: ${JSON.stringify(questions, null, 2)}`);
  } else {
    questions = getDefaultQuestionsWithSlotMapping(drugClass, []);
    source = 'default';
    aiGenerated = false;
  }

  // Store in caches
  const expiresAt = Date.now() + CACHE_TTL;
  const matchedCriteriaIds = matchingCriteria.map(c => c.id);
  memoryCache.set(cacheKey, {
    questions,
    matchingCriteriaCount: matchingCriteria.length,
    matchedCriteriaIds, // Store criterion IDs for debugging/testing
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
    matchedCriteriaIds: matchingCriteria.map(c => c.id), // For debugging/testing
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
