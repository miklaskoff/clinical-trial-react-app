/**
 * Matcher services barrel export
 * @module services/matcher
 */

export { ClinicalTrialMatcher, default } from './ClinicalTrialMatcher.js';
export { CriterionMatchResult, TrialEligibilityResult, PatientMatchResults } from './results.js';
export {
  DRUG_DATABASE,
  MEDICAL_SYNONYMS,
  getDrugInfo,
  drugsMatch,
  drugBelongsToClass,
  findSynonyms,
} from './drugDatabase.js';
