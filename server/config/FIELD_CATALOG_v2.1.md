# Clinical Trial Criteria Parser - Field Catalog

**Version:** 2.2  
**Date:** February 2, 2026  
**Purpose:** Comprehensive field definitions for LLM-based parsing with admin review workflow

**Changes in v2.2:**
- ✅ Added SEMICOLON PARSING RULE - semicolons indicate top-level OR branches with different scopes
- ✅ Added TIMEFRAME SCOPE RULE - timeframes apply only to their grammatical clause
- ✅ Added TREATMENT vs CONDITION CLASSIFICATION - hospitalization, IV therapy → TREATMENT_HISTORY
- ✅ Added parsing notes field for scope documentation

**Changes in v2.1:**
- ✅ Added complete admin workflow documentation with UI mockup
- ✅ Removed "active" and "inactive" from SEVERITY (eliminated ambiguity)
- ✅ Added "absence" to CONDITION_PATTERN for negation handling
- ✅ Changed NESTED_CONDITION from string to object for patient matching
- ✅ Added 6 complete AMBIGUITY_FLAG examples
- ✅ Added unfamiliar term detection algorithm (3-stage matching)
- ✅ Added complete NEGATION_DETECTED examples with parsing to normal fields
- ✅ Added patient matching code examples for all complex fields

---

## ⚠️ CRITICAL PARSING RULES (v2.2)

### RULE 1: SEMICOLON BRANCH SEPARATION

Semicolons (`;`) in criteria text indicate **TOP-LEVEL OR branches** with potentially different scopes.

**Before parsing, analyze the structure:**
1. Split text by semicolons
2. Each segment may have:
   - Its own TIMEFRAME (or no timeframe)
   - Different field types (conditions vs treatments)
3. Final output should have `LOGICAL_OPERATOR: "OR"` connecting branches

**Example:**
```
"Known history of chronic infections; hospitalization for infections within 2 months"
```

**Structure Analysis:**
- Segment A: "Known history of chronic infections" → CONDITION_TYPE + CONDITION_PATTERN, NO TIMEFRAME
- Segment B: "hospitalization for infections within 2 months" → TREATMENT_HISTORY with TIMEFRAME

**⚠️ DO NOT put treatment events (hospitalization, IV antibiotics) in NESTED_CONDITION.nested_items!**

---

### RULE 2: TIMEFRAME SCOPE

TIMEFRAME only applies to the clause it's grammatically attached to.

**Patterns:**
| Text Pattern | TIMEFRAME applies to |
|--------------|---------------------|
| "X within 2 months" | X only |
| "X; Y within 2 months" | Y only, NOT X |
| "X and Y within 2 months" | BOTH X and Y |
| "X, or Y within 2 months" | Y only (comma + or = new scope) |

**When scopes differ:**
- Document which elements have timeframes in `_parsing_notes`
- Set TIMEFRAME to the most relevant one for the primary clause
- Treatment timing should go in `TREATMENT_HISTORY[].timing`, not global TIMEFRAME

---

### RULE 3: TREATMENT vs CONDITION CLASSIFICATION

**TREATMENT EVENTS → Use TREATMENT_HISTORY:**
| Term | Classification |
|------|---------------|
| hospitalization | TREATMENT |
| treatment with [drug/therapy] | TREATMENT |
| intravenous (IV) [anything] | TREATMENT |
| surgery/surgical procedure | TREATMENT |
| therapy/intervention | TREATMENT |
| infusion | TREATMENT |
| transfusion | TREATMENT |

**CONDITIONS → Use CONDITION_TYPE:**
| Term | Classification |
|------|---------------|
| infections, diseases, disorders | CONDITION |
| symptoms (pain, fever, etc.) | CONDITION |
| diagnoses (sepsis, pneumonia, etc.) | CONDITION |

**Combined phrases - "hospitalization FOR infection":**
```json
{
  "TREATMENT_HISTORY": [{
    "treatment": "hospitalization",
    "indication": "infection",
    "timing": { "relation": "within", "amount": 2, "unit": "months" }
  }],
  "CONDITION_TYPE": ["infection"]  // Also include for matching purposes
}
```

---

### RULE 4: _parsing_notes FIELD (v2.2)

When criterion has complex scope or structure, add `_parsing_notes` to document:
- Which branches have timeframes
- Why certain fields were chosen
- Any ambiguity in interpretation

**Example:**
```json
{
  "_parsing_notes": "Semicolon separates condition history (no timeframe) from treatment events (2-month timeframe). TIMEFRAME applies ONLY to hospitalization/IV antibiotics branch."
}
```

---

## Overview

This catalog defines ALL fields used in the slot-filled database. Each field includes:

1. **Field Name** - Exact JSON key
2. **Purpose** - What this field represents
3. **Data Type** - Expected format (string, array, object, etc.)
4. **LLM Thought Process** - How LLM should reason about this field
5. **Format Specification** - Exact structure with examples
6. **Reference Lists** - Supporting vocabulary (when applicable)
7. **Validation Rules** - What makes a valid value
8. **Examples** - Real examples from the database with patient matching logic

---

## Field Categories

### 1. Age Fields
### 2. BMI/Weight Fields  
### 3. Measurement/Score Fields
### 4. Condition Fields
### 5. Anatomical Fields
### 6. Temporal Fields (incl. TREATMENT_HISTORY)
### 7. Logical Fields
### 8. Metadata Fields
### 9. Admin Review Workflow

---

# 1. AGE FIELDS

## AGE_MIN

**Purpose:** Minimum age requirement for trial eligibility

**Data Type:** `integer` or `null`

**LLM Thought Process:**
```
1. Identify age-related phrases in text
2. Look for minimum age indicators:
   - "≥ X years"
   - "at least X years"
   - "X years or older"
   - "X years and above"
   - "from X years"
3. Extract the numeric value
4. If range is given ("18-65 years"), extract lower bound
5. If only maximum is given, set AGE_MIN to null
```

**Format:**
```json
{
  "AGE_MIN": 18  // Integer, years
}
```

**Reference List:** N/A (numeric value)

**Validation Rules:**
- Must be integer >= 0
- Must be <= AGE_MAX (if AGE_MAX is present)
- Typical range: 0-100

**Examples:**

| Raw Text | AGE_MIN | Reasoning |
|----------|---------|-----------|
| "Participants ≥18 years of age" | 18 | Direct minimum |
| "Adults aged 18-65 years" | 18 | Range lower bound |
| "At least 21 years old" | 21 | "At least" = minimum |
| "Children under 12 years" | null | Only maximum given |
| "Participants 18 years and above" | 18 | "and above" = minimum |

---

## AGE_MAX

**Purpose:** Maximum age requirement for trial eligibility

**Data Type:** `integer` or `null`

**LLM Thought Process:**
```
1. Identify age-related phrases in text
2. Look for maximum age indicators:
   - "≤ X years"
   - "up to X years"
   - "X years or younger"
   - "under X years"
   - "to X years"
3. Extract the numeric value
4. If range is given ("18-65 years"), extract upper bound
5. If only minimum is given, set AGE_MAX to null
```

**Format:**
```json
{
  "AGE_MAX": 65  // Integer, years
}
```

**Reference List:** N/A (numeric value)

**Validation Rules:**
- Must be integer >= 0
- Must be >= AGE_MIN (if AGE_MIN is present)
- Typical range: 0-120

**Examples:**

| Raw Text | AGE_MAX | Reasoning |
|----------|---------|-----------|
| "Participants ≤65 years of age" | 65 | Direct maximum |
| "Adults aged 18-65 years" | 65 | Range upper bound |
| "Up to 75 years old" | 75 | "Up to" = maximum |
| "Children under 12 years" | 12 | "Under" = maximum (exclusive, but use value) |
| "Participants 18 years and above" | null | Only minimum given |

---

## AGE_UNIT

**Purpose:** Unit of age measurement (always "years" for current data)

**Data Type:** `string`

**LLM Thought Process:**
```
1. Identify unit mentioned in text
2. Common units: "years", "months", "days"
3. If not explicitly stated, assume "years" for adults
4. For pediatric trials, check for "months" or "weeks"
```

**Format:**
```json
{
  "AGE_UNIT": "years"  // String: "years", "months", "days", "weeks"
}
```

**Reference List:**
- "years" (most common)
- "months" (pediatric trials)
- "weeks" (neonatal trials)
- "days" (neonatal trials)

**Validation Rules:**
- Must be one of: "years", "months", "weeks", "days"
- Default to "years" if not specified

**Examples:**

| Raw Text | AGE_UNIT | Reasoning |
|----------|----------|-----------|
| "Participants ≥18 years of age" | "years" | Explicitly stated |
| "Infants 6-12 months old" | "months" | Explicitly stated |
| "Adults aged 18-65" | "years" | Implied (adults) |

---

# 2. BMI/WEIGHT FIELDS

## BMI_MIN

**Purpose:** Minimum Body Mass Index requirement for trial eligibility

**Data Type:** `number` or `null`

**LLM Thought Process:**
```
1. Identify BMI-related phrases in text
2. Look for minimum BMI indicators:
   - "BMI ≥ X"
   - "BMI at least X"
   - "BMI of X or higher"
   - "BMI between X and Y" (extract X as min)
3. Extract the numeric value
4. BMI is always kg/m² (no unit needed)
5. If only maximum is given, set BMI_MIN to null
```

**Format:**
```json
{
  "BMI_MIN": 18.5  // Number (kg/m²), or null
}
```

**Reference List:** N/A (numeric value)

**Validation Rules:**
- Must be number >= 0 or null
- Must be <= BMI_MAX (if BMI_MAX is present)
- Typical range: 15-50 kg/m²

**Examples:**

| Raw Text | BMI_MIN | Reasoning |
|----------|---------|-----------|
| "BMI ≥ 18.5 kg/m²" | 18.5 | Direct minimum |
| "BMI between 18.5 and 35" | 18.5 | Range lower bound |
| "BMI at least 20" | 20 | "At least" = minimum |
| "BMI ≤ 40 kg/m²" | null | Only maximum given |

---

## BMI_MAX

**Purpose:** Maximum Body Mass Index requirement for trial eligibility

**Data Type:** `number` or `null`

**LLM Thought Process:**
```
1. Identify BMI-related phrases in text
2. Look for maximum BMI indicators:
   - "BMI ≤ X"
   - "BMI up to X"
   - "BMI not exceeding X"
   - "BMI between X and Y" (extract Y as max)
3. Extract the numeric value
4. If only minimum is given, set BMI_MAX to null
```

**Format:**
```json
{
  "BMI_MAX": 35  // Number (kg/m²), or null
}
```

**Reference List:** N/A (numeric value)

**Validation Rules:**
- Must be number >= 0 or null
- Must be >= BMI_MIN (if BMI_MIN is present)
- Typical range: 15-60 kg/m²

**Examples:**

| Raw Text | BMI_MAX | Reasoning |
|----------|---------|-----------|
| "BMI ≤ 40 kg/m²" | 40 | Direct maximum |
| "BMI between 18.5 and 35" | 35 | Range upper bound |
| "BMI not exceeding 30" | 30 | "Not exceeding" = maximum |
| "BMI ≥ 18.5" | null | Only minimum given |

---

## WEIGHT_MIN

**Purpose:** Minimum body weight requirement for trial eligibility

**Data Type:** `number` or `null`

**LLM Thought Process:**
```
1. Identify weight-related phrases in text
2. Look for minimum weight indicators:
   - "weight ≥ X kg"
   - "at least X kg"
   - "body weight X kg or more"
3. Extract the numeric value
4. Note the unit (kg or lbs)
5. If only maximum is given, set WEIGHT_MIN to null
```

**Format:**
```json
{
  "WEIGHT_MIN": 50  // Number, or null
}
```

**Reference List:** N/A (numeric value)

**Validation Rules:**
- Must be number >= 0 or null
- Must be <= WEIGHT_MAX (if WEIGHT_MAX is present)
- Unit specified in WEIGHT_UNIT field

**Examples:**

| Raw Text | WEIGHT_MIN | Reasoning |
|----------|------------|-----------|
| "body weight ≥ 50 kg" | 50 | Direct minimum |
| "weighing at least 45 kg" | 45 | "At least" = minimum |
| "weight between 50-100 kg" | 50 | Range lower bound |
| "weight ≤ 120 kg" | null | Only maximum given |

---

## WEIGHT_MAX

**Purpose:** Maximum body weight requirement for trial eligibility

**Data Type:** `number` or `null`

**LLM Thought Process:**
```
1. Identify weight-related phrases in text
2. Look for maximum weight indicators:
   - "weight ≤ X kg"
   - "up to X kg"
   - "not exceeding X kg"
3. Extract the numeric value
4. Note the unit (kg or lbs)
5. If only minimum is given, set WEIGHT_MAX to null
```

**Format:**
```json
{
  "WEIGHT_MAX": 120  // Number, or null
}
```

**Reference List:** N/A (numeric value)

**Validation Rules:**
- Must be number >= 0 or null
- Must be >= WEIGHT_MIN (if WEIGHT_MIN is present)
- Unit specified in WEIGHT_UNIT field

**Examples:**

| Raw Text | WEIGHT_MAX | Reasoning |
|----------|------------|-----------|
| "body weight ≤ 120 kg" | 120 | Direct maximum |
| "not exceeding 100 kg" | 100 | "Not exceeding" = maximum |
| "weight between 50-100 kg" | 100 | Range upper bound |
| "weight ≥ 50 kg" | null | Only minimum given |

---

## WEIGHT_UNIT

**Purpose:** Unit of weight measurement

**Data Type:** `string`

**LLM Thought Process:**
```
1. Identify unit mentioned in text
2. Common units: "kg", "lbs", "pounds"
3. Normalize to "kg" or "lbs"
4. If not explicitly stated, assume "kg" (international standard)
```

**Format:**
```json
{
  "WEIGHT_UNIT": "kg"  // String: "kg" or "lbs"
}
```

**Reference List:**
- "kg" (most common, international)
- "lbs" (US studies)

**Validation Rules:**
- Must be one of: "kg", "lbs"
- Default to "kg" if not specified

**Examples:**

| Raw Text | WEIGHT_UNIT | Reasoning |
|----------|-------------|-----------|
| "body weight ≥ 50 kg" | "kg" | Explicitly stated |
| "weight at least 110 lbs" | "lbs" | Explicitly stated |
| "weighing ≥ 50" | "kg" | Assumed (international) |

---

# 3. MEASUREMENT/SCORE FIELDS

## MEASUREMENTS

**Purpose:** Structured representation of ALL clinical scores, lab values, and numeric thresholds

**Data Type:** `array` of `object`

**LLM Thought Process:**
```
1. Scan text for ANY numeric value with comparison operator
2. Identify parameter being measured:
   - Clinical scores: PASI, BSA, PGA, IGA, sPGA, PHQ-9, GPPGA, etc.
   - Lab values: WBC, hemoglobin, creatinine, ALT, AST, etc.
   - Physical measurements: blood pressure, heart rate, temperature
   - Body metrics: weight, height, BMI
3. Extract comparison operator: >=, <=, >, <, =, range
4. Extract numeric value(s)
5. Extract unit if present
6. Handle ranges: "≥10 and <12" → min=10, max=12, comparison="range"
7. Handle gender-specific values: create separate objects with gender attribute
8. If parameter is unfamiliar, FLAG for admin review (see Unfamiliar Term Detection section)
```

**Format:**
```json
{
  "MEASUREMENTS": [
    {
      "parameter": "PASI",           // String: name of what's being measured
      "value": 10,                   // Number: threshold value (for simple comparisons)
      "min": 10,                     // Number: minimum value (for ranges)
      "max": 12,                     // Number: maximum value (for ranges)
      "comparison": "range",         // String: ">=", "<=", ">", "<", "=", "range"
      "unit": null,                  // String: unit of measurement (if applicable)
      "gender": null,                // String: "male" or "female" (if gender-specific)
      "unfamiliar_term_flag": false, // Boolean: true if parameter not in reference list
      "confidence": 1.0              // Number: LLM confidence score (0.0-1.0)
    }
  ]
}
```

**Reference List:** See `clinical_scores` in reference_lists.json

**Top Clinical Scores (from existing data):**
- PASI (Psoriasis Area and Severity Index)
- BSA (Body Surface Area)
- PGA (Physician Global Assessment)
- IGA (Investigator Global Assessment)
- sPGA (static Physician Global Assessment)
- PHQ-9 (Patient Health Questionnaire-9)
- GPPGA (Generalized Pustular Psoriasis Global Assessment)
- PPPASI (Palmoplantar Psoriasis Area and Severity Index)
- PPP-IGA (Palmoplantar Psoriasis Investigator Global Assessment)
- cDAPSA (Clinical Disease Activity Score for Psoriatic Arthritis)
- DLQI (Dermatology Life Quality Index)
- NAPSI (Nail Psoriasis Severity Index)

**Validation Rules:**
- `parameter` must be non-empty string
- At least one of `value`, `min`, or `max` must be present
- If `comparison` is "range", both `min` and `max` must be present
- `comparison` must be one of: ">=", "<=", ">", "<", "=", "range"
- `gender` must be one of: null, "male", "female"
- If `unfamiliar_term_flag` is true, add to admin review queue
- `confidence` must be between 0.0 and 1.0

**Examples:**

### Example 1: Simple Threshold
```
Raw Text: "PASI score ≥ 10"

LLM Thought Process:
1. Identify parameter: "PASI score" → "PASI"
2. Identify comparison: "≥"
3. Extract value: 10
4. No unit specified (PASI is unitless)
5. Check reference list: "PASI" found → confidence 1.0

Output:
{
  "MEASUREMENTS": [
    {
      "parameter": "PASI",
      "value": 10,
      "comparison": ">=",
      "unit": null,
      "unfamiliar_term_flag": false,
      "confidence": 1.0
    }
  ]
}
```

### Example 2: Range Condition
```
Raw Text: "PASI score is ≥10 and <12"

LLM Thought Process:
1. Identify parameter: "PASI"
2. Identify TWO conditions: "≥10" AND "<12"
3. Recognize this as a RANGE: 10 ≤ PASI < 12
4. Combine into single measurement with min/max

Output:
{
  "MEASUREMENTS": [
    {
      "parameter": "PASI",
      "min": 10,
      "max": 12,
      "comparison": "range",
      "unit": null,
      "confidence": 1.0
    }
  ]
}
```

### Example 3: Gender-Specific Values
```
Raw Text: "body weight ≥50 kg for male or ≥45 kg for female"

LLM Thought Process:
1. Identify parameter: "body weight"
2. Identify TWO separate requirements:
   - Male: ≥50 kg
   - Female: ≥45 kg
3. Create TWO measurement objects with gender attribute

Output:
{
  "MEASUREMENTS": [
    {
      "parameter": "body weight",
      "value": 50,
      "comparison": ">=",
      "unit": "kg",
      "gender": "male",
      "confidence": 1.0
    },
    {
      "parameter": "body weight",
      "value": 45,
      "comparison": ">=",
      "unit": "kg",
      "gender": "female",
      "confidence": 1.0
    }
  ]
}
```

### Example 4: Unfamiliar Score (Admin Review)
```
Raw Text: "GPPGA pustulation subscore of ≥ 2"

LLM Thought Process:
1. Identify parameter: "GPPGA pustulation subscore"
2. Check reference list: "GPPGA" found, but "GPPGA pustulation subscore" is more specific
3. Extract value: 2, comparison: ">="
4. FLAG as unfamiliar term for admin review (confidence < 0.7)

Output:
{
  "MEASUREMENTS": [
    {
      "parameter": "GPPGA pustulation subscore",
      "value": 2,
      "comparison": ">=",
      "unit": null,
      "unfamiliar_term_flag": true,  // ← Admin review needed
      "confidence": 0.65
    }
  ]
}
```

### Example 5: Verbose Phrasing
```
Raw Text: "body weight was not less than 50 kg"

LLM Thought Process:
1. Identify parameter: "body weight"
2. Identify verbal comparison: "not less than" = ">="
3. Extract value: 50
4. Extract unit: "kg"

Output:
{
  "MEASUREMENTS": [
    {
      "parameter": "body weight",
      "value": 50,
      "comparison": ">=",
      "unit": "kg",
      "confidence": 0.95
    }
  ]
}
```

---

## SEVERITY

**Purpose:** Disease intensity, acuity, and stability descriptors

**Data Type:** `array` of `string`

**⚠️ IMPORTANT CHANGE IN v2.1:**
- **REMOVED:** "active" and "inactive" (moved to CONDITION_PATTERN)
- **USE INSTEAD:** "flaring", "quiescent", "remission" for disease activity level

**LLM Thought Process:**
```
1. Look for severity descriptors in text:
   - Intensity: mild, moderate, severe, critical
   - Acuity: acute, chronic, subacute, recurrent
   - Stability: stable, unstable, progressive, deteriorating, improving
   - Activity LEVEL: flaring, quiescent, remission
2. Extract ALL severity terms mentioned
3. Return as array if multiple terms
4. DO NOT include "active" or "inactive" - these go in CONDITION_PATTERN
5. Common patterns:
   - "moderate-to-severe" → ["moderate", "severe"]
   - "acute flare" → ["acute", "flaring"]
   - "chronic stable" → ["chronic", "stable"]
```

**Format:**
```json
{
  "SEVERITY": ["moderate", "severe"]  // Array of strings
}
```

**Reference List:**

**Intensity:**
- "mild"
- "moderate"
- "severe"
- "critical"
- "life-threatening"

**Acuity:**
- "acute"
- "chronic"
- "subacute"
- "recurrent"

**Stability:**
- "stable"
- "unstable"
- "progressive"
- "deteriorating"
- "improving"

**Activity LEVEL:**
- "flaring" (use instead of "active")
- "quiescent" (use instead of "inactive")
- "remission"

**⚠️ DO NOT USE (moved to CONDITION_PATTERN):**
- ~~"active"~~ → Use "flaring" or put in CONDITION_PATTERN
- ~~"inactive"~~ → Use "quiescent" or put in CONDITION_PATTERN

**Validation Rules:**
- Must be array of strings
- Each string should be from reference list (but allow unfamiliar terms with flag)
- If unfamiliar term, add to admin review queue
- DO NOT include "active" or "inactive"

**Examples:**

| Raw Text | SEVERITY | CONDITION_PATTERN | Reasoning |
|----------|----------|-------------------|-----------|
| "moderate-to-severe psoriasis" | ["moderate", "severe"] | ["current"] | Intensity descriptors |
| "acute GPP flare" | ["acute", "flaring"] | ["current"] | Acuity + activity level |
| "chronic stable condition" | ["chronic", "stable"] | ["current"] | Acuity + stability |
| "mild disease" | ["mild"] | ["current"] | Single intensity |
| "active psoriatic arthritis" | [] | ["active"] | "active" → CONDITION_PATTERN |
| "active flare" | ["flaring"] | ["current"] | Use "flaring" instead of "active" |

---

# 4. CONDITION FIELDS

## CONDITION_TYPE

**Purpose:** Specific medical conditions, diagnoses, or disease types mentioned

**Data Type:** `array` of `string`

**LLM Thought Process:**
```
1. Identify medical conditions/diagnoses in text
2. Extract specific disease names, not general categories
3. Include qualifiers if they change the meaning:
   - "plaque psoriasis" (not just "psoriasis")
   - "rheumatoid arthritis" (not just "arthritis")
   - "type 2 diabetes" (not just "diabetes")
4. Handle negation:
   - "non-plaque psoriasis" → "non-plaque psoriasis" (keep "non-")
   - Do NOT extract "plaque psoriasis" from "non-plaque psoriasis"
5. Extract ALL conditions mentioned
6. If unfamiliar condition, FLAG for admin review (see Unfamiliar Term Detection section)
```

**Format:**
```json
{
  "CONDITION_TYPE": [
    "plaque psoriasis",
    "psoriatic arthritis"
  ],
  "unfamiliar_term_flag": false,
  "confidence": 1.0
}
```

**Reference List:** See `condition_types` in reference_lists.json (top 100 shown)

**Top Condition Types (from existing data):**
- "plaque psoriasis"
- "psoriatic arthritis"
- "chronic plaque psoriasis"
- "active psoriatic arthritis"
- "moderate to severe plaque psoriasis"
- "cancer"
- "infection"
- "tuberculosis"
- "hepatitis b"
- "hepatitis c"
- "hiv"
- "diabetes"
- "cardiovascular disease"
- "malignancy"
- "inflammatory bowel disease"
- "multiple sclerosis"
- "lupus"
- "crohn's disease"
- "ulcerative colitis"

**Validation Rules:**
- Must be array of strings
- Each string should be lowercase
- Preserve qualifiers ("non-", "chronic", etc.)
- If unfamiliar condition, set `unfamiliar_term_flag` and add to admin review

**Examples:**

### Example 1: Simple Condition
```
Raw Text: "Diagnosis of plaque psoriasis"

Output:
{
  "CONDITION_TYPE": ["plaque psoriasis"],
  "unfamiliar_term_flag": false,
  "confidence": 1.0
}
```

### Example 2: Multiple Conditions
```
Raw Text: "Diagnosis of plaque psoriasis and psoriatic arthritis"

Output:
{
  "CONDITION_TYPE": [
    "plaque psoriasis",
    "psoriatic arthritis"
  ],
  "confidence": 1.0
}
```

### Example 3: Negation (CRITICAL)
```
Raw Text: "Diagnosis of non-plaque psoriasis or drug-induced psoriasis"

LLM Thought Process:
1. Identify conditions: "non-plaque psoriasis", "drug-induced psoriasis"
2. CRITICAL: "non-plaque" is a NEGATION of "plaque"
3. Do NOT extract "plaque psoriasis"
4. Extract "non-plaque psoriasis" as-is
5. Parse into BOTH CONDITION_TYPE and DISEASE_VARIANT

Output:
{
  "CONDITION_TYPE": [
    "non-plaque psoriasis",
    "drug-induced psoriasis"
  ],
  "DISEASE_VARIANT": [
    "non-plaque",
    "drug-induced"
  ],
  "NEGATION_DETECTED": {
    "negated_term": "plaque",
    "interpretation": "Excludes patients with plaque psoriasis",
    "affected_fields": ["CONDITION_TYPE", "DISEASE_VARIANT"],
    "parsing_note": "'non-plaque' treated as distinct variant, NOT absence of 'plaque'"
  },
  "confidence": 1.0
}
```

### Example 4: Unfamiliar Condition (Admin Review)
```
Raw Text: "Diagnosis of Schnitzler syndrome"

LLM Thought Process:
1. Extract condition: "Schnitzler syndrome"
2. Check reference list: NOT FOUND
3. Check base terms: "syndrome" found (generic)
4. LLM confidence: 0.6 (low - unfamiliar)
5. FLAG for admin review

Output:
{
  "CONDITION_TYPE": ["schnitzler syndrome"],
  "unfamiliar_term_flag": true,  // ← Admin review needed
  "confidence": 0.6,
  "parsing_status": "pending_admin_review"
}
```

---

## CONDITION_PATTERN

**Purpose:** Temporal patterns or status of conditions

**Data Type:** `array` of `string`

**✅ NEW IN v2.1:**
- **ADDED:** "absence" for negation handling
- **MOVED HERE:** "active" and "inactive" (removed from SEVERITY)

**LLM Thought Process:**
```
1. Identify temporal/status descriptors for conditions:
   - Temporal: current, history, past, previous, prior, recent
   - Status: active, inactive, ongoing, resolved, remission, absence
   - Change: new, worsening, improving
   - Diagnosis: confirmed, suspected, diagnosed, documented
2. Extract ALL patterns mentioned
3. Default to "current" if no pattern specified
4. "active" and "inactive" ALWAYS go here (NOT in SEVERITY)
5. Use "absence" for negation patterns like "absence of plaque psoriasis"
```

**Format:**
```json
{
  "CONDITION_PATTERN": [
    "current",
    "active"
  ]
}
```

**Reference List:**

**Temporal:**
- "current"
- "history"
- "past"
- "previous"
- "prior"
- "recent"

**Status:**
- "active" ← **MOVED HERE from SEVERITY in v2.1**
- "inactive" ← **MOVED HERE from SEVERITY in v2.1**
- "ongoing"
- "resolved"
- "remission"
- "absence" ← **NEW IN v2.1** for negation

**Change:**
- "new"
- "worsening"
- "improving"

**Diagnosis:**
- "confirmed"
- "suspected"
- "diagnosed"
- "documented"

**Validation Rules:**
- Must be array of strings
- Each string should be from reference list
- Default to ["current"] if no pattern specified
- "active" and "inactive" go HERE, not in SEVERITY

**Examples:**

| Raw Text | CONDITION_PATTERN | SEVERITY | Reasoning |
|----------|-------------------|----------|-----------|
| "Diagnosis of plaque psoriasis" | ["current"] | [] | No temporal qualifier → assume current |
| "History of cancer" | ["history"] | [] | Explicit temporal |
| "Active psoriatic arthritis" | ["active"] | [] | "active" → CONDITION_PATTERN |
| "New or worsening pustules" | ["new", "worsening"] | [] | Multiple patterns |
| "Absence of plaque psoriasis" | ["absence"] | [] | Negation pattern |
| "Chronic active hepatitis B" | ["active"] | ["chronic"] | "active" → CONDITION_PATTERN, "chronic" → SEVERITY |

---

## DISEASE_VARIANT

**Purpose:** Specific disease variant/subtype (for DIT cluster - Disease Type)

**Data Type:** `array` of `string`

**LLM Thought Process:**
```
1. Identify disease variant types mentioned
2. Examples by disease:
   - Psoriasis: guttate, erythrodermic, pustular, inverse, plaque, palmoplantar
   - Arthritis: rheumatoid, psoriatic, osteoarthritis, gouty
   - Cancer: adenocarcinoma, squamous cell, small cell, etc.
   - Diabetes: type 1, type 2, gestational
3. CRITICAL: Handle negation
   - "non-plaque psoriasis" → ["non-plaque"] (NOT "plaque")
   - "absence of [variant]" → do NOT include that variant
4. If unfamiliar variant, FLAG for admin review
```

**Format:**
```json
{
  "DISEASE_VARIANT": [
    "guttate",
    "drug-induced"
  ]
}
```

**Reference List:**

**Psoriasis variants (8 types):**
- "drug-induced" (17 occurrences)
- "guttate" (15 occurrences)
- "erythrodermic" (14 occurrences)
- "pustular" (14 occurrences)
- "plaque psoriasis" (13 occurrences)
- "inverse" (2 occurrences)
- "nail psoriasis" (1 occurrence)
- "unspecified" (2 occurrences)

**Additional psoriasis variants:**
- "palmoplantar"
- "scalp psoriasis"
- "generalized pustular"
- "arthropathic"
- "non-plaque" ← **For negation cases**

**Generic variant categories:**
- Cancer subtypes (adenocarcinoma, squamous cell, small cell, etc.)
- Arthritis types (rheumatoid, psoriatic, osteoarthritis, gouty)
- Diabetes types (type 1, type 2, gestational, LADA)

**Validation Rules:**
- Must be array of strings
- Each string should be lowercase
- NEVER include negated terms positively
- If unfamiliar variant, FLAG for admin review

**Examples:**

### Example 1: Simple Variants
```
Raw Text: "Diagnosis of guttate or pustular psoriasis"

Output:
{
  "DISEASE_VARIANT": [
    "guttate",
    "pustular"
  ]
}
```

### Example 2: Negation (CRITICAL)
```
Raw Text: "Diagnosis of non-plaque psoriasis or drug-induced psoriasis"

LLM Thought Process:
1. Identify variants: "non-plaque", "drug-induced"
2. CRITICAL: "non-plaque" means ANY variant EXCEPT plaque
3. Do NOT include "plaque" in the list
4. Include "non-plaque" as a category
5. Parse into BOTH DISEASE_VARIANT and CONDITION_TYPE

Output:
{
  "DISEASE_VARIANT": [
    "non-plaque",
    "drug-induced"
  ],
  "CONDITION_TYPE": [
    "non-plaque psoriasis",
    "drug-induced psoriasis"
  ],
  "NEGATION_DETECTED": {
    "negated_term": "plaque",
    "interpretation": "Excludes patients with plaque type; includes all other variants",
    "affected_fields": ["DISEASE_VARIANT", "CONDITION_TYPE"],
    "parsing_note": "'non-plaque' treated as distinct variant category"
  }
}
```

---

## EXCEPTION_CONDITION

**Purpose:** Exception clauses that override exclusion criteria

**Data Type:** `object`

**LLM Thought Process:**
```
1. Look for exception keywords:
   - "except", "other than", "excluding", "unless"
   - "with the exception of", "apart from"
2. Identify what is being excepted
3. Determine if exception makes patient eligible or ineligible
4. Structure as object with:
   - excluded_types: what is excepted
   - condition: status of excepted item
   - makes_eligible: boolean (does exception allow eligibility?)
```

**Format:**
```json
{
  "EXCEPTION_CONDITION": {
    "excluded_types": ["basal cell carcinoma"],
    "condition": "any status",
    "makes_eligible": true
  }
}
```

**Validation Rules:**
- `excluded_types` must be array of strings
- `condition` must be string
- `makes_eligible` must be boolean

**Examples:**

### Example 1: Cancer Exception
```
Raw Text: "History of cancer except basal cell carcinoma"

LLM Thought Process:
1. Main condition: "history of cancer" (exclusion)
2. Exception keyword: "except"
3. Excepted condition: "basal cell carcinoma"
4. Interpretation: Patients with basal cell carcinoma ARE eligible
5. Parse into BOTH EXCEPTION_CONDITION and NEGATION_DETECTED

Output:
{
  "CONDITION_TYPE": ["cancer"],
  "CONDITION_PATTERN": ["history"],
  "EXCEPTION_CONDITION": {
    "excluded_types": ["basal cell carcinoma"],
    "condition": "any status",
    "makes_eligible": true
  },
  "NEGATION_DETECTED": {
    "negated_term": "basal cell carcinoma",
    "negation_type": "exception",
    "interpretation": "Patients with basal cell carcinoma ARE eligible despite having cancer history",
    "affected_fields": ["EXCEPTION_CONDITION"],
    "parsing_note": "Exception clause overrides main exclusion criterion"
  }
}
```

**Patient Matching Logic:**
```python
def matches_criterion(patient):
    # Check if patient has cancer history
    if not patient.has_condition("cancer", pattern="history"):
        return "ELIGIBLE"  # No cancer history
    
    # Patient has cancer history - check exception
    exception = criterion['EXCEPTION_CONDITION']
    if patient.cancer_type in exception['excluded_types']:
        return "ELIGIBLE"  # Has basal cell carcinoma → exception applies
    else:
        return "EXCLUDED"  # Has other cancer type
```

---

# 5. ANATOMICAL FIELDS

## ANATOMICAL_LOCATION

**Purpose:** Body parts, organs, or anatomical regions mentioned

**Data Type:** `array` of `string`

**LLM Thought Process:**
```
1. Identify anatomical terms in text
2. Common locations for psoriasis:
   - scalp, face, hands, feet, nails
   - palms, soles, genitals
   - trunk, extremities, joints
3. Extract ALL locations mentioned
4. Normalize to standard terms (e.g., "palm" → "palms")
5. If unfamiliar location, FLAG for admin review
```

**Format:**
```json
{
  "ANATOMICAL_LOCATION": [
    "scalp",
    "face",
    "hands"
  ]
}
```

**Reference List:** See `anatomical_locations` in reference_lists.json

**Top Anatomical Locations (from existing data):**
- "scalp" (28 occurrences)
- "face" (23 occurrences)
- "palms" (22 occurrences)
- "soles" (22 occurrences)
- "hands" (20 occurrences)
- "feet" (19 occurrences)
- "genitals" (18 occurrences)
- "nails" (14 occurrences)
- "joints" (9 occurrences)
- "trunk" (5 occurrences)
- "extremities" (4 occurrences)
- "skin" (3 occurrences)

**Validation Rules:**
- Must be array of strings
- Each string should be lowercase
- Normalize plural/singular (prefer plural: "hands" not "hand")
- If unfamiliar location, FLAG for admin review

**Examples:**

| Raw Text | ANATOMICAL_LOCATION | Reasoning |
|----------|---------------------|-----------|
| "Psoriasis involving the scalp, palms, or soles" | ["scalp", "palms", "soles"] | Multiple locations |
| "Facial psoriasis" | ["face"] | Adjective form → noun |
| "Nail involvement" | ["nails"] | Singular → plural |

---

# 6. TEMPORAL FIELDS

## TIMEFRAME

**Purpose:** Time-related requirements (duration, reference points, timing)

**Data Type:** `object` OR `array` of `object`

**LLM Thought Process:**
```
1. Identify time-related phrases:
   - Duration: "at least 6 months", "for 3 years", "within 2 weeks"
   - Reference point: "prior to screening", "at baseline", "before randomization"
   - Timing: "within", "at least", "no more than", "during"
2. Extract components:
   - relation: "at least", "within", "prior to", "at", "during"
   - amount: numeric value
   - unit: "months", "years", "weeks", "days"
   - reference: "screening", "baseline", "randomization", "enrollment"
3. Structure as object
4. If multiple timeframes, use array
```

**Format:**
```json
{
  "TIMEFRAME": {
    "relation": "at least",
    "amount": 6,
    "unit": "months",
    "reference": "screening"
  }
}
```

OR for multiple timeframes:
```json
{
  "TIMEFRAME": [
    {
      "relation": "at least",
      "amount": 6,
      "unit": "months",
      "reference": "diagnosis"
    },
    {
      "relation": "at",
      "reference": "baseline"
    }
  ]
}
```

**Reference List:**

**Relations:**
- "at least"
- "within"
- "prior to"
- "at"
- "during"
- "no more than"
- "for"

**Units:**
- "years"
- "months"
- "weeks"
- "days"
- "hours"

**Reference Points:**
- "screening"
- "baseline"
- "randomization"
- "enrollment"
- "diagnosis"
- "study entry"
- "first dose"

**Validation Rules:**
- `relation` must be string from reference list
- `amount` must be number (if applicable)
- `unit` must be string from reference list (if applicable)
- `reference` must be string (if applicable)

**Examples:**

### Example 1: Duration with Reference
```
Raw Text: "Diagnosis of chronic plaque psoriasis for at least 6 months prior to randomization"

Output:
{
  "TIMEFRAME": {
    "relation": "at least",
    "amount": 6,
    "unit": "months",
    "reference": "randomization"
  }
}
```

### Example 2: Simple Reference
```
Raw Text: "PASI score ≥ 10 at baseline"

Output:
{
  "TIMEFRAME": {
    "relation": "at",
    "reference": "baseline"
  }
}
```

---

## TREATMENT_HISTORY

**Purpose:** Structured representation of prior treatments, medications, and therapies relevant to trial eligibility

**Data Type:** `array` of `object`

**LLM Thought Process:**
```
1. Identify treatment-related phrases:
   - "prior treatment with X"
   - "failed X therapy"
   - "inadequate response to X"
   - "treatment-naïve" / "treatment-experienced"
   - "washed out from X"
2. Extract treatment name/category
3. Identify response status:
   - "failed" / "failure"
   - "inadequate response" / "insufficient response"
   - "intolerant" / "intolerance"
   - "contraindicated"
   - "naive" / "experienced"
4. Extract duration/timing if mentioned
5. Identify count requirements ("at least 2 biologics")
```

**Format:**
```json
{
  "TREATMENT_HISTORY": [
    {
      "treatment": "TNF inhibitor",           // String: treatment name or category
      "treatment_class": "biologic",          // String: drug class
      "response": "failed",                   // String: response status
      "indication": "psoriasis",              // String: what condition was treated (v2.2)
      "route": "intravenous",                 // String: administration route (optional)
      "duration": {                           // Object: treatment duration (optional)
        "amount": 12,
        "unit": "weeks"
      },
      "count": null,                          // Number: minimum number of treatments (optional)
      "timing": {                             // Object: when treatment occurred (optional)
        "relation": "within",
        "amount": 6,
        "unit": "months"
      },
      "unfamiliar_term_flag": false,
      "confidence": 1.0
    }
  ]
}
```

**⚠️ VALID TREATMENT_HISTORY SUBFIELDS (v2.2):**

| Subfield | Type | Description |
|----------|------|-------------|
| `treatment` | string | Treatment name or category (required) |
| `treatment_class` | string | Drug class (biologic, conventional, etc.) |
| `response` | string | Response status (failed, naive, etc.) |
| `indication` | string | What condition was treated |
| `route` | string | Administration route (oral, IV, etc.) |
| `dose` | string | Dosage information |
| `frequency` | string | How often administered |
| `duration` | object | How long treatment lasted |
| `timing` | object | When treatment occurred (TIMEFRAME structure) |
| `count` | number | Minimum number of treatments |
| `requires_hospitalization` | boolean | Whether hospitalization was required |
| `confidence` | number | Parsing confidence |
| `unfamiliar_term_flag` | boolean | Term not in reference lists |

**❌ FORBIDDEN - Do NOT invent new subfields**

**Reference List:** See `treatment_classes` in reference_lists.json

**Treatment Classes:**
- "biologic" (TNF inhibitors, IL-17 inhibitors, IL-23 inhibitors)
- "conventional systemic" (methotrexate, cyclosporine)
- "topical" (corticosteroids, vitamin D analogs)
- "phototherapy" (UVB, PUVA)
- "small molecule" (apremilast, JAK inhibitors)

**Response Status Values:**
- "naive" (never received)
- "experienced" (previously received)
- "failed" (did not respond)
- "inadequate_response" (partial response)
- "intolerant" (adverse events)
- "contraindicated" (cannot receive)

**Validation Rules:**
- `treatment` must be non-empty string
- `treatment_class` should be from reference list
- `response` should be from reference list
- `count` must be positive integer or null
- `duration` and `timing` follow TIMEFRAME structure

**Examples:**

### Example 1: Treatment Failure
```
Raw Text: "Patients who failed at least one TNF inhibitor"

Output:
{
  "TREATMENT_HISTORY": [
    {
      "treatment": "TNF inhibitor",
      "treatment_class": "biologic",
      "response": "failed",
      "count": 1,
      "confidence": 1.0
    }
  ]
}
```

### Example 2: Treatment-Naive
```
Raw Text: "Biologic-naive patients"

Output:
{
  "TREATMENT_HISTORY": [
    {
      "treatment": "biologic",
      "treatment_class": "biologic",
      "response": "naive",
      "confidence": 1.0
    }
  ]
}
```

### Example 3: Washout Period
```
Raw Text: "Discontinuation of prior biologic therapy at least 4 weeks before screening"

Output:
{
  "TREATMENT_HISTORY": [
    {
      "treatment": "biologic therapy",
      "treatment_class": "biologic",
      "response": "experienced",
      "timing": {
        "relation": "at least",
        "amount": 4,
        "unit": "weeks",
        "reference": "screening"
      },
      "confidence": 1.0
    }
  ]
}
```

### Example 4: Multiple Treatment Failures
```
Raw Text: "Inadequate response to at least 2 different biologics including at least one TNF inhibitor"

Output:
{
  "TREATMENT_HISTORY": [
    {
      "treatment": "biologic",
      "treatment_class": "biologic",
      "response": "inadequate_response",
      "count": 2,
      "confidence": 1.0
    },
    {
      "treatment": "TNF inhibitor",
      "treatment_class": "biologic",
      "response": "inadequate_response",
      "count": 1,
      "confidence": 1.0
    }
  ]
}
```

---

# 7. LOGICAL FIELDS

## LOGICAL_OPERATOR

**Purpose:** Logical relationship between multiple conditions (AND, OR)

**Data Type:** `string`

**LLM Thought Process:**
```
1. Identify logical connectors in text:
   - "and" → AND (all conditions must be met)
   - "or" → OR (at least one condition must be met)
   - "," (comma) → usually AND (context-dependent)
2. Determine primary operator:
   - "PASI ≥10 and BSA ≥10" → "AND"
   - "guttate or pustular psoriasis" → "OR"
   - "PASI ≥10 and (facial or scalp)" → "AND" (nested OR)
3. If both AND and OR present, choose top-level operator
4. If only commas, default to "AND"
```

**Format:**
```json
{
  "LOGICAL_OPERATOR": "AND"  // String: "AND" or "OR"
}
```

**Validation Rules:**
- Must be one of: "AND", "OR"
- Use uppercase
- If both operators present, document nested structure in NESTED_CONDITION

**Examples:**

| Raw Text | LOGICAL_OPERATOR | Reasoning |
|----------|------------------|-----------|
| "PASI ≥10 and BSA ≥10" | "AND" | Explicit "and" |
| "guttate or pustular psoriasis" | "OR" | Explicit "or" |
| "PASI ≥10, BSA ≥10, PGA ≥3" | "AND" | Commas → AND |
| "PASI ≥10 and (facial or scalp)" | "AND" | Top-level operator |

---

# 8. METADATA FIELDS

## id

**Purpose:** Unique identifier for the criterion

**Data Type:** `string`

**Source:** Preserved from input criterion, NOT generated by LLM

**Format:**
```json
{
  "id": "CMB_1234"  // String, format varies by cluster
}
```

**Validation Rules:**
- Must be non-empty string
- Preserved from original input
- Format: `{CLUSTER}_{NUMBER}` (e.g., "CMB_1234", "AGE_0001")

---

## nct_id

**Purpose:** ClinicalTrials.gov identifier for the trial

**Data Type:** `string`

**Source:** Preserved from input criterion, NOT generated by LLM

**Format:**
```json
{
  "nct_id": "NCT12345678"  // String, NCT followed by 8 digits
}
```

**Validation Rules:**
- Must match pattern: `NCT\d{8}`
- Preserved from original input

---

## raw_text

**Purpose:** Original unmodified criterion text

**Data Type:** `string`

**Source:** Preserved from input criterion, NOT generated by LLM

**Format:**
```json
{
  "raw_text": "Patients with diabetes mellitus are excluded"
}
```

**Validation Rules:**
- Must be non-empty string
- Preserved EXACTLY as received (no modifications)

---

## CRITERION_TYPE

**Purpose:** Whether criterion is inclusion or exclusion

**Data Type:** `string` (enum)

**LLM Thought Process:**
```
1. Check original.criterion_type if available in input
2. If not available, analyze text:
   - "excluded", "not eligible", "must not have" → exclusion
   - "included", "eligible", "must have" → inclusion
3. Default to "exclusion" if unclear
```

**Format:**
```json
{
  "CRITERION_TYPE": "exclusion"  // "inclusion" or "exclusion"
}
```

**Allowed Values:**
- `"inclusion"` - Patient MUST meet this criterion
- `"exclusion"` - Patient must NOT meet this criterion

**Validation Rules:**
- Must be one of: "inclusion", "exclusion"
- ALWAYS REQUIRED in output

**Examples:**

| Raw Text | CRITERION_TYPE | Reasoning |
|----------|----------------|-----------|
| "Patients with diabetes are excluded" | "exclusion" | Explicit "excluded" |
| "Must have confirmed psoriasis diagnosis" | "inclusion" | "Must have" = requirement |
| "History of cancer" | "exclusion" | Default for conditions |

---

## EXCLUSION_STRENGTH

**Purpose:** How strictly the exclusion applies

**Data Type:** `string` (enum)

**LLM Thought Process:**
```
1. Determine CRITERION_TYPE first
2. For EXCLUSION criteria:
   - Absolute exclusion → "mandatory_exclude"
   - Conditional/relative → "conditional_exclude"
3. For INCLUSION criteria:
   - Absolute requirement → "mandatory_include"
   - Preferred/conditional → "conditional_include"
4. Map from CRITERION_TYPE:
   - exclusion → mandatory_exclude (default)
   - inclusion → mandatory_include (default)
```

**Format:**
```json
{
  "EXCLUSION_STRENGTH": "mandatory_exclude"
}
```

**Allowed Values:**
- `"mandatory_exclude"` - Absolutely excluded, no exceptions
- `"conditional_exclude"` - Excluded under certain conditions
- `"mandatory_include"` - Must be included, required
- `"conditional_include"` - Preferred but not absolute requirement

**Validation Rules:**
- Must be one of the allowed values
- ALWAYS REQUIRED in output
- Must be consistent with CRITERION_TYPE:
  - inclusion → mandatory_include OR conditional_include
  - exclusion → mandatory_exclude OR conditional_exclude

**Examples:**

| Raw Text | CRITERION_TYPE | EXCLUSION_STRENGTH | Reasoning |
|----------|----------------|-------------------|-----------|
| "Patients with active cancer are excluded" | exclusion | mandatory_exclude | Absolute exclusion |
| "History of cancer may exclude patient" | exclusion | conditional_exclude | "may" = conditional |
| "Must have confirmed diagnosis" | inclusion | mandatory_include | Absolute requirement |
| "Prior biologic therapy preferred" | inclusion | conditional_include | "preferred" = not required |

---

## confidence

**Purpose:** LLM's confidence score in the parsing accuracy

**Data Type:** `number` (0.0 - 1.0)

**LLM Thought Process:**
```
1. Evaluate parsing certainty:
   - Clear, unambiguous text → 0.9-1.0
   - Some interpretation needed → 0.7-0.9
   - Significant uncertainty → 0.5-0.7
   - High ambiguity/unfamiliar terms → <0.5
2. Reduce confidence for:
   - Unfamiliar medical terms
   - Ambiguous phrasing
   - Missing context
   - Complex nested conditions
```

**Format:**
```json
{
  "confidence": 0.95  // Number between 0.0 and 1.0
}
```

**Validation Rules:**
- Must be number between 0.0 and 1.0
- ALWAYS REQUIRED
- If < 0.7, criterion should be flagged for admin review

**Confidence Thresholds:**
- 0.9-1.0: High confidence, no review needed
- 0.7-0.9: Medium confidence, optional review
- 0.5-0.7: Low confidence, review recommended
- <0.5: Very low confidence, review required

---

## parsing_status

**Purpose:** Current processing status of the criterion

**Data Type:** `string` (enum)

**Source:** Set by parser/validator, NOT by LLM directly

**Format:**
```json
{
  "parsing_status": "complete"
}
```

**Allowed Values:**
- `"complete"` - Successfully parsed, ready for use
- `"pending_admin_review"` - Needs human review (unfamiliar terms, low confidence)
- `"error"` - Parsing failed, needs investigation

**Determination Rules:**
- If confidence >= 0.7 AND no unfamiliar_term_flag → "complete"
- If unfamiliar_term_flag = true OR confidence < 0.7 → "pending_admin_review"
- If parsing exception/failure → "error"

---

## unfamiliar_term_flag

**Purpose:** Flag indicating criterion contains terms not in reference lists

**Data Type:** `boolean`

**LLM Thought Process:**
```
1. For each medical term extracted, check against reference lists
2. If any term not found and confidence < 0.7:
   - Set unfamiliar_term_flag = true
   - Set parsing_status = "pending_admin_review"
3. See "Unfamiliar Term Detection" section for 3-stage matching algorithm
```

**Format:**
```json
{
  "unfamiliar_term_flag": true
}
```

**Validation Rules:**
- Must be boolean
- Default to false
- If true, parsing_status should be "pending_admin_review"

---

## SUBJECTIVE_ESTIMATE

**Purpose:** Flag indicating criterion requires subjective medical judgment (alias for REQUIRES_CLINICAL_JUDGMENT)

**Data Type:** `boolean`

**Note:** This field is functionally equivalent to REQUIRES_CLINICAL_JUDGMENT. Use either, but prefer REQUIRES_CLINICAL_JUDGMENT for clarity.

**Format:**
```json
{
  "SUBJECTIVE_ESTIMATE": true
}
```

**Validation Rules:**
- Must be boolean
- Default to false
- Should match REQUIRES_CLINICAL_JUDGMENT value

---

## original

**Purpose:** Preserved original input data for reference

**Data Type:** `object`

**Source:** Preserved from input, NOT generated by LLM

**Format:**
```json
{
  "original": {
    "criterion_type": "exclusion",
    "source": "study protocol",
    "cluster": "CMB"
  }
}
```

**Validation Rules:**
- Must be object if present
- All original input fields preserved
- Optional field

---

## REQUIRES_CLINICAL_JUDGMENT

**Purpose:** Flag indicating criterion requires physician assessment

**Data Type:** `boolean`

**LLM Thought Process:**
```
1. Look for phrases indicating subjective assessment:
   - "clinically significant"
   - "in the opinion of the investigator"
   - "deemed appropriate by physician"
   - "clinical judgment"
   - "investigator discretion"
2. Look for vague terms:
   - "significant", "substantial", "relevant"
   - "appropriate", "adequate", "sufficient"
3. If present, set to true
4. If criterion is purely objective (numeric thresholds), set to false
```

**Format:**
```json
{
  "REQUIRES_CLINICAL_JUDGMENT": true
}
```

**Validation Rules:**
- Must be boolean
- Default to false if not applicable

**Examples:**

| Raw Text | REQUIRES_CLINICAL_JUDGMENT | Reasoning |
|----------|----------------------------|-----------|
| "PASI score ≥ 10" | false | Objective numeric threshold |
| "Clinically significant facial involvement" | true | "Clinically significant" is subjective |
| "In the opinion of the investigator, patient is suitable" | true | Explicit physician judgment |

---

## AMBIGUITY_FLAG

**Purpose:** Flag indicating criterion text is ambiguous or unclear

**Data Type:** `boolean`

**✅ NEW IN v2.1:** Added 6 complete examples with reasoning

**LLM Thought Process:**
```
1. Look for indicators of ambiguity:
   - Incomplete sentences
   - Missing context
   - Unclear references ("the following", "as mentioned")
   - Contradictory statements
   - Vague terms without definition
   - Missing critical information
2. If criterion cannot be fully parsed, set to true
3. Add to admin review queue with explanation
```

**Format:**
```json
{
  "AMBIGUITY_FLAG": true,
  "ambiguity_reason": "Incomplete sentence; missing what 'the following' refers to"
}
```

**Validation Rules:**
- Must be boolean
- If true, must include `ambiguity_reason` field
- Add to admin review queue

---

### **AMBIGUITY_FLAG Examples:**

#### **Example 1: Incomplete Sentence**
```
Raw Text: "PASI score is ≥10 and <12 with at least one of the following: >"

LLM Reasoning:
1. Sentence is incomplete: "with at least one of the following: >"
2. The ">" character suggests text was cut off
3. Missing what "the following" refers to
4. Cannot fully parse this criterion

Output:
{
  "id": "SEV_1597",
  "raw_text": "PASI score is ≥10 and <12 with at least one of the following: >",
  "MEASUREMENTS": [
    {
      "parameter": "PASI",
      "min": 10,
      "max": 12,
      "comparison": "range"
    }
  ],
  "AMBIGUITY_FLAG": true,
  "ambiguity_reason": "Incomplete sentence: 'with at least one of the following: >' - missing referenced items"
}
```

#### **Example 2: Unclear Reference**
```
Raw Text: "As mentioned above, patients must meet the criteria"

LLM Reasoning:
1. "As mentioned above" refers to something not in this text
2. "the criteria" is vague - which criteria?
3. Cannot determine what needs to be extracted
4. This criterion depends on external context

Output:
{
  "id": "XXX_1234",
  "raw_text": "As mentioned above, patients must meet the criteria",
  "AMBIGUITY_FLAG": true,
  "ambiguity_reason": "Unclear reference: 'as mentioned above' and 'the criteria' refer to external context not provided"
}
```

#### **Example 3: Missing Context**
```
Raw Text: "Patients with the condition are excluded"

LLM Reasoning:
1. "the condition" is not specified
2. Which condition? Psoriasis? Cancer? Infection?
3. Cannot extract CONDITION_TYPE without knowing what "the condition" is
4. Missing critical information

Output:
{
  "id": "XXX_5678",
  "raw_text": "Patients with the condition are excluded",
  "AMBIGUITY_FLAG": true,
  "ambiguity_reason": "Missing context: 'the condition' is not specified"
}
```

#### **Example 4: Contradictory Statements**
```
Raw Text: "PASI ≥10 or PASI <10"

LLM Reasoning:
1. This criterion says "PASI ≥10" OR "PASI <10"
2. This covers ALL possible PASI values (always true)
3. This is contradictory/meaningless as an eligibility criterion
4. Likely an error in data entry

Output:
{
  "id": "XXX_9012",
  "raw_text": "PASI ≥10 or PASI <10",
  "MEASUREMENTS": [
    {
      "parameter": "PASI",
      "value": 10,
      "comparison": ">="
    },
    {
      "parameter": "PASI",
      "value": 10,
      "comparison": "<"
    }
  ],
  "LOGICAL_OPERATOR": "OR",
  "AMBIGUITY_FLAG": true,
  "ambiguity_reason": "Contradictory: criterion covers all possible PASI values (always true); likely data entry error"
}
```

#### **Example 5: Vague Term Without Definition**
```
Raw Text: "Clinically significant abnormalities"

LLM Reasoning:
1. "Clinically significant" is subjective (requires clinical judgment)
2. "abnormalities" is vague - what type? Lab? ECG? Physical exam?
3. No specific criteria provided
4. Cannot extract structured data

Output:
{
  "id": "XXX_3456",
  "raw_text": "Clinically significant abnormalities",
  "REQUIRES_CLINICAL_JUDGMENT": true,
  "AMBIGUITY_FLAG": true,
  "ambiguity_reason": "Vague term: 'abnormalities' not specified (lab? ECG? physical exam?); 'clinically significant' is subjective"
}
```

#### **Example 6: Clear Criterion (No Ambiguity)**
```
Raw Text: "PASI score ≥ 10 at baseline"

LLM Reasoning:
1. Clear parameter: PASI
2. Clear comparison: ≥
3. Clear value: 10
4. Clear timeframe: baseline
5. No ambiguity

Output:
{
  "id": "SEV_1234",
  "raw_text": "PASI score ≥ 10 at baseline",
  "MEASUREMENTS": [
    {
      "parameter": "PASI",
      "value": 10,
      "comparison": ">="
    }
  ],
  "TIMEFRAME": {
    "relation": "at",
    "reference": "baseline"
  },
  "AMBIGUITY_FLAG": false  // ← No ambiguity
}
```

---

## NESTED_CONDITION

**Purpose:** Structured representation of nested logical conditions for patient matching

**Data Type:** `object` (changed from `string` in v2.1)

**✅ MAJOR CHANGE IN v2.1:**
- Changed from simple string description to structured object
- Enables automated patient matching and question generation
- Includes quantifiers ("at least one", "all", "at least N")

**LLM Thought Process:**
```
1. Identify nested structures:
   - "with at least one of the following:"
   - "including but not limited to:"
   - "such as:"
   - "with any of:"
   - "with all of:"
2. Extract:
   - Main condition (outer requirement)
   - Nested items (inner requirements)
   - Logical operator for nested items (AND/OR)
   - Quantifier ("at least one", "all", "any", "at least N")
3. Structure for patient matching:
   - Patient must meet main condition
   - Patient must meet nested condition (based on quantifier)
```

**Format:**
```json
{
  "NESTED_CONDITION": {
    "main_condition": {
      "parameter": "PASI",
      "min": 10,
      "max": 12,
      "comparison": "range"
    },
    "nested_operator": "at_least_one",  // "all", "any", "at_least_one", "at_least_n"
    "nested_count": null,               // Only for "at_least_n" (e.g., 2 for "at least 2")
    "nested_items": [
      {
        "type": "ANATOMICAL_LOCATION",
        "values": ["facial", "scalp"]
      }
    ],
    "nested_logical_operator": "OR"  // "AND" or "OR" between nested items
  }
}
```

**Validation Rules:**
- `main_condition` must be object (measurement, condition, etc.)
- `nested_operator` must be one of: "all", "any", "at_least_one", "at_least_n"
- `nested_count` required only when `nested_operator` is "at_least_n"
- `nested_items` must be array of objects
- `nested_logical_operator` must be "AND" or "OR"

**⚠️ VALID nested_items.type VALUES (v2.2):**

The `type` field in `nested_items` MUST be one of these defined values:

| Type | Description | Example |
|------|-------------|---------|
| `CONDITION_TYPE` | Disease or medical condition | `{"type": "CONDITION_TYPE", "values": ["viral infection", "bacterial infection"]}` |
| `ANATOMICAL_LOCATION` | Body part or organ system | `{"type": "ANATOMICAL_LOCATION", "values": ["face", "scalp"]}` |
| `SEVERITY` | Severity level | `{"type": "SEVERITY", "values": ["severe", "moderate"]}` |
| `TIMEFRAME` | Temporal requirement | `{"type": "TIMEFRAME", "values": ["within 6 months"]}` |
| `TREATMENT_HISTORY` | Prior treatment | `{"type": "TREATMENT_HISTORY", "values": ["failed TNF inhibitor"]}` |
| `CONDITION_PATTERN` | Temporal pattern | `{"type": "CONDITION_PATTERN", "values": ["history", "active"]}` |
| `MEASUREMENT` | Lab value or score | `{"type": "MEASUREMENT", "values": ["PASI > 10"]}` |
| `TREATMENT_REQUIREMENT` | Treatment requirement | `{"type": "TREATMENT_REQUIREMENT", "values": ["requires hospitalization"]}` |
| `EXCEPTION` | Exception condition | `{"type": "EXCEPTION", "values": ["unless adequately treated"]}` |

**❌ FORBIDDEN - Do NOT invent new types:**
- ❌ `infection_category` → use `CONDITION_TYPE` instead
- ❌ `requirement` → use `TREATMENT_REQUIREMENT` instead
- ❌ Any lowercase type → use UPPERCASE from the list above

---

### **NESTED_CONDITION Examples:**

#### **Example 1: "At Least One Of" (Your Original Example)**
```
Raw Text: "PASI score is ≥10 and <12 with at least one of the following: Clinically relevant facial or scalp involvement"

LLM Processing:
1. Main condition: PASI score range (10-12)
2. Nested structure: "with at least one of the following:"
3. Nested items: facial OR scalp involvement
4. Quantifier: "at least one" (patient needs ≥1 of the listed items)

Output:
{
  "id": "SEV_1597",
  "raw_text": "PASI score is ≥10 and <12 with at least one of the following: Clinically relevant facial or scalp involvement",
  
  // ✅ ORDINARY FIELDS (for simple queries)
  "MEASUREMENTS": [
    {
      "parameter": "PASI",
      "min": 10,
      "max": 12,
      "comparison": "range"
    }
  ],
  
  "ANATOMICAL_LOCATION": ["facial", "scalp"],
  
  "LOGICAL_OPERATOR": "AND",  // Between main and nested
  
  "REQUIRES_CLINICAL_JUDGMENT": true,  // "Clinically relevant"
  
  // ✅ NESTED_CONDITION (for complex patient matching)
  "NESTED_CONDITION": {
    "main_condition": {
      "parameter": "PASI",
      "min": 10,
      "max": 12,
      "comparison": "range"
    },
    "nested_operator": "at_least_one",
    "nested_items": [
      {
        "type": "ANATOMICAL_LOCATION",
        "values": ["facial", "scalp"]
      }
    ],
    "nested_logical_operator": "OR"
  }
}
```

**Patient Matching Logic:**
```python
def matches_criterion(patient, criterion):
    """
    Check if patient meets criterion SEV_1597.
    
    Patient data:
    - pasi_score: 11
    - facial_involvement: True
    - scalp_involvement: False
    """
    
    # Check if NESTED_CONDITION exists
    if 'NESTED_CONDITION' not in criterion:
        return simple_match(patient, criterion)
    
    nested = criterion['NESTED_CONDITION']
    
    # Step 1: Check main condition
    main = nested['main_condition']
    if not (main['min'] <= patient.pasi_score < main['max']):
        return False  # Patient doesn't meet PASI requirement
    
    # Step 2: Check nested condition
    nested_op = nested['nested_operator']
    nested_items = nested['nested_items'][0]  # Anatomical locations
    
    if nested_op == 'at_least_one':
        # Patient needs at least ONE of: facial OR scalp
        locations = nested_items['values']
        
        for location in locations:
            if patient.has_involvement(location):
                return True  # Found at least one → ELIGIBLE
        
        return False  # No locations found → NOT ELIGIBLE
    
    return False

# Test with patient data:
patient = Patient(pasi_score=11, facial_involvement=True, scalp_involvement=False)
result = matches_criterion(patient, criterion)
# Result: True
# Reasoning:
#   1. PASI = 11 → meets range [10, 12) ✅
#   2. Has facial involvement → meets "at least one" ✅
#   3. ELIGIBLE
```

**Question Tree Generation:**
```python
def generate_questions(criterion):
    """
    Generate questions for patient eligibility screening.
    """
    questions = []
    
    if 'NESTED_CONDITION' in criterion:
        nested = criterion['NESTED_CONDITION']
        
        # Question 1: Main condition
        main = nested['main_condition']
        questions.append({
            "question": f"What is your {main['parameter']} score?",
            "type": "numeric",
            "validation": {
                "min": main['min'],
                "max": main['max']
            }
        })
        
        # Question 2: Nested condition
        nested_items = nested['nested_items'][0]
        if nested['nested_operator'] == 'at_least_one':
            questions.append({
                "question": f"Do you have involvement in any of the following areas? (Select all that apply)",
                "type": "multi_select",
                "options": nested_items['values'],
                "validation": {
                    "min_selections": 1  # At least one required
                }
            })
    
    return questions

# Result:
# [
#   {
#     "question": "What is your PASI score?",
#     "type": "numeric",
#     "validation": {"min": 10, "max": 12}
#   },
#   {
#     "question": "Do you have involvement in any of the following areas? (Select all that apply)",
#     "type": "multi_select",
#     "options": ["facial", "scalp"],
#     "validation": {"min_selections": 1}
#   }
# ]
```

---

#### **Example 2: "At Least N Of"**
```
Raw Text: "BSA ≥ 10% with involvement of at least two of the following: scalp, face, hands, feet"

LLM Processing:
1. Main condition: BSA ≥ 10%
2. Nested structure: "with involvement of at least two of the following:"
3. Nested items: scalp, face, hands, feet
4. Quantifier: "at least two" (patient needs ≥2 of the listed items)

Output:
{
  "MEASUREMENTS": [
    {
      "parameter": "BSA",
      "value": 10,
      "comparison": ">=",
      "unit": "%"
    }
  ],
  
  "ANATOMICAL_LOCATION": ["scalp", "face", "hands", "feet"],
  
  "LOGICAL_OPERATOR": "AND",
  
  "NESTED_CONDITION": {
    "main_condition": {
      "parameter": "BSA",
      "value": 10,
      "comparison": ">=",
      "unit": "%"
    },
    "nested_operator": "at_least_n",
    "nested_count": 2,  // ← At least 2 items required
    "nested_items": [
      {
        "type": "ANATOMICAL_LOCATION",
        "values": ["scalp", "face", "hands", "feet"]
      }
    ],
    "nested_logical_operator": "OR"
  }
}
```

**Patient Matching Logic:**
```python
def matches_criterion(patient, criterion):
    # Check main condition
    if patient.bsa < 10:
        return False
    
    # Check nested condition
    nested = criterion['NESTED_CONDITION']
    if nested['nested_operator'] == 'at_least_n':
        # Count how many locations patient has involvement
        locations = nested['nested_items'][0]['values']
        count = sum(1 for loc in locations if patient.has_involvement(loc))
        
        required_count = nested['nested_count']  # 2
        if count < required_count:
            return False
    
    return True
```

---

#### **Example 3: "All Of"**
```
Raw Text: "PASI ≥ 12 with all of the following: scalp involvement, nail involvement, and joint involvement"

LLM Processing:
1. Main condition: PASI ≥ 12
2. Nested structure: "with all of the following:"
3. Nested items: scalp, nail, joint involvement
4. Quantifier: "all" (patient needs ALL listed items)

Output:
{
  "MEASUREMENTS": [
    {
      "parameter": "PASI",
      "value": 12,
      "comparison": ">="
    }
  ],
  
  "ANATOMICAL_LOCATION": ["scalp", "nails", "joints"],
  
  "LOGICAL_OPERATOR": "AND",
  
  "NESTED_CONDITION": {
    "main_condition": {
      "parameter": "PASI",
      "value": 12,
      "comparison": ">="
    },
    "nested_operator": "all",
    "nested_items": [
      {
        "type": "ANATOMICAL_LOCATION",
        "values": ["scalp", "nails", "joints"]
      }
    ],
    "nested_logical_operator": "AND"  // ← ALL items required
  }
}
```

**Patient Matching Logic:**
```python
def matches_criterion(patient, criterion):
    # Check main condition
    if patient.pasi_score < 12:
        return False
    
    # Check nested condition
    nested = criterion['NESTED_CONDITION']
    if nested['nested_operator'] == 'all':
        # Patient needs ALL locations
        locations = nested['nested_items'][0]['values']
        for loc in locations:
            if not patient.has_involvement(loc):
                return False  # Missing required location
    
    return True
```

---

## NEGATION_DETECTED

**Purpose:** Explicit documentation of negation in criterion (SUPPLEMENTARY, not primary)

**Data Type:** `object`

**✅ IMPORTANT IN v2.1:**
- Negation is ALWAYS parsed into normal fields (CONDITION_TYPE, DISEASE_VARIANT, CONDITION_PATTERN, EXCEPTION_CONDITION)
- NEGATION_DETECTED is SUPPLEMENTARY documentation for transparency
- Includes `affected_fields` to show which fields were impacted by negation

**LLM Thought Process:**
```
1. Detect negation patterns:
   - "non-" prefix: "non-plaque"
   - "absence of": "absence of plaque psoriasis"
   - "other than": "other than plaque"
   - "except": "except basal cell carcinoma"
2. Parse negation into appropriate normal fields:
   - "non-plaque" → DISEASE_VARIANT: ["non-plaque"]
   - "absence of" → CONDITION_PATTERN: ["absence"]
   - "except X" → EXCEPTION_CONDITION: {excluded_types: ["X"]}
3. Document negation in NEGATION_DETECTED:
   - negated_term: what is being negated
   - interpretation: plain language explanation
   - affected_fields: which fields were impacted
   - parsing_note: how negation was handled
```

**Format:**
```json
{
  "NEGATION_DETECTED": {
    "negated_term": "plaque",
    "negation_type": "prefix",  // "prefix", "absence_of", "exception", "other_than", "scope_limiting"
    "interpretation": "Excludes patients with plaque psoriasis; includes all other psoriasis variants",
    "affected_fields": ["CONDITION_TYPE", "DISEASE_VARIANT"],
    "parsing_note": "'non-plaque' treated as distinct variant category, NOT absence of 'plaque'"
  }
}
```

**⚠️ VALID NEGATION_DETECTED FIELDS (v2.2):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `negated_term` | string | ✅ Yes | The term being negated |
| `negation_type` | string | No | Type: "prefix", "absence_of", "exception", "other_than", "scope_limiting" |
| `interpretation` | string | No | Human-readable explanation |
| `affected_fields` | array | No | List of fields impacted by negation |
| `parsing_note` | string | No | How negation was handled |
| `is_negated` | boolean | No | **Legacy** - true if negation present |
| `context` | string | No | **Legacy** - context string |

**❌ FORBIDDEN - Do NOT add fields not in this list.**

**Validation Rules:**
- `negated_term` must be string
- `negation_type` must be one of: "prefix", "absence_of", "exception", "other_than", "scope_limiting"
- `interpretation` must be string (human-readable)
- `affected_fields` must be array of field names
- `parsing_note` must be string

---

### **NEGATION_DETECTED Examples:**

#### **Example 1: "Non-" Prefix**
```
Raw Text: "Diagnosis of non-plaque psoriasis or drug-induced psoriasis"

LLM Processing:
1. Identify conditions: "non-plaque psoriasis", "drug-induced psoriasis"
2. Detect negation: "non-" prefix on "plaque"
3. Parse into NORMAL fields:
   - CONDITION_TYPE: ["non-plaque psoriasis", "drug-induced psoriasis"]
   - DISEASE_VARIANT: ["non-plaque", "drug-induced"]
4. Document negation in NEGATION_DETECTED (for transparency)

Output:
{
  "id": "DIT_2109",
  "nct_id": "NCT06672393",
  "raw_text": "Diagnosis of non-plaque psoriasis or drug-induced psoriasis",
  
  // ✅ PARSED INTO NORMAL FIELDS
  "CONDITION_TYPE": [
    "non-plaque psoriasis",
    "drug-induced psoriasis"
  ],
  
  "DISEASE_VARIANT": [
    "non-plaque",      // ← Parsed as a variant category
    "drug-induced"
  ],
  
  "CONDITION_PATTERN": ["current"],
  
  "LOGICAL_OPERATOR": "OR",
  
  "EXCLUSION_STRENGTH": "mandatory_exclude",
  
  // ✅ SUPPLEMENTARY DOCUMENTATION
  "NEGATION_DETECTED": {
    "negated_term": "plaque",
    "negation_type": "prefix",
    "interpretation": "Excludes patients with plaque psoriasis; includes all other psoriasis variants",
    "affected_fields": ["CONDITION_TYPE", "DISEASE_VARIANT"],
    "parsing_note": "'non-plaque' treated as a distinct variant category, NOT as absence of 'plaque'"
  }
}
```

**Patient Matching Logic:**
```python
def matches_criterion_dit_2109(patient):
    """
    Criterion: "Diagnosis of non-plaque psoriasis or drug-induced psoriasis"
    
    This is an EXCLUSION criterion (EXCLUSION_STRENGTH: "mandatory_exclude")
    Patient is EXCLUDED if they have:
      - Non-plaque psoriasis (any variant except plaque) OR
      - Drug-induced psoriasis
    """
    
    # Check if patient has non-plaque psoriasis
    if patient.disease_variant != "plaque" and patient.has_psoriasis:
        return "EXCLUDED"  # Has non-plaque psoriasis
    
    # Check if patient has drug-induced psoriasis
    if patient.disease_variant == "drug-induced":
        return "EXCLUDED"  # Has drug-induced psoriasis
    
    # Patient has plaque psoriasis or no psoriasis
    return "ELIGIBLE"
```

---

#### **Example 2: "Absence Of"**
```
Raw Text: "Patients in the absence of plaque psoriasis"

LLM Processing:
1. Detect negation: "absence of" + "plaque psoriasis"
2. Interpretation: Patient must NOT have plaque psoriasis
3. Parse into NORMAL fields:
   - CONDITION_TYPE: ["plaque psoriasis"]
   - CONDITION_PATTERN: ["absence"]  // ← New pattern value
4. Document negation

Output:
{
  "id": "DIT_2426",
  "nct_id": "NCT06643260",
  "raw_text": "Patients in the absence of plaque psoriasis",
  
  // ✅ PARSED INTO NORMAL FIELDS
  "CONDITION_TYPE": ["plaque psoriasis"],
  
  "CONDITION_PATTERN": ["absence"],  // ← Indicates negation
  
  "DISEASE_VARIANT": [],  // Empty - no specific variant mentioned
  
  "EXCLUSION_STRENGTH": "mandatory_exclude",
  
  // ✅ SUPPLEMENTARY DOCUMENTATION
  "NEGATION_DETECTED": {
    "negated_term": "plaque psoriasis",
    "negation_type": "absence_of",
    "interpretation": "Patient must NOT have plaque psoriasis",
    "affected_fields": ["CONDITION_TYPE", "CONDITION_PATTERN"],
    "parsing_note": "CONDITION_PATTERN set to 'absence' to indicate negation"
  }
}
```

**Patient Matching Logic:**
```python
def matches_criterion_dit_2426(patient):
    """
    Criterion: "Patients in the absence of plaque psoriasis"
    
    This is an EXCLUSION criterion.
    Patient is EXCLUDED if they do NOT have plaque psoriasis.
    """
    
    # Check CONDITION_PATTERN
    if "absence" in criterion['CONDITION_PATTERN']:
        # Patient must NOT have the condition
        if patient.disease_variant == "plaque":
            return "ELIGIBLE"  # Has plaque → eligible (absence criterion reversed)
        else:
            return "EXCLUDED"  # Doesn't have plaque → excluded
```

---

#### **Example 3: "Except" (Exception Clause)**
```
Raw Text: "History of cancer except basal cell carcinoma"

LLM Processing:
1. Main condition: "history of cancer"
2. Exception: "except basal cell carcinoma"
3. Parse into NORMAL fields:
   - CONDITION_TYPE: ["cancer"]
   - CONDITION_PATTERN: ["history"]
   - EXCEPTION_CONDITION: {...}
4. Document negation

Output:
{
  "id": "CMB_2036",
  "raw_text": "History of cancer except basal cell carcinoma",
  
  // ✅ PARSED INTO NORMAL FIELDS
  "CONDITION_TYPE": ["cancer"],
  
  "CONDITION_PATTERN": ["history"],
  
  "EXCEPTION_CONDITION": {
    "excluded_types": ["basal cell carcinoma"],
    "condition": "any status",
    "makes_eligible": true  // Exception allows eligibility
  },
  
  "EXCLUSION_STRENGTH": "mandatory_exclude",
  
  // ✅ SUPPLEMENTARY DOCUMENTATION
  "NEGATION_DETECTED": {
    "negated_term": "basal cell carcinoma",
    "negation_type": "exception",
    "interpretation": "Patients with basal cell carcinoma ARE eligible despite having cancer history",
    "affected_fields": ["EXCEPTION_CONDITION"],
    "parsing_note": "Exception clause overrides main exclusion criterion"
  }
}
```

**Patient Matching Logic:**
```python
def matches_criterion_cmb_2036(patient):
    """
    Criterion: "History of cancer except basal cell carcinoma"
    
    This is an EXCLUSION criterion with exception.
    Patient is EXCLUDED if they have:
      - History of cancer (any type)
      - EXCEPT basal cell carcinoma (this is allowed)
    """
    
    # Check if patient has cancer history
    if not patient.has_condition("cancer", pattern="history"):
        return "ELIGIBLE"  # No cancer history
    
    # Patient has cancer history - check exception
    exception = criterion['EXCEPTION_CONDITION']
    if patient.cancer_type in exception['excluded_types']:
        return "ELIGIBLE"  # Has basal cell carcinoma → exception applies
    else:
        return "EXCLUDED"  # Has other cancer type
```

---

# 9. ADMIN REVIEW WORKFLOW

## Unfamiliar Terms Detection

When LLM encounters an unfamiliar term (not in reference lists), it uses a **3-stage matching process**:

### **Stage 1: Exact Match**
```python
# Check if term exists in reference list
term = "plaque psoriasis"
if term.lower() in reference_list['condition_types']:
    familiar = True
    confidence = 1.0
else:
    proceed to Stage 2
```

### **Stage 2: Base Term Match**
```python
# Check for partial matches with base medical terms
base_terms = ["psoriasis", "arthritis", "diabetes", "cancer", "infection", 
              "hepatitis", "tuberculosis", "syndrome", "disease"]

for base_term in base_terms:
    if base_term in term.lower():
        # It's a variant of a known condition
        familiar = True
        confidence = 0.85
        break
else:
    proceed to Stage 3
```

### **Stage 3: LLM Confidence Score**
```python
# LLM assigns confidence based on medical knowledge
# If confidence < 0.7, flag as unfamiliar
if confidence < 0.7:
    unfamiliar_term_flag = True
    add_to_admin_review_queue()
```

---

## Admin Review Process

### **Step 1: System Detects Unfamiliar Term**

```json
{
  "id": "CMB_5678",
  "raw_text": "Diagnosis of Schnitzler syndrome",
  "CONDITION_TYPE": ["schnitzler syndrome"],
  "unfamiliar_term_flag": true,
  "confidence": 0.6,
  "parsing_status": "pending_admin_review"
}
```

### **Step 2: System Adds to Admin Review Queue**

```json
{
  "review_queue": [
    {
      "queue_id": "REV_001",
      "term": "schnitzler syndrome",
      "detected_category": "condition_type",
      "suggested_reference_list": "condition_types",
      "criterion_id": "CMB_5678",
      "nct_id": "NCT12345678",
      "raw_text": "Diagnosis of Schnitzler syndrome",
      "context": "Found in CONDITION_TYPE field",
      "frequency": 1,
      "llm_confidence": 0.6,
      "date_flagged": "2026-01-31",
      "status": "pending"
    }
  ]
}
```

### **Step 3: Admin Reviews in Admin Panel**

**Admin Panel UI:**

```
┌─────────────────────────────────────────────────────────────┐
│ Unfamiliar Term Review Queue                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Term: "schnitzler syndrome"                                 │
│ Category: condition_type                                    │
│ Confidence: 0.6 (Low - needs review)                        │
│                                                             │
│ Context:                                                    │
│ - Criterion ID: CMB_5678                                    │
│ - Trial: NCT12345678                                        │
│ - Raw Text: "Diagnosis of Schnitzler syndrome"             │
│ - Frequency: 1 occurrence                                   │
│                                                             │
│ Suggested Action: Add to "condition_types" reference list   │
│                                                             │
│ Admin Actions:                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [ ] Verify this is a valid medical condition            │ │
│ │ [ ] Add to reference list: [condition_types ▼]          │ │
│ │ [ ] Add synonyms/variants (optional):                   │ │
│ │     _______________________________________________     │ │
│ │ [ ] Mark as invalid/data error                          │ │
│ │ [ ] Request more information                            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Approve] [Reject] [Need More Info]                         │
└─────────────────────────────────────────────────────────────┘
```

### **Step 4: Admin Actions**

#### **Option A: Approve and Add to Reference List**

Admin researches "Schnitzler syndrome":
- Googles the term
- Finds it's a rare autoinflammatory disease
- Confirms it's a valid medical condition
- Clicks "Approve"

**System updates:**
```json
{
  "reference_lists": {
    "condition_types": [
      {
        "term": "schnitzler syndrome",
        "frequency": 1,
        "verified": true,
        "verified_by": "admin_user_123",
        "verified_date": "2026-01-31"
      }
    ]
  }
}
```

**Criterion is updated:**
```json
{
  "id": "CMB_5678",
  "CONDITION_TYPE": ["schnitzler syndrome"],
  "unfamiliar_term_flag": false,  // ← Cleared
  "confidence": 1.0,  // ← Updated
  "parsing_status": "complete"
}
```

**Future parsing:**
- "Schnitzler syndrome" is now in reference list
- Next time it appears, system recognizes it immediately
- No admin review needed

---

#### **Option B: Add Synonyms/Variants**

Admin discovers "Schnitzler syndrome" is also called "Schnitzler's syndrome":

```json
{
  "reference_lists": {
    "condition_types": [
      {
        "term": "schnitzler syndrome",
        "synonyms": ["schnitzler's syndrome"],
        "frequency": 1,
        "verified": true
      }
    ]
  }
}
```

---

#### **Option C: Mark as Invalid/Data Error**

Admin discovers this is a typo:

```json
{
  "review_queue": [
    {
      "queue_id": "REV_001",
      "status": "rejected",
      "rejection_reason": "Data entry error - should be 'Sjogren syndrome'",
      "admin_note": "Contacted trial coordinator for correction"
    }
  ]
}
```

---

#### **Option D: Request More Information**

Admin is unsure and needs clinical expert input:

```json
{
  "review_queue": [
    {
      "queue_id": "REV_001",
      "status": "escalated",
      "escalated_to": "clinical_expert_team",
      "admin_note": "Unfamiliar rare disease - need clinical validation"
    }
  ]
}
```

---

## Admin Responsibilities

1. **Verify medical validity** - Is this a real medical condition?
2. **Add to reference list** - Make it recognizable for future parsing
3. **Add synonyms** - Capture alternate spellings/names
4. **Flag errors** - Identify data entry mistakes
5. **Escalate complex cases** - Get clinical expert input when needed

## Benefits

- ✅ **Continuous learning** - System gets smarter over time
- ✅ **Quality control** - Human oversight prevents errors
- ✅ **Transparency** - Admin knows what's being added
- ✅ **Efficiency** - Only review unfamiliar terms once

---

# REFERENCE LISTS

## Clinical Scores

See `reference_lists.json` for complete list. Top scores:

1. PASI - Psoriasis Area and Severity Index
2. BSA - Body Surface Area
3. PGA - Physician Global Assessment
4. IGA - Investigator Global Assessment
5. sPGA - static Physician Global Assessment
6. PHQ-9 - Patient Health Questionnaire-9
7. GPPGA - Generalized Pustular Psoriasis Global Assessment
8. PPPASI - Palmoplantar Psoriasis Area and Severity Index
9. cDAPSA - Clinical Disease Activity Score for Psoriatic Arthritis
10. DLQI - Dermatology Life Quality Index

## Anatomical Locations

See `reference_lists.json` for complete list. Top locations:

1. scalp
2. face
3. palms
4. soles
5. hands
6. feet
7. genitals
8. nails
9. joints
10. trunk

## Condition Patterns

**✅ UPDATED IN v2.1:**

**Temporal:**
- current
- history
- past
- previous
- prior
- recent

**Status:**
- active ← **MOVED HERE from SEVERITY**
- inactive ← **MOVED HERE from SEVERITY**
- ongoing
- resolved
- remission
- absence ← **NEW IN v2.1**

**Change:**
- new
- worsening
- improving

**Diagnosis:**
- confirmed
- suspected
- diagnosed
- documented

## Psoriasis Variants

See `reference_lists.json` for complete list. All variants:

1. drug-induced
2. guttate
3. erythrodermic
4. pustular
5. plaque psoriasis
6. inverse
7. nail psoriasis
8. unspecified
9. non-plaque ← **For negation cases**

---

# SUMMARY

**Version:** 2.1  
**Total Fields:** 18

**Categories:**
- Age: 3 fields
- Measurements/Scores: 2 fields
- Conditions: 4 fields
- Anatomical: 1 field
- Temporal: 1 field
- Logical: 1 field
- Metadata: 6 fields

**Reference Lists:** 6 lists
- clinical_scores
- anatomical_locations
- condition_types
- condition_patterns (updated)
- psoriasis_variants (updated)
- biomarker_names

**Admin Review Workflow:** Enabled with 3-stage unfamiliar term detection

---

**Major Changes in v2.1:**

1. ✅ **Removed "active" and "inactive" from SEVERITY** - Moved to CONDITION_PATTERN
2. ✅ **Added "absence" to CONDITION_PATTERN** - For negation handling
3. ✅ **Changed NESTED_CONDITION to object** - Enables patient matching
4. ✅ **Added 6 AMBIGUITY_FLAG examples** - With reasoning
5. ✅ **Added unfamiliar term detection algorithm** - 3-stage matching
6. ✅ **Added complete admin workflow** - With UI mockup
7. ✅ **Added patient matching examples** - For all complex fields
8. ✅ **Clarified NEGATION_DETECTED** - Supplementary, not primary

---

**Next Steps:**
1. Review this catalog
2. Approve/modify field definitions
3. Implement 3-tier LLM parsing system using this catalog
4. Test on failing criteria
5. Deploy with admin review interface
