/**
 * RulesLoader - Loads configuration and rules from external JSON files
 * 
 * This module provides centralized access to:
 * - Drug classifications and aliases
 * - Medical synonyms
 * - Matching rules
 * - Severity levels
 * - Confidence thresholds
 * 
 * Benefits of externalization:
 * - Non-developers can edit JSON files to add new drugs
 * - No code changes needed for data updates
 * - Easier testing and validation
 * - Clear separation of concerns
 */

import drugClassificationData from '../../config/drug-classification.json';
import matchingRulesData from '../../config/matching-rules.json';
import medicalSynonymsData from '../../config/medical-synonyms.json';
import severityLevelsData from '../../config/severity-levels.json';

/**
 * @typedef {Object} DrugInfo
 * @property {string} drugClass - Drug class (e.g., 'TNF_inhibitors')
 * @property {string} drugType - Type (biologic, small_molecule, etc.)
 * @property {string} mechanism - Mechanism of action
 * @property {boolean} isBiologic - Whether it's a biologic
 * @property {boolean} lifetimeExclusion - Whether it causes lifetime exclusion
 * @property {string[]} aliases - Alternative names
 */

/**
 * Cache for loaded configuration
 */
let cachedDrugData = null;
let cachedDrugClasses = null;
let cachedMatchingRules = null;
let cachedMedicalSynonyms = null;
let cachedSeverityLevels = null;

/**
 * Loads and caches drug classification data
 * @returns {Object} Drug classification data
 */
function loadDrugClassification() {
  if (cachedDrugData === null) {
    cachedDrugData = drugClassificationData;
  }
  return cachedDrugData;
}

/**
 * Gets list of all drug classes
 * @returns {string[]} Array of drug class names
 */
export function getDrugClasses() {
  if (cachedDrugClasses === null) {
    const data = loadDrugClassification();
    cachedDrugClasses = data.drugClasses || [];
  }
  return cachedDrugClasses;
}

/**
 * Gets all drug entries
 * @returns {Object<string, DrugInfo>} Map of drug name to info
 */
export function getDrugs() {
  const data = loadDrugClassification();
  return data.drugs || {};
}

/**
 * Gets info for a specific drug by name
 * @param {string} drugName - Drug name (case-insensitive)
 * @returns {DrugInfo|null} Drug info or null if not found
 */
export function getDrugInfo(drugName) {
  if (!drugName) {
    return null;
  }
  const drugs = getDrugs();
  const normalizedName = drugName.toLowerCase().trim();
  return drugs[normalizedName] || null;
}

/**
 * Checks if a drug name exists in the database (direct or alias)
 * @param {string} drugName - Drug name to check
 * @returns {boolean} True if drug is known
 */
export function isKnownDrug(drugName) {
  const normalizedName = drugName.toLowerCase().trim();
  const drugs = getDrugs();
  
  // Check direct entry
  if (drugs[normalizedName]) {
    return true;
  }
  
  // Check aliases
  for (const [, info] of Object.entries(drugs)) {
    const normalizedAliases = info.aliases.map(a => a.toLowerCase());
    if (normalizedAliases.includes(normalizedName)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Gets all drugs in a specific class
 * @param {string} drugClass - Drug class name
 * @returns {string[]} Array of drug names in that class
 */
export function getDrugsByClass(drugClass) {
  const drugs = getDrugs();
  const result = [];
  
  for (const [name, info] of Object.entries(drugs)) {
    if (info.drugClass === drugClass) {
      result.push(name);
    }
  }
  
  return result;
}

/**
 * Gets the drug class for a specific drug
 * @param {string} drugName - Drug name
 * @returns {string|null} Drug class or null
 */
export function getDrugClass(drugName) {
  const info = getDrugInfo(drugName);
  return info?.drugClass || null;
}

/**
 * Clears the cache (useful for testing)
 */
export function clearCache() {
  cachedDrugData = null;
  cachedDrugClasses = null;
  cachedMatchingRules = null;
  cachedMedicalSynonyms = null;
  cachedSeverityLevels = null;
}

/**
 * Gets metadata about the configuration
 * @returns {Object} Metadata (version, lastUpdated, etc.)
 */
export function getMetadata() {
  const data = loadDrugClassification();
  return data.metadata || {};
}

// ============================================
// MATCHING RULES
// ============================================

/**
 * Loads and caches matching rules
 * @returns {Object} Matching rules data
 */
function loadMatchingRules() {
  if (cachedMatchingRules === null) {
    cachedMatchingRules = matchingRulesData;
  }
  return cachedMatchingRules;
}

/**
 * Gets confidence thresholds
 * @returns {Object} Confidence threshold configuration
 */
export function getConfidenceThresholds() {
  return loadMatchingRules().confidenceThresholds || {};
}

/**
 * Gets confidence value by match type
 * @param {string} matchType - Type of match (e.g., 'directMatch', 'databaseMatch')
 * @returns {number} Confidence value
 */
export function getConfidenceByMatchType(matchType) {
  const thresholds = getConfidenceThresholds();
  return thresholds.byMatchType?.[matchType] ?? 0.5;
}

/**
 * Gets AI confidence settings
 * @returns {Object} AI confidence configuration
 */
export function getAIConfidenceSettings() {
  const thresholds = getConfidenceThresholds();
  return thresholds.ai || { confidenceCap: 0.9, unavailableFallback: 0.5, errorFallback: 0.5 };
}

/**
 * Gets time conversion factors
 * @returns {Object} Time unit to weeks conversion factors
 */
export function getTimeConversions() {
  return loadMatchingRules().timeConversions || {
    days: 0.142857,
    weeks: 1,
    months: 4.33,
    years: 52
  };
}

/**
 * Gets measurement types for a cluster
 * @param {string} clusterId - Cluster ID (e.g., 'AAO', 'SEV')
 * @returns {string[]} Array of measurement type names
 */
export function getMeasurementTypes(clusterId) {
  const rules = loadMatchingRules();
  return rules.measurementTypes?.[clusterId] || [];
}

/**
 * Gets cluster configuration
 * @param {string} clusterId - Cluster ID
 * @returns {Object} Cluster configuration
 */
export function getClusterConfig(clusterId) {
  const rules = loadMatchingRules();
  return rules.clusterConfig?.[clusterId] || { aiEnabled: false };
}

/**
 * Checks if AI is enabled for a cluster
 * @param {string} clusterId - Cluster ID
 * @returns {boolean} True if AI fallback is enabled
 */
export function isAIEnabledForCluster(clusterId) {
  return getClusterConfig(clusterId).aiEnabled === true;
}

/**
 * Gets list of all cluster IDs
 * @returns {string[]} Array of cluster IDs
 */
export function getClusterRouting() {
  return loadMatchingRules().clusterRouting || [];
}

// ============================================
// MEDICAL SYNONYMS
// ============================================

/**
 * Loads and caches medical synonyms
 * @returns {Object} Medical synonyms data
 */
function loadMedicalSynonyms() {
  if (cachedMedicalSynonyms === null) {
    cachedMedicalSynonyms = medicalSynonymsData;
  }
  return cachedMedicalSynonyms;
}

/**
 * Gets condition synonyms
 * @returns {Object} Map of condition to synonyms array
 */
export function getConditionSynonyms() {
  return loadMedicalSynonyms().conditions || {};
}

/**
 * Finds synonyms for a condition
 * @param {string} condition - Condition name
 * @returns {string[]} Array of synonyms including original
 */
export function findConditionSynonyms(condition) {
  if (!condition) return [];
  const normalized = condition.toLowerCase().trim();
  const synonyms = getConditionSynonyms();
  
  // Check if it's a key
  if (synonyms[normalized]) {
    return [normalized, ...synonyms[normalized]];
  }
  
  // Check if it's a value in any synonym list
  for (const [key, values] of Object.entries(synonyms)) {
    const normalizedValues = values.map(v => v.toLowerCase());
    if (normalizedValues.includes(normalized)) {
      return [key, ...values];
    }
  }
  
  return [condition];
}

/**
 * Gets drug class keywords
 * @returns {Object} Map of drug class to keywords array
 */
export function getDrugClassKeywords() {
  return loadMedicalSynonyms().drugClassKeywords || {};
}

/**
 * Gets anatomical mappings
 * @returns {Object} Map of body part to synonyms
 */
export function getAnatomicalMappings() {
  return loadMedicalSynonyms().anatomicalMappings || {};
}

// ============================================
// SEVERITY LEVELS
// ============================================

/**
 * Loads and caches severity levels
 * @returns {Object} Severity levels data
 */
function loadSeverityLevels() {
  if (cachedSeverityLevels === null) {
    cachedSeverityLevels = severityLevelsData;
  }
  return cachedSeverityLevels;
}

/**
 * Gets severity level numeric value
 * @param {string} severity - Severity name (e.g., 'mild', 'severe')
 * @returns {number|null} Numeric level or null if unknown
 */
export function getSeverityLevel(severity) {
  if (!severity) return null;
  const normalized = severity.toLowerCase().trim();
  const data = loadSeverityLevels();
  
  // Check direct level
  if (data.levels[normalized] !== undefined) {
    return data.levels[normalized];
  }
  
  // Check aliases
  const aliasTarget = data.aliases?.[normalized];
  if (aliasTarget && data.levels[aliasTarget] !== undefined) {
    return data.levels[aliasTarget];
  }
  
  return null;
}

/**
 * Gets all severity levels
 * @returns {Object} Map of severity name to numeric value
 */
export function getAllSeverityLevels() {
  return loadSeverityLevels().levels || {};
}

/**
 * Gets severity aliases
 * @returns {Object} Map of alias to canonical severity name
 */
export function getSeverityAliases() {
  return loadSeverityLevels().aliases || {};
}

export default {
  // Drug classification
  getDrugClasses,
  getDrugs,
  getDrugInfo,
  isKnownDrug,
  getDrugsByClass,
  getDrugClass,
  getMetadata,
  
  // Matching rules
  getConfidenceThresholds,
  getConfidenceByMatchType,
  getAIConfidenceSettings,
  getTimeConversions,
  getMeasurementTypes,
  getClusterConfig,
  isAIEnabledForCluster,
  getClusterRouting,
  
  // Medical synonyms
  getConditionSynonyms,
  findConditionSynonyms,
  getDrugClassKeywords,
  getAnatomicalMappings,
  
  // Severity levels
  getSeverityLevel,
  getAllSeverityLevels,
  getSeverityAliases,
  
  // Cache management
  clearCache
};
