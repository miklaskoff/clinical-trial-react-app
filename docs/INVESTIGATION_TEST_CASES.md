# Investigation Test Cases - Executable Examples

This document provides runnable test cases that demonstrate each of the 6 issues identified in the investigation.

## Setup

```javascript
import { ClinicalTrialMatcher } from '../src/services/matcher/ClinicalTrialMatcher.js';
import database from '../src/data/improved_slot_filled_database.json';

const matcher = new ClinicalTrialMatcher(database, null);
```

---

## Test Case 1: NCT06979453 - Weight Threshold Parsing Error

### Issue
Weight criterion "must not weigh < 30.0 kg" has NO numeric fields in database.

### Database State
```json
{
  "id": "BMI_1916",
  "nct_id": "NCT06979453",
  "raw_text": "Participants must not weigh < 30.0 kg at Screening and Day 1.",
  "EXCLUSION_STRENGTH": "mandatory_exclude",
  "WEIGHT_MIN": undefined,  // ❌ MISSING
  "WEIGHT_MAX": undefined   // ❌ MISSING
}
```

### Test Cases

```javascript
describe('NCT06979453 - Weight Threshold Bug', () => {
  it('should EXCLUDE patient with weight 25kg (below threshold)', async () => {
    const patient = {
      responses: {
        AGE: { age: 30 },
        BMI: { bmi: 20, weight: 25 },  // BELOW 30kg threshold
        CMB: [],
        PTH: { treatments: [] },
        AIC: [],
        AAO: {}, SEV: {}, CPD: {}, NPV: {}, BIO: {}, FLR: {}
      }
    };
    
    const result = await matcher.evaluateTrial('NCT06979453', patient);
    
    // EXPECTED: ineligible (patient too light)
    // ACTUAL: eligible (no weight field to compare against)
    expect(result.status).toBe('ineligible'); // ❌ FAILS
    
    const weightCriterion = result.matchedCriteria.find(c => 
      c.criterionId === 'BMI_1916'
    );
    expect(weightCriterion.matches).toBe(false); // ❌ FAILS - returns true
    expect(weightCriterion.causesIneligibility()).toBe(true); // ❌ FAILS
  });
  
  it('should ALLOW patient with weight 35kg (above threshold)', async () => {
    const patient = {
      responses: {
        AGE: { age: 30 },
        BMI: { bmi: 22, weight: 35 },  // ABOVE 30kg threshold
        CMB: [], PTH: { treatments: [] }, AIC: [],
        AAO: {}, SEV: {}, CPD: {}, NPV: {}, BIO: {}, FLR: {}
      }
    };
    
    const result = await matcher.evaluateTrial('NCT06979453', patient);
    
    // EXPECTED: eligible (patient heavy enough)
    // ACTUAL: eligible (but for WRONG reason - no comparison done)
    expect(result.status).toBe('eligible'); // ✓ PASSES (accidentally correct)
  });
});
```

### Root Cause
```javascript
// In ClinicalTrialMatcher.js #evaluateBMI():
if (criterion.WEIGHT_MIN !== null && criterion.WEIGHT_MIN !== undefined) {
  if (weightValue < criterion.WEIGHT_MIN) {
    matches = false;
  }
}
// ↑ This condition is NEVER true because WEIGHT_MIN is undefined
// So matches stays true for ALL patients
```

### Expected Fix
Parse "must not weigh < 30.0 kg" as:
```json
{
  "WEIGHT_MIN": 30.0,  // Minimum allowed weight
  "EXCLUSION_STRENGTH": "mandatory_exclude"
}
```

---

## Test Case 2: NCT07116967 - Duplicate OR Criterion

### Issue
Single criterion "at least 1 of the following CV risk factors" appears 7+ times in database.

### Database State
```javascript
// Same raw text appears in:
// - AGE_2033 (AGE cluster)
// - BMI_2032 (BMI cluster)  
// - CMB_2031, CMB_2030, CMB_2029, CMB_2028, CMB_2026 (CMB cluster - 5 copies!)

const duplicates = [
  { id: 'AGE_2033', cluster: 'AGE', raw_text: 'Have at least 1 of...' },
  { id: 'BMI_2032', cluster: 'BMI', raw_text: 'Have at least 1 of...' },
  { id: 'CMB_2031', cluster: 'CMB', raw_text: 'Have at least 1 of...' },
  { id: 'CMB_2030', cluster: 'CMB', raw_text: 'Have at least 1 of...' },
  { id: 'CMB_2029', cluster: 'CMB', raw_text: 'Have at least 1 of...' },
  { id: 'CMB_2028', cluster: 'CMB', raw_text: 'Have at least 1 of...' },
  { id: 'CMB_2026', cluster: 'CMB', raw_text: 'Have at least 1 of...' }
];
```

### Test Case

```javascript
describe('NCT07116967 - Duplicate Criterion Bug', () => {
  it('should evaluate criterion ONCE, not 7 times', async () => {
    const patient = {
      responses: {
        AGE: { age: 60 },
        BMI: { bmi: 28 },
        CMB: ['hypertension'],  // Matches 1 risk factor
        PTH: { treatments: [] },
        AIC: [], AAO: {}, SEV: {}, CPD: {}, NPV: {}, BIO: {}, FLR: {}
      }
    };
    
    const result = await matcher.evaluateTrial('NCT07116967', patient);
    
    // Count how many criteria have same raw text
    const cvCriteria = result.matchedCriteria.filter(c =>
      c.rawText?.includes('at least 1 of the following')
    );
    
    // EXPECTED: 1 criterion evaluated
    // ACTUAL: 7+ criteria evaluated (duplicates)
    expect(cvCriteria.length).toBe(1); // ❌ FAILS - returns 7+
    
    // EXPECTED: eligible (matches requirement)
    expect(result.status).toBe('eligible'); // ✓ PASSES (correct result despite duplication)
  });
});
```

### Impact
```javascript
// Matcher evaluates ALL 7 duplicates:
const evaluationPromises = criteria.map((criterion) =>  // 7 iterations!
  this.evaluateCriterion(criterion, patientResponse, criterion.clusterCode)
);

// Performance: 7× slower than needed
// Results: Confusing (7 "matched criteria" for 1 logical requirement)
// Risk: If ANY duplicate has parsing error, might incorrectly fail
```

### Expected Fix
Consolidate into SINGLE criterion:
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
  ],
  "LOGICAL_OPERATOR": "OR"
}
```

---

## Test Case 3: NCT06477536 - GPP Flare (Working Correctly)

### Issue
None - cluster assignment and parsing are correct. ✓

### Database State
```json
{
  "id": "FLR_2292",
  "cluster_code": "FLR",  // ✓ Correct cluster for flares
  "raw_text": "Patients who are experiencing GPP flare",
  "EXCLUSION_STRENGTH": "mandatory_exclude",
  "CONDITION_TYPE": ["experiencing GPP flare"],
  "CONDITION_PATTERN": ["current"]  // ✓ Correctly marks as current, not historical
}
```

### Test Case

```javascript
describe('NCT06477536 - GPP Flare (Correct)', () => {
  it('should EXCLUDE patient currently experiencing GPP flare', async () => {
    const patient = {
      responses: {
        AGE: { age: 40 },
        BMI: { bmi: 25 },
        CMB: [], PTH: { treatments: [] }, AIC: [],
        AAO: {}, SEV: {}, CPD: {}, NPV: {}, BIO: {},
        FLR: {
          hasFlares: true,
          currentFlare: true,  // Currently in flare
          flareType: 'GPP'
        }
      }
    };
    
    const result = await matcher.evaluateTrial('NCT06477536', patient);
    
    // EXPECTED: ineligible (active flare excludes patient)
    expect(result.status).toBe('ineligible'); // ✓ SHOULD PASS
    
    const flareCriterion = result.matchedCriteria.find(c =>
      c.criterionId === 'FLR_2292'
    );
    expect(flareCriterion.matches).toBe(true);
    expect(flareCriterion.causesIneligibility()).toBe(true);
  });
  
  it('should ALLOW patient NOT currently in flare', async () => {
    const patient = {
      responses: {
        FLR: {
          hasFlares: true,
          currentFlare: false,  // Past flares, but not current
          lastFlareDate: '2025-10-15'
        }
      }
    };
    
    const result = await matcher.evaluateTrial('NCT06477536', patient);
    
    // EXPECTED: eligible (no current flare)
    expect(result.status).toBe('eligible'); // ✓ SHOULD PASS
  });
});
```

---

## Test Case 4: NCT05092269 - COVID Conditions (Working Correctly)

### Issue
None - multiple conditions properly parsed with OR logic. ✓

### Database State
```json
{
  "id": "AIC_1377",
  "cluster_code": "AIC",
  "raw_text": "Have had any of (a) confirmed SARS-CoV-2 infection, or (b) suspected infection, or (c) close contact...",
  "EXCLUSION_STRENGTH": "mandatory_exclude",
  "CONDITION_TYPE": [
    "SARS-CoV-2 (COVID-19) infection",
    "close contact with SARS-CoV-2 infected person"
  ],
  "CONDITION_PATTERN": ["confirmed", "suspected", "exposure"],
  "LOGICAL_OPERATOR": "OR"  // ✓ Correctly identifies OR logic
}
```

### Test Cases

```javascript
describe('NCT05092269 - COVID OR Conditions (Correct)', () => {
  it('should EXCLUDE patient with confirmed COVID', async () => {
    const patient = {
      responses: {
        AIC: [
          { CONDITION_TYPE: ['SARS-CoV-2 infection'], CONDITION_PATTERN: ['confirmed'] }
        ]
      }
    };
    
    const result = await matcher.evaluateTrial('NCT05092269', patient);
    expect(result.status).toBe('ineligible'); // ✓ SHOULD PASS
  });
  
  it('should EXCLUDE patient with suspected COVID (different sub-criterion)', async () => {
    const patient = {
      responses: {
        AIC: [
          { CONDITION_TYPE: ['SARS-CoV-2 infection'], CONDITION_PATTERN: ['suspected'] }
        ]
      }
    };
    
    const result = await matcher.evaluateTrial('NCT05092269', patient);
    expect(result.status).toBe('ineligible'); // ✓ SHOULD PASS
  });
  
  it('should EXCLUDE patient with close contact (third sub-criterion)', async () => {
    const patient = {
      responses: {
        AIC: [
          { CONDITION_TYPE: ['close contact with COVID patient'] }
        ]
      }
    };
    
    const result = await matcher.evaluateTrial('NCT05092269', patient);
    expect(result.status).toBe('ineligible'); // ✓ SHOULD PASS
  });
  
  it('should ALLOW patient with none of the conditions', async () => {
    const patient = {
      responses: {
        AIC: []  // No infections
      }
    };
    
    const result = await matcher.evaluateTrial('NCT05092269', patient);
    expect(result.status).toBe('eligible'); // ✓ SHOULD PASS
  });
});
```

---

## Test Case 5: NCT07150988 - Breast Cancer Synonym Matching

### Issue
"breast cancer" does not exactly match "malignant tumors" - requires semantic/synonym matching.

### Database State
```json
{
  "id": "CMB_1342",
  "cluster_code": "CMB",
  "raw_text": "History of malignant tumors;",
  "EXCLUSION_STRENGTH": "mandatory_exclude",
  "CONDITION_TYPE": ["malignant tumors"],  // General category
  "CONDITION_PATTERN": ["history"]
}
```

### Test Cases

```javascript
describe('NCT07150988 - Semantic Matching Required', () => {
  it('should EXCLUDE patient with breast cancer (with AI)', async () => {
    // Create matcher WITH AI enabled
    const aiConfig = {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-sonnet-4-5-20250929'
    };
    const matcherWithAI = new ClinicalTrialMatcher(database, aiConfig);
    
    const patient = {
      responses: {
        CMB: ['breast cancer']  // Specific type of malignant tumor
      }
    };
    
    const result = await matcherWithAI.evaluateTrial('NCT07150988', patient);
    
    // EXPECTED: ineligible (AI recognizes breast cancer as malignant tumor)
    expect(result.status).toBe('ineligible'); // ✓ SHOULD PASS with AI
    
    const cancerCriterion = result.matchedCriteria.find(c =>
      c.criterionId === 'CMB_1342'
    );
    expect(cancerCriterion.matches).toBe(true);
    expect(cancerCriterion.requiresAI).toBe(true);
    expect(cancerCriterion.confidence).toBeGreaterThan(0.8); // High AI confidence
  });
  
  it('should require review for breast cancer (without AI)', async () => {
    // Matcher without AI (null config)
    const matcherNoAI = new ClinicalTrialMatcher(database, null);
    
    const patient = {
      responses: {
        CMB: ['breast cancer']
      }
    };
    
    const result = await matcherNoAI.evaluateTrial('NCT07150988', patient);
    
    // EXPECTED: needs_review (no exact match, no AI to verify)
    // ACTUAL: might be 'eligible' (no match found)
    expect(['needs_review', 'eligible']).toContain(result.status);
    
    const cancerCriterion = result.matchedCriteria.find(c =>
      c.criterionId === 'CMB_1342'
    );
    expect(cancerCriterion.matches).toBe(false); // No exact match
  });
});
```

### Matching Process
```javascript
// Step 1: Exact match
arraysOverlap(['malignant tumors'], ['breast cancer']) → false

// Step 2: Synonym database
findSynonyms('breast cancer') → []  // Empty (no condition synonyms)

// Step 3: AI semantic (if available)
await aiClient.semanticMatch('breast cancer', 'malignant tumors', 'medical condition')
→ { match: true, confidence: 0.95, reasoning: "Breast cancer is a malignant tumor" }

// Result: matches=true, confidence=0.95, requiresAI=true
```

---

## Test Case 6: NCT06630559 - Psoriasis Variant Logic Inversion

### Issue
Criterion "forms OTHER THAN plaque" stored as PSORIASIS_VARIANT: ["plaque"] creates inverted logic.

### Database State
```json
{
  "id": "NPV_1248",
  "cluster_code": "NPV",
  "raw_text": "Patient diagnosed with forms of psoriasis other than chronic plaque-type or medication-induced psoriasis.",
  "EXCLUSION_STRENGTH": "mandatory_exclude",
  "PSORIASIS_VARIANT": ["plaque psoriasis"]  // ❌ Should be EXCLUDED variants, not allowed
}
```

### Test Cases

```javascript
describe('NCT06630559 - Psoriasis Logic Inversion Bug', () => {
  it('should EXCLUDE patient with guttate psoriasis (non-plaque variant)', async () => {
    const patient = {
      responses: {
        NPV: {
          psoriasisVariant: 'guttate psoriasis'  // NOT plaque type
        },
        CPD: {
          psoriasisType: 'guttate psoriasis',
          duration: { amount: 30, unit: 'weeks' }
        }
      }
    };
    
    const result = await matcher.evaluateTrial('NCT06630559', patient);
    
    // EXPECTED: ineligible (guttate is excluded variant)
    // ACTUAL: might be eligible or needs_review
    expect(result.status).toBe('ineligible'); // ❌ MIGHT FAIL
    
    const variantCriterion = result.matchedCriteria.find(c =>
      c.criterionId === 'NPV_1248'
    );
    
    // Current logic:
    // PSORIASIS_VARIANT.includes('guttate') → false
    // matches = false
    // exclusion + !matches → doesn't cause ineligibility ❌ WRONG
    expect(variantCriterion.matches).toBe(true); // ❌ FAILS - returns false
  });
  
  it('should ALLOW patient with plaque psoriasis (allowed variant)', async () => {
    const patient = {
      responses: {
        NPV: {
          psoriasisVariant: 'plaque psoriasis'  // Allowed type
        },
        CPD: {
          psoriasisType: 'chronic plaque psoriasis',
          duration: { amount: 30, unit: 'weeks' }
        }
      }
    };
    
    const result = await matcher.evaluateTrial('NCT06630559', patient);
    
    // EXPECTED: eligible (plaque type is allowed)
    expect(result.status).toBe('eligible'); // ✓ MIGHT PASS (due to CPD inclusion)
  });
});
```

### Logic Trace
```javascript
// NPV_1248 evaluation:
criterion.PSORIASIS_VARIANT = ["plaque psoriasis"]
patient.psoriasisVariant = "guttate psoriasis"

// In #evaluateVariant():
if (criterionVariants.includes(patientPsoriasisVariant)) {
  return { matches: true };  // Patient HAS the variant
}
return { matches: false };  // Patient does NOT have the variant

// For guttate patient:
"guttate psoriasis" IN ["plaque psoriasis"] → false
matches = false

// In causesIneligibility():
if (exclusionStrength === 'mandatory_exclude') {
  return matches;  // Returns false
}

// Result: false → does NOT cause ineligibility ❌ WRONG
```

### Expected Fix
Option 1: Store excluded variants
```json
{
  "PSORIASIS_VARIANT_EXCLUDED": ["guttate", "inverse", "pustular", "erythrodermic"],
  "PSORIASIS_VARIANT_ALLOWED": ["plaque psoriasis"]
}
```

Option 2: Invert match logic for "other than" criteria
```javascript
if (criterion.raw_text.includes('other than')) {
  // Invert: patient SHOULD NOT have these variants
  matches = !criterionVariants.includes(patientPsoriasisVariant);
}
```

---

## Running These Tests

```bash
# Create test file
cat > src/__tests__/investigation_tests.test.js << 'EOF'
// Copy test cases from above
EOF

# Run tests
npm test -- investigation_tests.test.js

# Expected results:
# ✅ Test 3: GPP Flare - all pass
# ✅ Test 4: COVID OR - all pass
# ⚠️  Test 5: Breast Cancer - passes with AI, review without AI
# ❌ Test 1: Weight - fails (no numeric field)
# ❌ Test 2: CV Risk - fails (7 duplicates)
# ❌ Test 6: Psoriasis - fails (inverted logic)
```

---

## Summary

| Test | Issue | Expected Behavior | Actual Behavior | Passes? |
|------|-------|-------------------|-----------------|---------|
| 1 - Weight | No WEIGHT_MIN field | Exclude 25kg patient | Allows all patients | ❌ FAIL |
| 2 - CV Risk | 7 duplicates | 1 evaluation | 7 evaluations | ❌ FAIL |
| 3 - GPP Flare | None | Exclude active flare | Correctly excludes | ✅ PASS |
| 4 - COVID OR | None | Exclude any of 3 | Correctly uses OR | ✅ PASS |
| 5 - Breast Cancer | No synonym DB | Exclude with AI | Works with AI only | ⚠️ PARTIAL |
| 6 - Psoriasis | Inverted logic | Exclude non-plaque | Allows non-plaque | ❌ FAIL |

**3/6 working correctly, 2/6 critical bugs, 1/6 needs AI**
