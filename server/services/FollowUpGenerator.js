/**
 * @file Follow-up Question Generator
 * @description AI-driven generation of follow-up questions based on drug category and matching criteria
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

/** Cache TTL: 24 hours */
const CACHE_TTL = 24 * 60 * 60 * 1000;

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

  if (!client.isConfigured()) {
    // Return default questions if no AI configured
    return getDefaultQuestions(drugClass);
  }

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
    const response = await client.semanticMatch(prompt, 'generate questions', 'follow-up generation');
    
    // If the AI returns match result instead of questions, try to parse directly
    if (response.match !== undefined) {
      // Fallback to defaults
      return getDefaultQuestions(drugClass);
    }

    // Parse questions from response
    // Note: Our mock returns the full questions object
    return response.questions || getDefaultQuestions(drugClass);

  } catch (error) {
    console.error('AI question generation failed:', error.message);
    return getDefaultQuestions(drugClass);
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
 * Generate follow-up questions for a drug
 * @param {string} drugName 
 * @returns {Promise<{ questions: Array<Object>, drugClass: string, matchingCriteriaCount: number, cached: boolean }>}
 */
export async function generateFollowUpQuestions(drugName) {
  // Resolve drug category
  const { drugClass, isBiologic, found } = resolveDrugCategory(drugName);

  // Check memory cache first
  const cacheKey = drugClass; // Cache by class, not individual drug
  const cached = memoryCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    return {
      questions: cached.questions,
      drugClass,
      drugName,
      isBiologic,
      matchingCriteriaCount: cached.matchingCriteriaCount || 0,
      cached: true
    };
  }

  // Check database cache
  const db = getDatabase();
  if (db) {
    try {
      const dbCached = await db.getAsync(
        'SELECT * FROM followup_cache WHERE drug_class = ? AND expires_at > ?',
        [drugClass, new Date().toISOString()]
      );

      if (dbCached) {
        const questions = JSON.parse(dbCached.questions);
        // Also store in memory cache
        memoryCache.set(cacheKey, {
          questions,
          matchingCriteriaCount: 0,
          expiresAt: new Date(dbCached.expires_at).getTime()
        });

        return {
          questions,
          drugClass,
          drugName,
          isBiologic,
          matchingCriteriaCount: 0,
          cached: true
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
  if (matchingCriteria.length > 0) {
    questions = await generateQuestionsWithAI(drugName, drugClass, matchingCriteria);
  } else {
    questions = getDefaultQuestions(drugClass);
  }

  // Store in caches
  const expiresAt = Date.now() + CACHE_TTL;
  memoryCache.set(cacheKey, {
    questions,
    matchingCriteriaCount: matchingCriteria.length,
    expiresAt
  });

  // Store in database cache
  if (db) {
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO followup_cache (drug_class, questions, created_at, expires_at) 
         VALUES (?, ?, ?, ?)`,
        [drugClass, JSON.stringify(questions), new Date().toISOString(), new Date(expiresAt).toISOString()]
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
    cached: false
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
  
  const db = getDatabase();
  if (db) {
    try {
      await db.runAsync('DELETE FROM followup_cache');
    } catch (error) {
      console.error('DB cache clear failed:', error.message);
    }
  }
}
