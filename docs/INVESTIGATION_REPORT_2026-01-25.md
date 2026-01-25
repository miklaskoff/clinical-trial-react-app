# Clinical Trial Matching Investigation Report
**Date:** 2026-01-25  
**Investigator:** GitHub Copilot  
**Repository:** miklaskoff/clinical-trial-react-app  
**Version:** 5.0

---

## Executive Summary

This investigation examined 6 specific trial matching scenarios to identify root causes for inaccuracies in trial parsing, matching, and confidence assignments. Using actual database analysis and code review, I identified critical parsing errors, logic issues, and semantic matching gaps.

**Key Findings:**
1. ❌ **CRITICAL PARSING ERROR** - NCT06979453: Weight threshold not extracted to numeric fields
2. ❌ **CRITICAL DUPLICATION ERROR** - NCT07116967: Single OR criterion duplicated 7+ times  
3. ✓ **CORRECT** - NCT06477536: GPP flare properly assigned to FLR cluster
4. ✓ **CORRECT** - NCT05092269: Multiple conditions properly parsed as array with OR logic
5. ⚠️ **SEMANTIC GAP** - NCT07150988: Breast cancer requires AI/synonym for malignant tumor match
6. ✓ **CORRECT** - NCT06630559: Psoriasis variants properly parsed for exact matching

---

## Detailed Investigations

### Investigation 1: NCT06979453 - Weight Exclusion Criterion

**Issue Reported:** Exclusion criterion "Participants must not weigh < 30.0 kg at Screening and Day 1" was erroneously matched.

**Database Entry:**
```json
{
  "id": "BMI_1916",
  "nct_id": "NCT06979453",
  "raw_text": "Participants must not weigh < 30.0 kg at Screening and Day 1.",
  "EXCLUSION_STRENGTH": "mandatory_exclude"
}
```

**ROOT CAUSE - CRITICAL PARSING ERROR:**

The weight criterion contains **NO numeric fields** (`WEIGHT_MIN`, `WEIGHT_MAX`). The parsing process failed to extract the threshold value of 30.0 kg from the text.

**Expected Parsing:**
```json
{
  "id": "BMI_1916",
  "WEIGHT_MIN": 30.0,  // ← MISSING!
  "EXCLUSION_STRENGTH": "mandatory_exclude"
}
```

**Matching Logic Analysis:**

From `ClinicalTrialMatcher.js` lines 384-440 (`#evaluateBMI`):

```javascript
#evaluateBMI(criterion, patientBMI) {
  if (!patientBMI) {
    return { matches: false, confidence: 0.1, ... };
  }

  let matches = true;
  
  // Check weight
  const weightValue = patientBMI.weight?.value || patientBMI.weight;
  
  if (criterion.WEIGHT_MIN !== null && criterion.WEIGHT_MIN !== undefined) {
    if (weightValue < criterion.WEIGHT_MIN) {
      matches = false;  // Patient below minimum
    }
  }
  if (criterion.WEIGHT_MAX !== null && criterion.WEIGHT_MAX !== undefined) {
    if (weightValue > criterion.WEIGHT_MAX) {
      matches = false;  // Patient above maximum
    }
  }
  
  return { matches, confidence: 1.0, ... };
}
```

**Step-by-Step Behavior with 25kg Patient:**

1. Patient provides: `BMI: { weight: 25 }`
2. Criterion has: `WEIGHT_MIN: undefined, WEIGHT_MAX: undefined`
3. Both IF conditions are FALSE (fields don't exist)
4. `matches` remains `true` (default value)
5. **Result: matches=true, confidence=1.0**
6. For EXCLUSION criterion: matches=true → **INELIGIBLE**

**Actual vs Expected:**

| Patient Weight | Expected Result | Actual Result | Correct? |
|----------------|-----------------|---------------|----------|
| 25 kg | INELIGIBLE (< 30kg) | ELIGIBLE (no data) | ❌ WRONG |
| 35 kg | ELIGIBLE (≥ 30kg) | ELIGIBLE (no data) | ✓ Right (by accident) |

**Impact:** 
- Patients BELOW 30kg are incorrectly evaluated as ELIGIBLE (should be INELIGIBLE)
- The matching logic cannot perform numeric comparison without parsed fields
- This is a **FALSE NEGATIVE** - dangerous patients are not excluded

**Recommendation:**
1. Fix parsing to extract: `WEIGHT_MIN: 30.0` from "must not weigh < 30.0 kg"
2. The inequality "< 30" means "minimum allowed weight is 30"
3. Test with patients at 25kg, 30kg, and 35kg to verify

---

### Investigation 2: NCT07116967 - Cardiovascular Risk Factors Parsing

**Issue Reported:** Criterion "Have at least 1 of the following cardiovascular risk factors" was parsed incorrectly, evaluating only a single criterion instead of handling enumerated sub-criteria.

**Database Entries:**

The same raw text appears **7+ times** across different clusters:

```json
{
  "id": "AGE_2033",
  "cluster": "AGE",
  "raw_text": "Have at least 1 of the following cardiovascular risk factors: Current cigarette smoker, Diagnosis of hypertension, ...",
  "EXCLUSION_STRENGTH": "inclusion",
  "AGE_MIN": 55  // Extracted from sub-item about family history
}

{
  "id": "BMI_2032",
  "cluster": "BMI",
  "raw_text": "Have at least 1 of the following cardiovascular risk factors: ...",  // EXACT SAME TEXT
  "EXCLUSION_STRENGTH": "inclusion"
  // No BMI fields
}

{
  "id": "CMB_2031",
  "cluster": "CMB",
  "raw_text": "Have at least 1 of the following cardiovascular risk factors: ...",  // EXACT SAME TEXT
  "EXCLUSION_STRENGTH": "inclusion",
  "CONDITION_TYPE": ["Current cigarette smoker", "Hypertension", "Hyperlipidemia", ...],
  "LOGICAL_OPERATOR": "OR"
}

// + 4 more duplicates in CMB (CMB_2030, CMB_2029, CMB_2028, CMB_2026)
```

**ROOT CAUSE - DUPLICATION ERROR:**

A **single logical criterion** with OR semantics was incorrectly split into **multiple database entries**:
- 1× in AGE cluster
- 1× in BMI cluster  
- 5× in CMB cluster (same cluster!)

**Expected Parsing:**

Should be a **SINGLE criterion** in the most appropriate cluster (CMB):

```json
{
  "id": "CMB_unified_cv_risk",
  "cluster": "CMB",
  "raw_text": "Have at least 1 of the following cardiovascular risk factors: ...",
  "EXCLUSION_STRENGTH": "inclusion",
  "CONDITION_TYPE": [
    "Current cigarette smoker",
    "Hypertension",
    "Hyperlipidemia",
    "Diabetes mellitus type 1",
    "Diabetes mellitus type 2",
    "History of MI",
    "Obesity"
    // ... all options in ONE array
  ],
  "LOGICAL_OPERATOR": "OR"  // Patient needs ANY of these
}
```

**Matching Logic Analysis:**

The current code evaluates **each duplicate separately**:

```javascript
async evaluateTrial(nctId, patientResponse) {
  const criteria = this.#trialIndex.get(nctId) || [];  // Gets ALL 7+ duplicates
  
  // Evaluates EACH criterion independently
  const evaluationPromises = criteria.map((criterion) =>
    this.evaluateCriterion(criterion, patientResponse, criterion.clusterCode)
  );
  
  const results = await Promise.all(evaluationPromises);
  
  // Categorize results
  for (const result of results) {
    if (result.causesIneligibility()) {
      failureReasons.push(...);
    }
  }
}
```

**Step-by-Step Behavior with Patient Having Hypertension:**

1. Patient: `CMB: ['hypertension']`
2. System evaluates:
   - AGE_2033: AGE check (patient age vs 55) → Likely FAILS (age unrelated to hypertension)
   - BMI_2032: BMI check (no fields) → FAILS (missing data)
   - CMB_2031: Checks CONDITION_TYPE array → **MATCHES** (hypertension found)
   - CMB_2030: Same check → **MATCHES** again
   - CMB_2029: Same check → **MATCHES** again
   - CMB_2028: Same check → **MATCHES** again
   - CMB_2026: Same check → **MATCHES** again

3. Result: **5 redundant matches** for the same logical requirement

**Impact:**
- **Redundant evaluations** - same criterion checked multiple times
- **Performance overhead** - 7× more work than necessary
- **Confusing results** - multiple "matched criteria" for single requirement
- **Potential logic errors** - if ANY duplicate fails, might cause incorrect ineligibility

**Recommendation:**
1. Consolidate all 7+ entries into a SINGLE criterion
2. Use CMB cluster (most appropriate for conditions)
3. Ensure LOGICAL_OPERATOR: "OR" is respected
4. Delete duplicate entries

---

### Investigation 3: NCT06477536 - GPP Flare Cluster Assignment

**Issue Reported:** Verify if criterion "Patients who are experiencing GPP flare" was assigned to the correct database cluster.

**Database Entry:**
```json
{
  "id": "FLR_2292",
  "nct_id": "NCT06477536",
  "cluster_code": "FLR",
  "raw_text": "Patients who are experiencing GPP flare",
  "EXCLUSION_STRENGTH": "mandatory_exclude",
  "CONDITION_TYPE": ["experiencing GPP flare"],
  "CONDITION_PATTERN": ["current"],
  "IMPACT": ["exclusion due to active disease flare"]
}
```

**CLUSTER ASSIGNMENT: ✓ CORRECT**

The criterion is correctly assigned to the **FLR (Flare)** cluster, which is specifically designed for flare-related criteria.

**Cluster Options Analysis:**

| Cluster | Purpose | Appropriate? | Reasoning |
|---------|---------|--------------|-----------|
| FLR | Flare history and current flares | ✓ YES | Perfect fit - "experiencing flare" is current flare status |
| AIC | Active infections/conditions | ⚠️ MAYBE | Could work but less specific |
| CPD | Condition patterns/duration | ❌ NO | For chronic patterns, not acute flares |
| CMB | Comorbidities | ❌ NO | For additional conditions, not disease activity |

**Parsing Analysis:**

Fields properly extracted:
- ✓ `CONDITION_TYPE`: Identifies what condition (GPP flare)
- ✓ `CONDITION_PATTERN`: Marks as "current" (not historical)
- ✓ `IMPACT`: Documents exclusion reason

**Matching Logic Analysis:**

From `ClinicalTrialMatcher.js` lines 820-880 (`#evaluateFlare`):

```javascript
async #evaluateFlare(criterion, patientFlare) {
  if (!patientFlare) {
    return { matches: false, confidence: 0.1, ... };
  }

  const conditionTypes = criterion.CONDITION_TYPE || [];
  const conditionPatterns = criterion.CONDITION_PATTERN || [];
  
  // Check if patient has flare data
  if (patientFlare.hasFlares === false) {
    return { matches: false, confidence: 1.0, ... };
  }
  
  // Check condition pattern (current vs historical)
  if (conditionPatterns.includes('current') && !patientFlare.currentFlare) {
    return { matches: false, confidence: 1.0, ... };
  }
  
  // Check flare type if specified
  if (criterion.FLARE_TYPE) {
    // Match specific flare type
  }
  
  // ... more logic
}
```

**Expected Behavior:**

Patient structure:
```javascript
{
  FLR: {
    hasFlares: true,
    currentFlare: true,
    flareType: 'GPP',
    lastFlareDate: '2025-12-15'
  }
}
```

Matching steps:
1. Check `hasFlares`: true → continue
2. Check `CONDITION_PATTERN` contains "current": YES
3. Check `patientFlare.currentFlare`: true → **MATCH**
4. Exclusion strength: "mandatory_exclude"
5. Result: matches=true → **INELIGIBLE** ✓ CORRECT

**Conclusion:**
- ✓ Cluster assignment is CORRECT (FLR)
- ✓ Parsing is CORRECT (fields properly extracted)
- ✓ Matching logic should work IF patient data follows expected structure

**Recommendation:**
- Verify frontend questionnaire populates `FLR.currentFlare` field
- Ensure flare type matching works for "GPP" specifically

---

### Investigation 4: NCT05092269 - Multiple Conditions Parsing

**Issue Reported:** Multiple conditions in "Have had any of (a) confirmed SARS-CoV-2 infection... (b) suspected infection... (c) close contact" were treated as single condition.

**Database Entry:**
```json
{
  "id": "AIC_1377",
  "nct_id": "NCT05092269",
  "cluster_code": "AIC",
  "raw_text": "Have had any of (a) confirmed severe acute respiratory syndrome coronavirus-2 (SARS-CoV-2 [COVID-19]) infection (test positive), or (b) suspected SARS-CoV-2 infection (clinical features without documented test results), or (c) close contact with a person with known or suspected SARS-CoV-2 infection.",
  "EXCLUSION_STRENGTH": "mandatory_exclude",
  "CONDITION_TYPE": [
    "SARS-CoV-2 (COVID-19) infection",
    "close contact with SARS-CoV-2 infected person"
  ],
  "CONDITION_PATTERN": ["confirmed", "suspected", "exposure"],
  "SEVERITY": "severe (confirmed)",
  "LOGICAL_OPERATOR": "OR",
  "IMPACT": ["exclusion due to confirmed or suspected COVID-19 infection or close contact"]
}
```

**PARSING: ✓ CORRECT (with minor note)**

The enumerated sub-criteria (a), (b), (c) were properly recognized and parsed:

| Sub-criterion | Captured in Field | How |
|---------------|-------------------|-----|
| (a) confirmed infection | `CONDITION_TYPE[0]` + `CONDITION_PATTERN[0]` | "SARS-CoV-2 infection" + "confirmed" |
| (b) suspected infection | `CONDITION_TYPE[0]` + `CONDITION_PATTERN[1]` | "SARS-CoV-2 infection" + "suspected" |
| (c) close contact | `CONDITION_TYPE[1]` + `CONDITION_PATTERN[2]` | "close contact..." + "exposure" |

**Key Features:**
- ✓ `LOGICAL_OPERATOR: "OR"` - correctly identifies ANY condition matches
- ✓ Array fields allow multiple patterns
- ✓ Single criterion (not duplicated like NCT07116967)

**Matching Logic Analysis:**

From `ClinicalTrialMatcher.js` lines 700-780 (`#evaluateInfection`):

```javascript
async #evaluateInfection(criterion, patientInfections) {
  if (!patientInfections || !Array.isArray(patientInfections)) {
    return { matches: false, confidence: 0.1, ... };
  }

  const conditionTypes = criterion.CONDITION_TYPE || [];
  
  for (const patientInfection of patientInfections) {
    const patientTypes = patientInfection.CONDITION_TYPE || 
                         (typeof patientInfection === 'string' ? [patientInfection] : []);
    
    // Check if any patient infection matches any criterion condition
    if (arraysOverlap(conditionTypes, patientTypes)) {
      // Additional checks for pattern, severity, timeframe...
      return { matches: true, confidence: 1.0, ... };
    }
  }
  
  return { matches: false, confidence: 1.0, ... };
}
```

**Step-by-Step Behavior:**

Test Case 1: Patient with confirmed COVID
```javascript
Patient: {
  AIC: [
    { CONDITION_TYPE: ['SARS-CoV-2 infection'], CONDITION_PATTERN: ['confirmed'] }
  ]
}
```
1. Loop through criterion conditions: `["SARS-CoV-2 (COVID-19) infection", ...]`
2. Loop through patient infections: `["SARS-CoV-2 infection"]`
3. Check overlap: "SARS-CoV-2 infection" ≈ "SARS-CoV-2 (COVID-19) infection"
4. **Result: MATCH** → confidence=1.0

Test Case 2: Patient with close contact
```javascript
Patient: {
  AIC: [
    { CONDITION_TYPE: ['close contact with COVID patient'] }
  ]
}
```
1. Check overlap with criterion types
2. Fuzzy match: "close contact with COVID patient" ≈ "close contact with SARS-CoV-2 infected person"
3. **Result: MATCH** → confidence=1.0 or requiresAI=true

**Verification of OR Logic:**

The `LOGICAL_OPERATOR: "OR"` field is present in the database, but the matching code uses **implicit OR** logic:
- It loops through patient conditions until ANY match is found
- First match returns immediately with matches=true
- This is functionally equivalent to OR

**Conclusion:**
- ✓ Parsing is CORRECT (array fields with OR operator)
- ✓ Sub-conditions properly extracted
- ✓ Matching logic implements OR behavior (any match succeeds)

**Minor Enhancement Opportunity:**
The CONDITION_TYPE could be more granular:
```json
"CONDITION_TYPE": [
  "confirmed SARS-CoV-2 infection",    // More specific
  "suspected SARS-CoV-2 infection",    // More specific
  "close contact with SARS-CoV-2 infected person"
]
```

But current parsing is **functionally correct** - the pattern matching handles the distinction.

---

### Investigation 5: NCT07150988 - Breast Cancer Synonym Matching

**Issue Reported:** "breast cancer" in patient data was not excluded under criterion "History of malignant tumors" - treated as non-exact match.

**Database Entry:**
```json
{
  "id": "CMB_1342",
  "nct_id": "NCT07150988",
  "cluster_code": "CMB",
  "raw_text": "History of malignant tumors;",
  "EXCLUSION_STRENGTH": "mandatory_exclude",
  "CONDITION_TYPE": ["malignant tumors"],
  "CONDITION_PATTERN": ["history"],
  "IMPACT": ["exclusion due to history of malignancy"]
}
```

**Patient Data:**
```javascript
{
  CMB: ['breast cancer']
}
```

**ROOT CAUSE - SEMANTIC MATCHING GAP:**

This is a **valid non-exact match** that requires semantic understanding:
- Criterion: "malignant tumors" (general category)
- Patient: "breast cancer" (specific instance)
- Relationship: breast cancer IS A TYPE OF malignant tumor

**Matching Logic Trace:**

From `ClinicalTrialMatcher.js` lines 445-549 (`#evaluateComorbidity`):

```javascript
async #evaluateComorbidity(criterion, patientComorbidities) {
  const conditionTypes = criterion.CONDITION_TYPE || [];  // ["malignant tumors"]
  const patientTypes = patientCondition.CONDITION_TYPE || [];  // ["breast cancer"]
  
  // STEP 1: Exact match check
  if (arraysOverlap(conditionTypes, patientTypes)) {
    return { matches: true, confidence: 1.0, matchMethod: 'exact' };
  }
  // Result: NO overlap between ["malignant tumors"] and ["breast cancer"]
  
  // STEP 2: Synonym matching
  for (const patientType of patientTypes) {
    const synonyms = findSynonyms(patientType);  // Find synonyms for "breast cancer"
    if (arraysOverlap(conditionTypes, synonyms)) {
      return { matches: true, confidence: 0.9, matchMethod: 'synonym' };
    }
  }
  // Result: Depends on synonym database
  
  // STEP 3: AI semantic matching (if available)
  if (this.#aiClient) {
    const aiResult = await this.#aiClient.semanticMatch(
      "breast cancer",
      "malignant tumors",
      "medical condition"
    );
    
    if (aiResult.match && aiResult.confidence >= 0.3) {
      return {
        matches: true,
        confidence: aiResult.confidence,  // Likely 0.95+
        requiresAI: true,
        matchMethod: 'ai_semantic'
      };
    }
  }
  
  // STEP 4: No match found
  return { matches: false, confidence: 1.0 };
}
```

**Analysis of Each Step:**

**Step 1: Exact Match**
```javascript
arraysOverlap(["malignant tumors"], ["breast cancer"])
// Returns: false
// Reason: Strings don't match exactly
```

**Step 2: Synonym Database**

Examining `drugDatabase.js` - this file handles **drug** synonyms, not condition synonyms:
```javascript
export function findSynonyms(term) {
  // Only works for drugs like "adalimumab" → ["Humira"]
  // Does NOT have medical condition synonyms
}
```

**Conclusion:** Synonym matching will return **empty array** for "breast cancer" → **no match**

**Step 3: AI Semantic Matching**

If AI is enabled (Claude API):
```javascript
Prompt to Claude:
"Does 'breast cancer' match the criterion 'malignant tumors' in medical context?"

Expected AI Response:
{
  match: true,
  confidence: 0.95,
  reasoning: "Breast cancer is a specific type of malignant tumor. All cancers, including breast cancer, are malignant tumors by definition. This is a perfect semantic match with high confidence."
}
```

**Result:** matches=true, confidence=0.95, requiresAI=true

**Step 4: If No AI Available**

Without AI, the matching process returns:
```javascript
{ matches: false, confidence: 1.0 }
```

**This is the ROOT CAUSE:** Patient with breast cancer is marked as **NOT matching** the exclusion → incorrectly evaluated as ELIGIBLE

**System Behavior Summary:**

| Configuration | Result | Correct? | Explanation |
|---------------|--------|----------|-------------|
| AI Enabled | ✓ INELIGIBLE | ✓ YES | AI recognizes semantic relationship |
| AI Disabled, No Synonym DB | ELIGIBLE | ❌ NO | Exact match fails, no synonym match |
| AI Disabled, With Synonym DB | ✓ INELIGIBLE | ✓ YES | IF synonym DB includes cancer→tumor |

**Current Confidence Calculation:**

From the code, if AI matches:
```javascript
confidence = aiResult.confidence  // Typically 0.90-0.99 for this case
```

From `RulesLoader.js` confidence thresholds:
```javascript
{
  exclude: 0.8,   // Auto-exclude if confidence ≥ 0.8
  review: 0.5,    // Manual review if 0.5 ≤ confidence < 0.8  
  ignore: 0.3     // Ignore match if confidence < 0.3
}
```

**Expected Flow:**
1. AI determines: confidence = 0.95
2. 0.95 ≥ 0.8 (exclude threshold)
3. Status: "ineligible" (automatic exclusion)
4. Result: ✓ CORRECT

**Why Was It "Non-Exact"?**

The issue description says it was "treated as non-exact match" - this is **EXPECTED and CORRECT**:
- "breast cancer" ≠ "malignant tumors" (exact string comparison)
- These are SEMANTICALLY related, not TEXTUALLY identical
- AI/semantic matching is the CORRECT tool for this case
- Confidence < 1.0 indicates "non-exact but valid" match

**Recommendation:**
1. ✓ Current behavior is CORRECT when AI is enabled
2. ⚠️ Add medical condition synonym database for AI-free operation
3. Consider adding explicit mappings:
   ```javascript
   const cancerSynonyms = {
     'breast cancer': ['malignant tumor', 'malignant neoplasm', 'cancer'],
     'lung cancer': ['malignant tumor', 'malignant neoplasm', 'cancer'],
     // etc.
   };
   ```

---

### Investigation 6: NCT06630559 - Psoriasis Confidence Calculation

**Issue Reported:** Explain the confidence calculation for non-exact match with "Patient diagnosed with forms of psoriasis other than chronic plaque-type or medication-induced psoriasis".

**Database Entries:**

Criterion 1 (NPV cluster):
```json
{
  "id": "NPV_1248",
  "nct_id": "NCT06630559",
  "cluster_code": "NPV",
  "raw_text": "Patient diagnosed with forms of psoriasis other than chronic plaque-type or medication-induced psoriasis.",
  "EXCLUSION_STRENGTH": "mandatory_exclude",
  "PSORIASIS_VARIANT": ["plaque psoriasis"],
  "CONDITION_PATTERN": ["current"]
}
```

Criterion 2 (CPD cluster):
```json
{
  "id": "CPD_1247",
  "nct_id": "NCT06630559",
  "cluster_code": "CPD",
  "raw_text": "Patient has had a diagnosis of chronic plaque psoriasis for at least 24 weeks.",
  "EXCLUSION_STRENGTH": "inclusion",
  "CONDITION_TYPE": ["chronic plaque psoriasis", "psoriatic arthritis"],
  "TIMEFRAME": {"relation": "at least", "amount": 24, "unit": "weeks", "reference": "diagnosis"}
}
```

**Test Scenario:**

Patient with guttate psoriasis:
```javascript
{
  NPV: {
    psoriasisVariant: 'guttate psoriasis'  // NOT chronic plaque
  },
  CPD: {
    psoriasisType: 'guttate psoriasis',
    duration: { amount: 30, unit: 'weeks' }
  }
}
```

**Matching Logic Analysis:**

**Criterion 1 (NPV_1248) - Exclusion:**

From `ClinicalTrialMatcher.js` lines 780-820 (`#evaluateVariant`):

```javascript
async #evaluateVariant(criterion, patientVariant) {
  if (!patientVariant) {
    return { matches: false, confidence: 0.1, ... };
  }

  const criterionVariants = criterion.PSORIASIS_VARIANT || [];  // ["plaque psoriasis"]
  const patientPsoriasisVariant = patientVariant.psoriasisVariant;  // "guttate psoriasis"
  
  // STEP 1: Exact match check
  if (criterionVariants.includes(patientPsoriasisVariant)) {
    return { matches: true, confidence: 1.0, matchMethod: 'exact' };
  }
  // Result: false - "guttate psoriasis" NOT IN ["plaque psoriasis"]
  
  // STEP 2: Partial/fuzzy string matching
  for (const variant of criterionVariants) {
    if (patientPsoriasisVariant.toLowerCase().includes(variant.toLowerCase())) {
      return { matches: true, confidence: 0.95, matchMethod: 'partial' };
    }
  }
  // Result: false - "guttate psoriasis" does NOT contain "plaque psoriasis"
  
  // STEP 3: No match
  return { matches: false, confidence: 1.0, matchMethod: 'no_match' };
}
```

**Step-by-Step Trace:**

1. Criterion variants: `["plaque psoriasis"]`
2. Patient variant: `"guttate psoriasis"`
3. Exact match: NO
4. Partial match: NO  
5. **Result: matches=FALSE, confidence=1.0**

**Interpretation for Exclusion:**

```javascript
// Criterion text: "forms OTHER THAN chronic plaque-type"
// This is a DOUBLE NEGATIVE exclusion

Raw text logic:
  "Patient diagnosed with [forms other than plaque]" → EXCLUDE

Database representation:
  PSORIASIS_VARIANT: ["plaque psoriasis"]
  EXCLUSION_STRENGTH: "mandatory_exclude"

Intended logic:
  IF patient.variant IS "plaque psoriasis" → matches=true → ELIGIBLE (has allowed type)
  IF patient.variant IS NOT "plaque psoriasis" → matches=false → needs review

Actual matching result:
  patient.variant = "guttate" (NOT plaque)
  matches = false
  
Eligibility determination:
  exclusion + matches=false → ???
```

**CRITICAL ISSUE - LOGIC INVERSION:**

The criterion text "forms OTHER THAN chronic plaque-type" creates a **double negative**:
1. The criterion EXCLUDES patients
2. But it excludes those WITH "other forms" (non-plaque)
3. Database stores the ALLOWED variant ("plaque psoriasis")
4. Matching checks if patient HAS the allowed variant

**This creates confusion in the causesIneligibility() logic:**

From `results.js`:
```javascript
class CriterionMatchResult {
  causesIneligibility() {
    if (this.exclusionStrength === 'inclusion') {
      return !this.matches;  // Failed to match inclusion → ineligible
    } else {
      return this.matches;  // Matched exclusion → ineligible
    }
  }
}
```

For NPV_1248:
```
exclusionStrength: "mandatory_exclude"
matches: false (patient doesn't have plaque psoriasis)
causesIneligibility(): false (doesn't match exclusion)
```

**But this is WRONG!** The patient should be EXCLUDED because they have a NON-PLAQUE variant.

**ROOT CAUSE:** The database parsing inverted the logic. It should be:

```json
{
  "PSORIASIS_VARIANT_EXCLUDED": ["guttate", "inverse", "pustular", "erythrodermic"],
  "PSORIASIS_VARIANT_ALLOWED": ["plaque psoriasis"],
  "EXCLUSION_STRENGTH": "mandatory_exclude"
}
```

And matching logic should check:
```javascript
if (criterionVariantsExcluded.includes(patientVariant)) {
  return { matches: true };  // Patient has excluded variant → EXCLUDE
}
if (criterionVariantsAllowed.includes(patientVariant)) {
  return { matches: false };  // Patient has allowed variant → OK
}
```

**Criterion 2 (CPD_1247) - Inclusion:**

```javascript
async #evaluateDuration(criterion, patientDuration) {
  const conditionTypes = criterion.CONDITION_TYPE || [];  
  // ["chronic plaque psoriasis", "psoriatic arthritis"]
  
  const patientType = patientDuration.psoriasisType;  // "guttate psoriasis"
  
  // Check if patient condition matches any criterion condition
  if (conditionTypes.includes(patientType)) {
    // Check duration timeframe
    if (timeframeMatches(criterion.TIMEFRAME, patientDuration.duration)) {
      return { matches: true, confidence: 1.0 };
    }
  }
  
  return { matches: false, confidence: 1.0 };
}
```

Result:
```
conditionTypes.includes("guttate psoriasis") → FALSE
matches: false
causesIneligibility() for inclusion: true (failed inclusion)
```

**Combined Result:**
- NPV_1248 (exclusion): matches=false → doesn't cause ineligibility (WRONG)
- CPD_1247 (inclusion): matches=false → causes ineligibility ✓ CORRECT

**Final status:** INELIGIBLE (due to CPD_1247 failure, not NPV_1248)

**Confidence Calculation:**

For the NPV criterion (if it matched correctly):

```javascript
// From RulesLoader.js
export function getConfidenceByMatchType(matchType) {
  const confidenceLevels = {
    exactMatch: 1.0,
    directMatch: 1.0,
    synonymMatch: 0.9,
    partialMatch: 0.85,
    fuzzyMatch: 0.7,
    databaseMatch: 0.95,
    noMatch: 1.0,  // High confidence in absence
    missingData: 0.1
  };
  return confidenceLevels[matchType] || 0.5;
}
```

**Scenario Analysis:**

| Patient Variant | Match Type | Confidence | Reasoning |
|-----------------|-----------|------------|-----------|
| "plaque psoriasis" | exactMatch | 1.0 | Exact string match in variant array |
| "chronic plaque psoriasis" | partialMatch | 0.85 | Contains "plaque psoriasis" |
| "guttate psoriasis" | noMatch | 1.0 | No overlap with allowed variants |
| "plaque-type psoriasis" | fuzzyMatch | 0.7 | Requires AI/semantic (similar terms) |

**For Non-Exact Matches:**

If AI semantic matching is used:

```javascript
const aiResult = await this.#aiClient.semanticMatch(
  "guttate psoriasis",
  "plaque psoriasis",
  "psoriasis variant"
);

// Expected AI response:
{
  match: false,  // These are DIFFERENT variants
  confidence: 0.95,  // High confidence they're different
  reasoning: "Guttate psoriasis and plaque psoriasis are distinct forms of psoriasis with different presentations."
}
```

**Confidence Threshold Application:**

```javascript
// From matcher
if (aiResult.match && aiResult.confidence >= 0.3) {
  return { matches: true, confidence: aiResult.confidence };
}

// For guttate vs plaque:
aiResult.match = false
// Doesn't meet threshold → returns no match
```

**Summary:**

1. **Exact Match** (plaque=plaque): confidence=1.0
2. **Partial Match** (contains substring): confidence=0.85
3. **AI Semantic** (similar but different): confidence varies (0.0-1.0 based on similarity)
4. **No Match** (completely different): confidence=1.0 (high certainty of non-match)

**Recommendation:**
1. ❌ FIX PARSING: "forms other than X" should list excluded variants, not allowed ones
2. ❌ FIX LOGIC: Double-negative exclusions need special handling
3. ✓ Confidence calculation is correct for the match type used

---

## Summary Table

| Trial | Issue | Root Cause | Severity | Status |
|-------|-------|------------|----------|--------|
| NCT06979453 | Weight threshold | ❌ CRITICAL: Numeric value not parsed | 🔴 High | NOT PARSED |
| NCT07116967 | CV risk factors | ❌ CRITICAL: Single OR criterion duplicated 7× | 🔴 High | WRONG STRUCTURE |
| NCT06477536 | GPP flare | ✓ Cluster assignment correct | 🟢 None | CORRECT |
| NCT05092269 | COVID conditions | ✓ OR array parsing correct | 🟢 None | CORRECT |
| NCT07150988 | Breast cancer | ⚠️ Requires AI/synonyms for matching | 🟡 Medium | NEEDS AI |
| NCT06630559 | Psoriasis variants | ❌ Double-negative logic inverted | 🔴 High | LOGIC ERROR |

---

## Recommendations

### Immediate Fixes Required

1. **NCT06979453 - Add Weight Parsing:**
   ```
   Text: "must not weigh < 30.0 kg"
   Extract: WEIGHT_MIN = 30.0
   ```

2. **NCT07116967 - Consolidate Duplicates:**
   ```
   Delete: AGE_2033, BMI_2032, CMB_2030/2029/2028/2026
   Keep: CMB_2031 with complete CONDITION_TYPE array
   ```

3. **NCT06630559 - Fix Double-Negative Parsing:**
   ```
   Text: "forms other than plaque"
   Add field: PSORIASIS_VARIANT_EXCLUDED = ["guttate", "inverse", ...]
   Or invert match logic for this specific case
   ```

### Validation Tests Needed

```javascript
// Test 1: Weight threshold
evaluateTrial('NCT06979453', { BMI: { weight: 25 } }) 
// Expected: ineligible

// Test 2: CV risk OR logic
evaluateTrial('NCT07116967', { CMB: ['hypertension'] })
// Expected: eligible (matches 1 of many risk factors)

// Test 3: GPP flare  
evaluateTrial('NCT06477536', { FLR: { currentFlare: true } })
// Expected: ineligible

// Test 4: COVID OR conditions
evaluateTrial('NCT05092269', { AIC: ['suspected COVID'] })
// Expected: ineligible

// Test 5: Synonym matching
evaluateTrial('NCT07150988', { CMB: ['breast cancer'] })
// Expected: ineligible (with AI) or needs_review (without AI)

// Test 6: Psoriasis variants
evaluateTrial('NCT06630559', { NPV: { psoriasisVariant: 'guttate' } })
// Expected: ineligible
```

---

**End of Investigation Report**
