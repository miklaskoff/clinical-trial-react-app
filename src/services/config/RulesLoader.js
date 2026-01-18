/**
 * RulesLoader - Loads configuration and rules from external JSON files
 * 
 * This module provides centralized access to:
 * - Drug classifications and aliases
 * - Medical synonyms
 * - Matching rules
 * 
 * Benefits of externalization:
 * - Non-developers can edit JSON files to add new drugs
 * - No code changes needed for data updates
 * - Easier testing and validation
 * - Clear separation of concerns
 */

import drugClassificationData from '../../config/drug-classification.json';

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
}

/**
 * Gets metadata about the configuration
 * @returns {Object} Metadata (version, lastUpdated, etc.)
 */
export function getMetadata() {
  const data = loadDrugClassification();
  return data.metadata || {};
}

export default {
  getDrugClasses,
  getDrugs,
  getDrugInfo,
  isKnownDrug,
  getDrugsByClass,
  getDrugClass,
  clearCache,
  getMetadata
};
