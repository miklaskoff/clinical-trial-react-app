/**
 * @file output-validator.js
 * @description Post-processing validator for LLM parser output
 * 
 * Ensures consistent schema compliance across all parsed criteria.
 * Adds missing required fields, validates types, reports errors/warnings.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMAS_PATH = path.join(__dirname, 'output-schemas.json');

// Load schemas at module initialization
let schemas = null;

function loadSchemas() {
  if (!schemas) {
    const content = fs.readFileSync(SCHEMAS_PATH, 'utf8');
    schemas = JSON.parse(content);
  }
  return schemas;
}

/**
 * @typedef {Object} ValidationResult
 * @property {Object} criterion - The validated/fixed criterion
 * @property {boolean} isValid - Whether criterion passed validation
 * @property {string[]} errors - Critical errors (invalid data)
 * @property {string[]} warnings - Non-critical warnings (missing optional fields, etc.)
 */

/**
 * Get schema for a specific cluster
 * @param {string} clusterCode - Cluster code (CMB, AGE, etc.)
 * @returns {Object} Schema with required and optional fields
 * @throws {Error} If cluster is unknown
 */
export function getSchemaForCluster(clusterCode) {
  const schema = loadSchemas();
  
  if (!schema.clusters[clusterCode]) {
    // Return empty schema for unknown clusters instead of throwing
    return { required: [], optional: [] };
  }
  
  return schema.clusters[clusterCode];
}

/**
 * Add missing required fields with defaults or inferred values
 * @param {Object} criterion - Raw criterion from LLM
 * @param {string} clusterCode - Cluster code
 * @returns {Object} Criterion with all required fields
 */
export function addMissingFields(criterion, clusterCode) {
  const schema = loadSchemas();
  const clusterSchema = schema.clusters[clusterCode] || { required: [], optional: [] };
  const defaults = schema.defaults;
  const inference = schema.inferenceRules;
  
  // Create a copy to avoid mutating input
  const result = { ...criterion };
  
  // 1. Infer CRITERION_TYPE from original.criterion_type if missing
  if (!result.CRITERION_TYPE) {
    if (result.original?.criterion_type) {
      result.CRITERION_TYPE = result.original.criterion_type;
    } else {
      result.CRITERION_TYPE = inference.CRITERION_TYPE.fallback;
    }
  }
  
  // 2. Infer EXCLUSION_STRENGTH based on CRITERION_TYPE
  if (!result.EXCLUSION_STRENGTH) {
    const criterionType = result.CRITERION_TYPE || 'exclusion';
    result.EXCLUSION_STRENGTH = inference.EXCLUSION_STRENGTH.fromCriterionType[criterionType];
  }
  
  // 3. Add SUBJECTIVE_ESTIMATE from REQUIRES_CLINICAL_JUDGMENT
  if (result.SUBJECTIVE_ESTIMATE === undefined) {
    result.SUBJECTIVE_ESTIMATE = result.REQUIRES_CLINICAL_JUDGMENT || inference.SUBJECTIVE_ESTIMATE.fallback;
  }
  
  // 4. Add default confidence if missing
  if (result.confidence === undefined) {
    result.confidence = defaults.confidence;
  }
  
  // 5. Add default parsing_status if missing
  if (!result.parsing_status) {
    result.parsing_status = defaults.parsing_status;
  }
  
  // 6. Add default unfamiliar_term_flag if missing
  if (result.unfamiliar_term_flag === undefined) {
    result.unfamiliar_term_flag = defaults.unfamiliar_term_flag;
  }
  
  // 7. Ensure array fields are initialized (for CMB cluster specifically)
  const arrayFields = ['CONDITION_TYPE', 'CONDITION_PATTERN', 'SEVERITY', 'ANATOMICAL_LOCATION'];
  for (const field of arrayFields) {
    if (clusterSchema.required?.includes(field) || clusterSchema.optional?.includes(field)) {
      if (result[field] === undefined) {
        result[field] = defaults[field] || [];
      }
    }
  }
  
  // 8. Ensure ALL optional fields are present (consistency requirement)
  // All fields should be present, with null/false/[] if not used
  // NOTE: Array-type fields use [] not null to pass validation
  const optionalFieldDefaults = {
    '_thought_process': null,
    'LOGICAL_OPERATOR': null,
    'NESTED_CONDITION': null,
    'NEGATION_DETECTED': null,
    'EXCEPTION_CONDITION': null,
    'TIMEFRAME': null,
    'TREATMENT_HISTORY': [],      // Array type - use []
    'MEASUREMENTS': [],           // Array type - use []
    'REQUIRES_CLINICAL_JUDGMENT': false,
    'AMBIGUITY_FLAG': false,
    'PSORIASIS_VARIANT': [],      // Array type - use []
    'AGE_MIN': null,
    'AGE_MAX': null,
    'AGE_UNIT': 'years',          // Default unit for age
    'BMI_MIN': null,
    'BMI_MAX': null,
    'WEIGHT_MIN': null,
    'WEIGHT_MAX': null,
    'WEIGHT_UNIT': 'kg'           // Default unit for weight
  };
  
  // Add all optional fields from cluster schema with appropriate defaults
  for (const field of clusterSchema.optional || []) {
    if (result[field] === undefined) {
      if (optionalFieldDefaults[field] !== undefined) {
        result[field] = optionalFieldDefaults[field];
      } else if (arrayFields.includes(field)) {
        result[field] = [];
      } else {
        result[field] = null;
      }
    }
  }
  
  return result;
}

/**
 * Validate and fix field types
 * @param {Object} criterion - Criterion to validate
 * @param {string} clusterCode - Cluster code
 * @returns {{ criterion: Object, errors: string[], warnings: string[] }}
 */
export function validateFieldTypes(criterion, clusterCode) {
  const schema = loadSchemas();
  const fieldTypes = schema.fieldTypes;
  
  const errors = [];
  const warnings = [];
  const result = { ...criterion };
  
  // Array fields that should be arrays
  const arrayFields = ['CONDITION_TYPE', 'CONDITION_PATTERN', 'SEVERITY', 'ANATOMICAL_LOCATION', 'PSORIASIS_VARIANT'];
  
  for (const field of arrayFields) {
    if (result[field] !== undefined && !Array.isArray(result[field])) {
      // Convert string to array
      if (typeof result[field] === 'string') {
        result[field] = [result[field]];
        warnings.push(`${field} was string, converted to array`);
      } else {
        errors.push(`${field} must be an array, got ${typeof result[field]}`);
      }
    }
  }
  
  // Validate LOGICAL_OPERATOR enum
  if (result.LOGICAL_OPERATOR !== undefined && result.LOGICAL_OPERATOR !== null) {
    const validOperators = ['AND', 'OR'];
    if (!validOperators.includes(result.LOGICAL_OPERATOR)) {
      errors.push(`LOGICAL_OPERATOR must be 'AND', 'OR', or null, got '${result.LOGICAL_OPERATOR}'`);
    }
  }
  
  // Validate EXCLUSION_STRENGTH enum
  if (result.EXCLUSION_STRENGTH !== undefined) {
    const validStrengths = ['mandatory_exclude', 'conditional_exclude', 'mandatory_include', 'conditional_include'];
    if (!validStrengths.includes(result.EXCLUSION_STRENGTH)) {
      errors.push(`EXCLUSION_STRENGTH must be one of ${validStrengths.join(', ')}, got '${result.EXCLUSION_STRENGTH}'`);
    }
  }
  
  // Validate CRITERION_TYPE enum
  if (result.CRITERION_TYPE !== undefined) {
    const validTypes = ['inclusion', 'exclusion'];
    if (!validTypes.includes(result.CRITERION_TYPE)) {
      errors.push(`CRITERION_TYPE must be 'inclusion' or 'exclusion', got '${result.CRITERION_TYPE}'`);
    }
  }
  
  // Validate MEASUREMENTS is array of objects
  if (result.MEASUREMENTS !== undefined) {
    if (!Array.isArray(result.MEASUREMENTS)) {
      errors.push(`MEASUREMENTS must be an array, got ${typeof result.MEASUREMENTS}`);
    } else {
      // Validate each measurement object
      for (let i = 0; i < result.MEASUREMENTS.length; i++) {
        const m = result.MEASUREMENTS[i];
        if (typeof m !== 'object' || m === null) {
          errors.push(`MEASUREMENTS[${i}] must be an object`);
        }
      }
    }
  }
  
  // Validate NESTED_CONDITION structure
  if (result.NESTED_CONDITION !== undefined && result.NESTED_CONDITION !== null) {
    if (typeof result.NESTED_CONDITION !== 'object') {
      errors.push(`NESTED_CONDITION must be an object, got ${typeof result.NESTED_CONDITION}`);
    } else {
      const requiredNested = ['main_condition', 'nested_operator', 'nested_items'];
      for (const subField of requiredNested) {
        if (result.NESTED_CONDITION[subField] === undefined) {
          warnings.push(`NESTED_CONDITION missing recommended sub-field: ${subField}`);
        }
      }
    }
  }
  
  // Validate parsing_status enum
  if (result.parsing_status !== undefined) {
    const validStatuses = ['complete', 'pending_admin_review', 'error'];
    if (!validStatuses.includes(result.parsing_status)) {
      warnings.push(`parsing_status should be one of ${validStatuses.join(', ')}, got '${result.parsing_status}'`);
    }
  }
  
  // Validate confidence is a number
  if (result.confidence !== undefined && typeof result.confidence !== 'number') {
    errors.push(`confidence must be a number, got ${typeof result.confidence}`);
  }
  
  // Validate TIMEFRAME structure (object with relation, amount, unit, reference)
  if (result.TIMEFRAME !== undefined && result.TIMEFRAME !== null) {
    if (typeof result.TIMEFRAME !== 'object') {
      errors.push(`TIMEFRAME must be an object, got ${typeof result.TIMEFRAME}`);
    } else {
      const validRelations = ['within', 'before', 'after', 'during', 'at_least', 'at_most', 'exactly'];
      if (result.TIMEFRAME.relation && !validRelations.includes(result.TIMEFRAME.relation)) {
        warnings.push(`TIMEFRAME.relation should be one of ${validRelations.join(', ')}, got '${result.TIMEFRAME.relation}'`);
      }
      if (result.TIMEFRAME.amount !== undefined && typeof result.TIMEFRAME.amount !== 'number') {
        errors.push(`TIMEFRAME.amount must be a number, got ${typeof result.TIMEFRAME.amount}`);
      }
      const validUnits = ['days', 'weeks', 'months', 'years', 'hours', 'minutes'];
      if (result.TIMEFRAME.unit && !validUnits.includes(result.TIMEFRAME.unit)) {
        warnings.push(`TIMEFRAME.unit should be one of ${validUnits.join(', ')}, got '${result.TIMEFRAME.unit}'`);
      }
    }
  }
  
  // Validate EXCEPTION_CONDITION structure
  if (result.EXCEPTION_CONDITION !== undefined && result.EXCEPTION_CONDITION !== null) {
    if (typeof result.EXCEPTION_CONDITION !== 'object') {
      errors.push(`EXCEPTION_CONDITION must be an object, got ${typeof result.EXCEPTION_CONDITION}`);
    } else {
      // Check expected sub-fields
      if (result.EXCEPTION_CONDITION.excluded_types !== undefined && !Array.isArray(result.EXCEPTION_CONDITION.excluded_types)) {
        errors.push(`EXCEPTION_CONDITION.excluded_types must be an array`);
      }
      if (result.EXCEPTION_CONDITION.anatomical_location !== undefined && !Array.isArray(result.EXCEPTION_CONDITION.anatomical_location)) {
        errors.push(`EXCEPTION_CONDITION.anatomical_location must be an array`);
      }
      if (result.EXCEPTION_CONDITION.makes_eligible !== undefined && typeof result.EXCEPTION_CONDITION.makes_eligible !== 'boolean') {
        warnings.push(`EXCEPTION_CONDITION.makes_eligible should be a boolean`);
      }
    }
  }
  
  // Validate NEGATION_DETECTED structure
  if (result.NEGATION_DETECTED !== undefined && result.NEGATION_DETECTED !== null) {
    if (typeof result.NEGATION_DETECTED !== 'object') {
      errors.push(`NEGATION_DETECTED must be an object, got ${typeof result.NEGATION_DETECTED}`);
    } else {
      if (result.NEGATION_DETECTED.is_negated !== undefined && typeof result.NEGATION_DETECTED.is_negated !== 'boolean') {
        errors.push(`NEGATION_DETECTED.is_negated must be a boolean`);
      }
    }
  }
  
  // Validate boolean fields
  const booleanFields = ['REQUIRES_CLINICAL_JUDGMENT', 'AMBIGUITY_FLAG', 'unfamiliar_term_flag', 'SUBJECTIVE_ESTIMATE'];
  for (const field of booleanFields) {
    if (result[field] !== undefined && typeof result[field] !== 'boolean') {
      // Try to convert string "true"/"false" to boolean
      if (result[field] === 'true') {
        result[field] = true;
        warnings.push(`${field} was string 'true', converted to boolean`);
      } else if (result[field] === 'false') {
        result[field] = false;
        warnings.push(`${field} was string 'false', converted to boolean`);
      } else {
        errors.push(`${field} must be a boolean, got ${typeof result[field]}`);
      }
    }
  }
  
  // Validate AGE fields (for AGE cluster)
  if (result.AGE_MIN !== undefined && result.AGE_MIN !== null && typeof result.AGE_MIN !== 'number') {
    errors.push(`AGE_MIN must be a number or null, got ${typeof result.AGE_MIN}`);
  }
  if (result.AGE_MAX !== undefined && result.AGE_MAX !== null && typeof result.AGE_MAX !== 'number') {
    errors.push(`AGE_MAX must be a number or null, got ${typeof result.AGE_MAX}`);
  }
  if (result.AGE_UNIT !== undefined && typeof result.AGE_UNIT !== 'string') {
    errors.push(`AGE_UNIT must be a string, got ${typeof result.AGE_UNIT}`);
  }
  
  // Validate BMI/WEIGHT fields (for BMI cluster)
  const numericNullableFields = ['BMI_MIN', 'BMI_MAX', 'WEIGHT_MIN', 'WEIGHT_MAX'];
  for (const field of numericNullableFields) {
    if (result[field] !== undefined && result[field] !== null && typeof result[field] !== 'number') {
      errors.push(`${field} must be a number or null, got ${typeof result[field]}`);
    }
  }
  
  return { criterion: result, errors, warnings };
}

// ============================================================================
// AD-HOC FIELD DETECTION (Iteration 2.3)
// ============================================================================

/**
 * Get list of valid nested_items.type values from schema
 * @returns {string[]} Array of valid type values
 */
export function getValidNestedItemTypes() {
  const schema = loadSchemas();
  return schema.validNestedItemTypes || [
    'CONDITION_TYPE',
    'ANATOMICAL_LOCATION',
    'SEVERITY',
    'TIMEFRAME',
    'TREATMENT_HISTORY',
    'CONDITION_PATTERN',
    'MEASUREMENT',
    'TREATMENT_REQUIREMENT',
    'EXCEPTION'
  ];
}

/**
 * Get list of valid TREATMENT_HISTORY subfields from schema
 * @returns {string[]} Array of valid subfield names
 */
export function getValidTreatmentHistorySubfields() {
  const schema = loadSchemas();
  return schema.validTreatmentHistorySubfields || [
    'treatment',
    'treatment_class',
    'response',
    'timing',
    'confidence',
    'requires_hospitalization',
    'duration',
    'count',
    'route',
    'dose',
    'frequency'
  ];
}

/**
 * Get list of valid NEGATION_DETECTED fields from schema
 * @returns {string[]} Array of valid field names
 */
export function getValidNegationDetectedFields() {
  const schema = loadSchemas();
  return schema.validNegationDetectedFields || [
    'is_negated',
    'negated_term',
    'context',
    'negation_type',
    'interpretation',
    'affected_fields',
    'parsing_note'
  ];
}

/**
 * Validate nested_items.type values against whitelist
 * @param {Object} criterion - Criterion with potential NESTED_CONDITION
 * @returns {{ validTypes: string[], adhocNestedTypes: string[] }}
 */
export function validateNestedItemsTypes(criterion) {
  const validTypes = getValidNestedItemTypes();
  const result = {
    validTypes: [],
    adhocNestedTypes: []
  };
  
  if (!criterion.NESTED_CONDITION?.nested_items) {
    return result;
  }
  
  for (const item of criterion.NESTED_CONDITION.nested_items) {
    if (item.type) {
      if (validTypes.includes(item.type)) {
        if (!result.validTypes.includes(item.type)) {
          result.validTypes.push(item.type);
        }
      } else {
        if (!result.adhocNestedTypes.includes(item.type)) {
          result.adhocNestedTypes.push(item.type);
        }
      }
    }
  }
  
  return result;
}

/**
 * Validate TREATMENT_HISTORY subfields against whitelist
 * @param {Object|Object[]} treatmentHistory - TREATMENT_HISTORY value (object or array)
 * @returns {{ validSubfields: string[], undefinedSubfields: string[] }}
 */
export function validateTreatmentHistorySubfields(treatmentHistory) {
  const validSubfields = getValidTreatmentHistorySubfields();
  const result = {
    validSubfields: [],
    undefinedSubfields: []
  };
  
  if (!treatmentHistory) {
    return result;
  }
  
  // Normalize to array
  const entries = Array.isArray(treatmentHistory) ? treatmentHistory : [treatmentHistory];
  
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    
    for (const key of Object.keys(entry)) {
      if (validSubfields.includes(key)) {
        if (!result.validSubfields.includes(key)) {
          result.validSubfields.push(key);
        }
      } else {
        if (!result.undefinedSubfields.includes(key)) {
          result.undefinedSubfields.push(key);
        }
      }
    }
  }
  
  return result;
}

/**
 * Validate NEGATION_DETECTED structure against whitelist
 * @param {Object} negation - NEGATION_DETECTED value
 * @returns {{ isValid: boolean, validFields: string[], unknownFields: string[] }}
 */
export function validateNegationDetectedStructure(negation) {
  const validFields = getValidNegationDetectedFields();
  const result = {
    isValid: true,
    validFields: [],
    unknownFields: []
  };
  
  if (!negation || typeof negation !== 'object') {
    return result;
  }
  
  for (const key of Object.keys(negation)) {
    if (validFields.includes(key)) {
      result.validFields.push(key);
    } else {
      result.unknownFields.push(key);
      result.isValid = false;
    }
  }
  
  return result;
}

/**
 * Detect all ad-hoc fields in a criterion
 * @param {Object} criterion - Parsed criterion
 * @param {string} clusterCode - Cluster code (CMB, AIC, etc.)
 * @returns {{
 *   isValid: boolean,
 *   hasAdhocFields: boolean,
 *   unknownTopLevel: string[],
 *   adhocNestedTypes: string[],
 *   undefinedTreatmentHistorySubfields: string[],
 *   unknownNegationFields: string[]
 * }}
 */
export function detectAdhocFields(criterion, clusterCode) {
  const schema = loadSchemas();
  const clusterSchema = schema.clusters[clusterCode];
  
  if (!clusterSchema) {
    throw new Error(`Unknown cluster: ${clusterCode}`);
  }
  
  const result = {
    isValid: true,
    hasAdhocFields: false,
    unknownTopLevel: [],
    adhocNestedTypes: [],
    undefinedTreatmentHistorySubfields: [],
    unknownNegationFields: []
  };
  
  // 1. Detect unknown top-level fields
  const allAllowedFields = new Set([
    ...(clusterSchema?.required || []),
    ...(clusterSchema?.optional || []),
    ...(schema.commonFields?.required || []),
    ...(schema.commonFields?.optional || [])
  ]);
  
  for (const key of Object.keys(criterion)) {
    if (!allAllowedFields.has(key)) {
      result.unknownTopLevel.push(key);
    }
  }
  
  // 2. Detect ad-hoc nested_items.type values
  const nestedValidation = validateNestedItemsTypes(criterion);
  result.adhocNestedTypes = nestedValidation.adhocNestedTypes;
  
  // 3. Detect undefined TREATMENT_HISTORY subfields
  if (criterion.TREATMENT_HISTORY) {
    const thValidation = validateTreatmentHistorySubfields(criterion.TREATMENT_HISTORY);
    result.undefinedTreatmentHistorySubfields = thValidation.undefinedSubfields;
  }
  
  // 4. Detect unknown NEGATION_DETECTED fields
  if (criterion.NEGATION_DETECTED) {
    const negValidation = validateNegationDetectedStructure(criterion.NEGATION_DETECTED);
    result.unknownNegationFields = negValidation.unknownFields;
  }
  
  // Determine if any ad-hoc fields were found
  result.hasAdhocFields = (
    result.unknownTopLevel.length > 0 ||
    result.adhocNestedTypes.length > 0 ||
    result.undefinedTreatmentHistorySubfields.length > 0 ||
    result.unknownNegationFields.length > 0
  );
  
  result.isValid = !result.hasAdhocFields;
  
  return result;
}

/**
 * Validate and fix a single criterion
 * @param {Object} rawCriterion - Raw criterion from LLM output
 * @param {string} clusterCode - Cluster code (CMB, AGE, etc.)
 * @returns {ValidationResult}
 */
export function validateCriterion(rawCriterion, clusterCode) {
  const errors = [];
  const warnings = [];
  
  // 1. Check basic required fields exist
  const basicRequired = ['id', 'nct_id', 'raw_text'];
  for (const field of basicRequired) {
    if (!rawCriterion[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // 2. Add missing fields with defaults/inference
  let criterion = addMissingFields(rawCriterion, clusterCode);
  
  // 3. Validate and fix field types
  const typeValidation = validateFieldTypes(criterion, clusterCode);
  criterion = typeValidation.criterion;
  errors.push(...typeValidation.errors);
  warnings.push(...typeValidation.warnings);
  
  // 4. Check cluster-specific required fields
  try {
    const clusterSchema = getSchemaForCluster(clusterCode);
    const requiredFields = clusterSchema?.required || [];
    for (const field of requiredFields) {
      if (criterion[field] === undefined || criterion[field] === null) {
        // Skip if already in basic required check
        if (!basicRequired.includes(field)) {
          warnings.push(`Missing cluster-required field: ${field}`);
        }
      }
    }
  } catch (e) {
    errors.push(e.message);
  }
  
  return {
    criterion,
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate an array of criteria
 * @param {Object[]} criteria - Array of criteria
 * @param {string} clusterCode - Cluster code
 * @returns {{ criteria: Object[], stats: Object, errors: Object[] }}
 */
export function validateBatch(criteria, clusterCode) {
  const results = criteria.map(c => validateCriterion(c, clusterCode));
  
  const stats = {
    total: criteria.length,
    valid: results.filter(r => r.isValid).length,
    withWarnings: results.filter(r => r.warnings.length > 0).length,
    withErrors: results.filter(r => r.errors.length > 0).length
  };
  
  const errorDetails = results
    .filter(r => r.errors.length > 0)
    .map(r => ({
      id: r.criterion.id,
      errors: r.errors
    }));
  
  return {
    criteria: results.map(r => r.criterion),
    stats,
    errors: errorDetails
  };
}

/**
 * Consistency Rules for cross-criterion validation
 * Each rule checks if text patterns are reflected in parsed fields
 */
export const CONSISTENCY_RULES = [
  // CONDITION_PATTERN rules
  {
    name: 'PATTERN_HISTORY',
    field: 'CONDITION_PATTERN',
    textPattern: /\bhistory\s+of\b/i,
    expectedValue: 'history',
    errorCode: 'PATTERN_MISMATCH'
  },
  {
    name: 'PATTERN_ACTIVE',
    field: 'CONDITION_PATTERN',
    textPattern: /\bactive\b/i,
    expectedValue: 'active',
    errorCode: 'PATTERN_MISMATCH'
  },
  {
    name: 'PATTERN_CURRENT',
    field: 'CONDITION_PATTERN',
    textPattern: /\bcurrent\b/i,
    expectedValue: 'current',
    errorCode: 'PATTERN_MISMATCH'
  },
  {
    name: 'PATTERN_PRIOR',
    field: 'CONDITION_PATTERN',
    textPattern: /\bprior\b/i,
    expectedValue: 'prior',
    errorCode: 'PATTERN_MISMATCH'
  },
  {
    name: 'PATTERN_PREVIOUS',
    field: 'CONDITION_PATTERN',
    textPattern: /\bprevious\b/i,
    expectedValue: 'previous',
    errorCode: 'PATTERN_MISMATCH'
  },
  
  // SEVERITY rules
  {
    name: 'SEVERITY_SEVERE',
    field: 'SEVERITY',
    textPattern: /\bsevere\b/i,
    expectedValue: 'severe',
    errorCode: 'SEVERITY_MISMATCH'
  },
  {
    name: 'SEVERITY_ACUTE',
    field: 'SEVERITY',
    textPattern: /\bacute\b/i,
    expectedValue: 'acute',
    errorCode: 'SEVERITY_MISMATCH'
  },
  {
    name: 'SEVERITY_CHRONIC',
    field: 'SEVERITY',
    textPattern: /\bchronic\b/i,
    expectedValue: 'chronic',
    errorCode: 'SEVERITY_MISMATCH'
  },
  {
    name: 'SEVERITY_MILD',
    field: 'SEVERITY',
    textPattern: /\bmild\b/i,
    expectedValue: 'mild',
    errorCode: 'SEVERITY_MISMATCH'
  },
  {
    name: 'SEVERITY_MODERATE',
    field: 'SEVERITY',
    textPattern: /\bmoderate\b/i,
    expectedValue: 'moderate',
    errorCode: 'SEVERITY_MISMATCH'
  },
  
  // REQUIRES_CLINICAL_JUDGMENT rules
  {
    name: 'JUDGMENT_CLINICALLY_SIGNIFICANT',
    field: 'REQUIRES_CLINICAL_JUDGMENT',
    textPattern: /\bclinically\s+significant\b/i,
    expectedValue: true,
    errorCode: 'JUDGMENT_MISMATCH'
  },
  {
    name: 'JUDGMENT_INVESTIGATOR',
    field: 'REQUIRES_CLINICAL_JUDGMENT',
    textPattern: /\binvestigator('s)?\s+(judgment|opinion|discretion)\b/i,
    expectedValue: true,
    errorCode: 'JUDGMENT_MISMATCH'
  },
  {
    name: 'JUDGMENT_PHYSICIAN',
    field: 'REQUIRES_CLINICAL_JUDGMENT',
    textPattern: /\bphysician('s)?\s+(judgment|opinion|discretion)\b/i,
    expectedValue: true,
    errorCode: 'JUDGMENT_MISMATCH'
  },
  
  // EXCEPTION_CONDITION rules
  {
    name: 'EXCEPTION_EXCLUDING',
    field: 'EXCEPTION_CONDITION',
    textPattern: /\bexcluding\b/i,
    expectedValue: 'non-null',
    errorCode: 'EXCEPTION_MISMATCH'
  },
  {
    name: 'EXCEPTION_EXCEPT',
    field: 'EXCEPTION_CONDITION',
    textPattern: /\bexcept\b/i,
    expectedValue: 'non-null',
    errorCode: 'EXCEPTION_MISMATCH'
  },
  {
    name: 'EXCEPTION_OTHER_THAN',
    field: 'EXCEPTION_CONDITION',
    textPattern: /\bother\s+than\b/i,
    expectedValue: 'non-null',
    errorCode: 'EXCEPTION_MISMATCH'
  },
  
  // NEGATION_DETECTED rules
  {
    name: 'NEGATION_NON_PREFIX',
    field: 'NEGATION_DETECTED',
    textPattern: /\bnon-\w+/i,
    expectedValue: 'is_negated_true',
    errorCode: 'NEGATION_MISMATCH'
  },
  {
    name: 'NEGATION_NO_HISTORY',
    field: 'NEGATION_DETECTED',
    textPattern: /\bno\s+history\s+of\b/i,
    expectedValue: 'is_negated_true',
    errorCode: 'NEGATION_MISMATCH'
  },
  {
    name: 'NEGATION_WITHOUT',
    field: 'NEGATION_DETECTED',
    textPattern: /\bwithout\s+(a\s+)?history\b/i,
    expectedValue: 'is_negated_true',
    errorCode: 'NEGATION_MISMATCH'
  }
];

/**
 * Find similar criteria based on CONDITION_TYPE overlap or shared text patterns
 * @param {Object} criterion - The criterion to find similar ones for
 * @param {Object[]} allCriteria - All criteria in the dataset
 * @param {number} maxResults - Maximum number of similar criteria to return
 * @returns {Object[]} Array of similar criteria
 */
export function findSimilarCriteria(criterion, allCriteria, maxResults = 3) {
  const criterionId = criterion.id;
  const rawText = criterion.raw_text || '';
  
  // Collect patterns present in this criterion's raw_text
  const criterionPatterns = CONSISTENCY_RULES
    .filter(rule => rule.textPattern.test(rawText))
    .map(rule => rule.textPattern);
  
  // Check if criterion has valid CONDITION_TYPE
  const hasConditionType = criterion?.CONDITION_TYPE && 
    Array.isArray(criterion.CONDITION_TYPE) && 
    criterion.CONDITION_TYPE.length > 0;
  
  const criterionTypes = hasConditionType 
    ? new Set(criterion.CONDITION_TYPE.map(t => t.toLowerCase()))
    : new Set();
  
  // Find similar criteria based on CONDITION_TYPE overlap OR shared patterns
  const similarCriteria = allCriteria
    .filter(c => {
      // Exclude self
      if (c.id === criterionId) return false;
      
      // Check CONDITION_TYPE overlap
      if (hasConditionType && c.CONDITION_TYPE && Array.isArray(c.CONDITION_TYPE) && c.CONDITION_TYPE.length > 0) {
        if (c.CONDITION_TYPE.some(t => criterionTypes.has(t.toLowerCase()))) {
          return true;
        }
      }
      
      // Check shared text patterns (e.g., both have "history of")
      if (criterionPatterns.length > 0) {
        const otherRawText = c.raw_text || '';
        const sharesPattern = criterionPatterns.some(pattern => pattern.test(otherRawText));
        if (sharesPattern) {
          return true;
        }
      }
      
      return false;
    })
    .slice(0, maxResults);
  
  return similarCriteria;
}

/**
 * Check if a field value matches the expected value
 * @param {*} fieldValue - The actual field value
 * @param {*} expectedValue - The expected value or pattern
 * @param {string} field - Field name for type-specific checks
 * @returns {boolean}
 */
function fieldMatchesExpected(fieldValue, expectedValue, field) {
  // For array fields (CONDITION_PATTERN, SEVERITY, etc.)
  if (Array.isArray(fieldValue)) {
    return fieldValue.some(v => v.toLowerCase().includes(expectedValue.toLowerCase()));
  }
  
  // For boolean fields (REQUIRES_CLINICAL_JUDGMENT)
  if (expectedValue === true || expectedValue === false) {
    return fieldValue === expectedValue;
  }
  
  // For "non-null" check (EXCEPTION_CONDITION)
  if (expectedValue === 'non-null') {
    return fieldValue !== null && fieldValue !== undefined;
  }
  
  // For NEGATION_DETECTED with is_negated check
  if (expectedValue === 'is_negated_true') {
    return fieldValue?.is_negated === true;
  }
  
  // Default string comparison
  if (typeof fieldValue === 'string') {
    return fieldValue.toLowerCase().includes(expectedValue.toLowerCase());
  }
  
  return false;
}

/**
 * Validate consistency of a criterion against rules and similar criteria
 * @param {Object} criterion - The criterion to validate
 * @param {Object[]} allCriteria - All criteria for cross-comparison
 * @returns {{ isConsistent: boolean, inconsistencies: string[] }}
 */
export function validateConsistency(criterion, allCriteria = []) {
  const inconsistencies = [];
  const rawText = criterion.raw_text || '';
  
  // 1. Check consistency rules against raw_text
  for (const rule of CONSISTENCY_RULES) {
    if (rule.textPattern.test(rawText)) {
      const fieldValue = criterion[rule.field];
      
      if (!fieldMatchesExpected(fieldValue, rule.expectedValue, rule.field)) {
        inconsistencies.push(`${rule.errorCode}: "${rule.textPattern.source}" found in raw_text but ${rule.field} doesn't contain "${rule.expectedValue}"`);
      }
    }
  }
  
  // 2. Cross-criterion comparison (find 3 similar, compare parsing)
  if (allCriteria.length > 0) {
    const similarCriteria = findSimilarCriteria(criterion, allCriteria, 3);
    
    for (const similar of similarCriteria) {
      // Compare key fields for consistency
      const fieldsToCompare = ['CONDITION_PATTERN', 'SEVERITY', 'REQUIRES_CLINICAL_JUDGMENT'];
      
      for (const field of fieldsToCompare) {
        // Check if similar text patterns have different parsed values
        const similarRawText = similar.raw_text || '';
        
        for (const rule of CONSISTENCY_RULES.filter(r => r.field === field)) {
          const thisHasPattern = rule.textPattern.test(rawText);
          const similarHasPattern = rule.textPattern.test(similarRawText);
          
          if (thisHasPattern && similarHasPattern) {
            const thisValue = criterion[field];
            const similarValue = similar[field];
            
            const thisMatches = fieldMatchesExpected(thisValue, rule.expectedValue, field);
            const similarMatches = fieldMatchesExpected(similarValue, rule.expectedValue, field);
            
            // If both have the pattern but parsed differently, that's inconsistent
            if (thisMatches !== similarMatches) {
              inconsistencies.push(`CROSS_INCONSISTENT: criterion ${criterion.id} and ${similar.id} both have "${rule.textPattern.source}" but parsed ${field} differently`);
            }
          }
        }
      }
    }
  }
  
  return { 
    isConsistent: inconsistencies.length === 0, 
    inconsistencies 
  };
}

// ============================================================================
// ITERATION 2.4: Semicolon Branch Separation & Timeframe Scope Rules
// ============================================================================

/**
 * Treatment event keywords - these should go in TREATMENT_HISTORY, not CONDITION_TYPE
 */
const TREATMENT_EVENT_PATTERNS = [
  /\bhospitalization\b/i,
  /\bhospitalized\b/i,
  /\bintravenous\b/i,
  /\biv\s+(antibiotics?|anti-?infective|therapy|treatment|medication)/i,
  /\btreatment\s+with\b/i,
  /\bsurgery\b/i,
  /\bsurgical\s+procedure\b/i,
  /\binfusion\b/i,
  /\btransfusion\b/i,
  /\bprocedure\b/i
];

/**
 * Condition keywords - these should go in CONDITION_TYPE
 */
const CONDITION_PATTERNS = [
  /\binfection\b/i,
  /\bsepsis\b/i,
  /\bpneumonia\b/i,
  /\bdisease\b/i,
  /\bdisorder\b/i,
  /\bsyndrome\b/i,
  /\bcancer\b/i,
  /\bmalignancy\b/i,
  /\bcondition\b/i
];

/**
 * Detect semicolon-separated branches in criterion text
 * @param {string} rawText - Raw criterion text
 * @returns {string[]} Array of branch segments
 */
export function detectSemicolonBranches(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return [];
  }
  
  // Split by semicolon
  const branches = rawText.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  return branches;
}

/**
 * Classify a term as TREATMENT event or CONDITION
 * @param {string} term - Term to classify
 * @returns {Object} { type: 'TREATMENT' | 'CONDITION' | 'UNKNOWN', pattern: string }
 */
export function classifyTreatmentVsCondition(term) {
  if (!term || typeof term !== 'string') {
    return { type: 'UNKNOWN', pattern: null };
  }
  
  const lowerTerm = term.toLowerCase();
  
  // Check for treatment patterns first (more specific)
  for (const pattern of TREATMENT_EVENT_PATTERNS) {
    if (pattern.test(lowerTerm)) {
      return { type: 'TREATMENT', pattern: pattern.source };
    }
  }
  
  // Check for condition patterns
  for (const pattern of CONDITION_PATTERNS) {
    if (pattern.test(lowerTerm)) {
      return { type: 'CONDITION', pattern: pattern.source };
    }
  }
  
  return { type: 'UNKNOWN', pattern: null };
}

/**
 * Validate that TIMEFRAME is correctly scoped
 * @param {Object} parsed - Parsed criterion object
 * @returns {Object} { isValid: boolean, conditionsHaveTimeframe: boolean, treatmentHasTimeframe: boolean, allTreatmentsHaveTimeframe: boolean }
 */
export function validateTimeframeScope(parsed) {
  const result = {
    isValid: true,
    conditionsHaveTimeframe: false,
    treatmentHasTimeframe: false,
    allTreatmentsHaveTimeframe: true
  };
  
  if (!parsed) return result;
  
  const rawText = parsed.raw_text || '';
  const branches = detectSemicolonBranches(rawText);
  const hasSemicolon = branches.length > 1;
  
  // Check if there's a global TIMEFRAME
  const hasGlobalTimeframe = parsed.TIMEFRAME && typeof parsed.TIMEFRAME === 'object';
  
  // Check if TREATMENT_HISTORY entries have timing
  if (parsed.TREATMENT_HISTORY && Array.isArray(parsed.TREATMENT_HISTORY)) {
    for (const th of parsed.TREATMENT_HISTORY) {
      if (th.timing && typeof th.timing === 'object') {
        result.treatmentHasTimeframe = true;
      } else {
        result.allTreatmentsHaveTimeframe = false;
      }
    }
  }
  
  // If there's a semicolon and conditions exist before it, they should NOT have the timeframe
  if (hasSemicolon && parsed.CONDITION_TYPE && parsed.CONDITION_TYPE.length > 0) {
    // Check if the timeframe text appears AFTER the semicolon (applies to treatment)
    // and NOT in the condition branch
    const lastBranch = branches[branches.length - 1];
    const timeframePhrasePattern = /within\s+\d+\s+(month|week|day|year)/i;
    
    if (timeframePhrasePattern.test(lastBranch)) {
      // Timeframe is in last branch (treatment), not in condition branch
      result.conditionsHaveTimeframe = false;
    } else if (hasGlobalTimeframe) {
      // If there's a global timeframe but semicolon present, conditions shouldn't have it
      result.conditionsHaveTimeframe = true; // This might be an error
    }
  }
  
  return result;
}

/**
 * Validate that treatment events are not incorrectly placed in NESTED_CONDITION
 * @param {Object} parsed - Parsed criterion object
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateTreatmentPlacement(parsed) {
  const errors = [];
  
  if (!parsed || !parsed.NESTED_CONDITION) {
    return { isValid: true, errors: [] };
  }
  
  const nestedItems = parsed.NESTED_CONDITION.nested_items || [];
  
  for (const item of nestedItems) {
    const values = item.values || [];
    for (const value of values) {
      const classification = classifyTreatmentVsCondition(value);
      if (classification.type === 'TREATMENT') {
        errors.push(`Treatment event "${value}" should be in TREATMENT_HISTORY, not NESTED_CONDITION`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export default {
  getSchemaForCluster,
  addMissingFields,
  validateFieldTypes,
  validateCriterion,
  validateBatch,
  validateConsistency,
  findSimilarCriteria,
  CONSISTENCY_RULES,
  // Ad-hoc field detection (Iteration 2.3)
  getValidNestedItemTypes,
  getValidTreatmentHistorySubfields,
  getValidNegationDetectedFields,
  validateNestedItemsTypes,
  validateTreatmentHistorySubfields,
  validateNegationDetectedStructure,
  detectAdhocFields,
  // Semicolon & Timeframe scope (Iteration 2.4)
  detectSemicolonBranches,
  classifyTreatmentVsCondition,
  validateTimeframeScope,
  validateTreatmentPlacement
};
