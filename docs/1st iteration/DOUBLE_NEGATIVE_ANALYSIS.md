# Double-Negative Criteria Analysis and Implementation Plan

## User Questions and Answers

### Question 1: Database vs Matcher Fix
**User:** "It is exclusion criteria as per raw criteria labeling so we have to do smth with double-negative interpretation with matcher NOT fix the database"

**Answer:** You are absolutely correct. The criterion `BMI_1916` should remain labeled as exclusion (per the original trial protocol), and we need to enhance the **matcher logic** to properly interpret double-negative phrasing.

### Question 2: Why Did AI NOT Handle This Case?
**User:** "What about AI matching, why did it NOT handle this case"

**Answer:** AI matching **did NOT and COULD NOT** handle this case because:

1. **BMI cluster has AI disabled** in `matching-rules.json`:
   ```json
   "BMI": {
     "aiEnabled": false,
     "description": "BMI and weight criteria"
   }
   ```

2. **The #evaluateBMI() function only uses rule-based logic:**
   - Line 384-440 in `ClinicalTrialMatcher.js`
   - No AI fallback calls
   - Only checks `WEIGHT_MIN`, `WEIGHT_MAX`, `BMI_MIN`, `BMI_MAX` fields
   - **Problem:** BMI_1916 has NONE of these fields!

3. **Current database entry for BMI_1916:**
   ```json
   {
     "id": "BMI_1916",
     "nct_id": "NCT06979453",
     "raw_text": "Participants must not weigh < 30.0 kg at Screening and Day 1.",
     "EXCLUSION_STRENGTH": "mandatory_exclude"
     // ❌ NO WEIGHT_MIN field
     // ❌ NO WEIGHT_MAX field
   }
   ```

4. **What actually happens:**
   - `#evaluateBMI()` checks for `criterion.WEIGHT_MIN` → **undefined**
   - `#evaluateBMI()` checks for `criterion.WEIGHT_MAX` → **undefined**
   - No requirements found, so `matches = true` by default (line 394)
   - Patient with 71kg matches the exclusion → **EXCLUDED** ❌

### Question 3: NCT04772079 - How Is This Handled?
**User:** "How exactly does this criteria is handled by the matcher: Participants weighing ≤ 18.0 kg..."

**Answer:** Let me trace the exact logic:

**Criterion in database:**
```json
{
  "nct_id": "NCT04772079",
  "raw_text": "Participants weighing ≤ 18.0 kg at screening for Cohort 2...",
  "EXCLUSION_STRENGTH": "mandatory_exclude"
  // ❌ Also missing WEIGHT_MIN/WEIGHT_MAX fields
}
```

**Current behavior:**
1. Matcher calls `#evaluateBMI(criterion, patientBMI)`
2. Patient has: `{ weight: 71kg, bmi: 24.57 }`
3. Checks `criterion.WEIGHT_MIN` → **undefined**
4. Checks `criterion.WEIGHT_MAX` → **undefined**  
5. `matches = true` (default, line 394)
6. Confidence: 100% (exact match)
7. Reason: "Exact numeric comparison. Required: N/A"
8. **Result:** Patient MATCHES exclusion → EXCLUDED ❌

**Why "Required: N/A"?**
- Line 438: `requirements.join(', ') || 'N/A'`
- No requirements found → displays "N/A"

**This is also WRONG** - a 71kg patient should NOT be excluded by "≤ 18kg" criterion!

---

## Root Cause Summary

All these issues stem from the **same problem:**

1. **Missing slot-filled fields** in database entries
2. **Double-negative phrasing** not parsed correctly
3. **No AI fallback** for BMI cluster
4. **Default matches=true** when no fields present

---

## Implementation Plan

### Phase 1: Enhance BMI Matcher with Double-Negative Handling

**Objective:** Make the matcher interpret raw_text for criteria missing slot-filled fields.

**Location:** `src/services/matcher/ClinicalTrialMatcher.js`, `#evaluateBMI()` function

**Implementation:**

```javascript
#evaluateBMI(criterion, patientBMI) {
  if (!patientBMI) {
    return { 
      matches: false, 
      confidence: getConfidenceByMatchType('missingData'),
      patientValue: 'BMI/weight not provided',
      confidenceReason: 'Missing patient BMI data'
    };
  }

  let matches = true;
  const patientValues = [];
  const requirements = [];
  let hasExplicitFields = false;

  // Check for explicit slot-filled fields
  const hasWeightFields = criterion.WEIGHT_MIN !== null && criterion.WEIGHT_MIN !== undefined ||
                          criterion.WEIGHT_MAX !== null && criterion.WEIGHT_MAX !== undefined;
  const hasBmiFields = criterion.BMI_MIN !== null && criterion.BMI_MIN !== undefined ||
                       criterion.BMI_MAX !== null && criterion.BMI_MAX !== undefined;

  // Existing logic for slot-filled fields
  if (patientBMI.bmi) {
    patientValues.push(`BMI: ${patientBMI.bmi}`);
  }
  if (criterion.BMI_MIN !== null && criterion.BMI_MIN !== undefined) {
    hasExplicitFields = true;
    requirements.push(`BMI ≥${criterion.BMI_MIN}`);
    if (patientBMI.bmi < criterion.BMI_MIN) {
      matches = false;
    }
  }
  if (criterion.BMI_MAX !== null && criterion.BMI_MAX !== undefined) {
    hasExplicitFields = true;
    requirements.push(`BMI ≤${criterion.BMI_MAX}`);
    if (patientBMI.bmi > criterion.BMI_MAX) {
      matches = false;
    }
  }

  const weightValue = patientBMI.weight?.value || patientBMI.weight;
  const weightUnit = patientBMI.weight?.unit || 'kg';
  if (weightValue) {
    patientValues.push(`Weight: ${weightValue}${weightUnit}`);
  }
  if (criterion.WEIGHT_MIN !== null && criterion.WEIGHT_MIN !== undefined) {
    hasExplicitFields = true;
    requirements.push(`Weight ≥${criterion.WEIGHT_MIN}kg`);
    if (weightValue < criterion.WEIGHT_MIN) {
      matches = false;
    }
  }
  if (criterion.WEIGHT_MAX !== null && criterion.WEIGHT_MAX !== undefined) {
    hasExplicitFields = true;
    requirements.push(`Weight ≤${criterion.WEIGHT_MAX}kg`);
    if (weightValue > criterion.WEIGHT_MAX) {
      matches = false;
    }
  }

  // NEW: Handle raw_text when no explicit fields present
  if (!hasExplicitFields && criterion.raw_text) {
    return this.#parseWeightFromRawText(criterion, patientBMI, patientValues);
  }

  return { 
    matches, 
    confidence: getConfidenceByMatchType('exactMatch'),
    patientValue: patientValues.join(', ') || 'No BMI/weight data',
    confidenceReason: `Exact numeric comparison. Required: ${requirements.join(', ') || 'N/A'}`
  };
}

/**
 * Parse weight/BMI requirements from raw_text for criteria without slot-filled fields
 * Handles double-negative phrasing like "must not weigh < X" or "weighing ≤ X"
 */
#parseWeightFromRawText(criterion, patientBMI, patientValues) {
  const rawText = criterion.raw_text.toLowerCase();
  const weightValue = patientBMI.weight?.value || patientBMI.weight;
  
  // Pattern 1: "must not weigh < X" (double negative = weight MUST BE >= X)
  // Pattern 2: "must not weigh less than X"
  const doubleNegativePattern1 = /must\s+not\s+weigh\s*[<≤]\s*([\d.]+)\s*kg/i;
  const doubleNegativePattern2 = /must\s+not\s+weigh\s+less\s+than\s*([\d.]+)\s*kg/i;
  
  // Pattern 3: "weighing ≤ X" (single condition = weight MUST BE <= X)
  // Pattern 4: "weighing < X"
  const lessThanPattern = /weighing\s*[≤<]\s*([\d.]+)\s*kg/i;
  
  // Pattern 5: "weighing ≥ X" or "weighing > X"
  const greaterThanPattern = /weighing\s*[≥>]\s*([\d.]+)\s*kg/i;
  
  let matches = false;
  let requirement = '';
  
  // Check double-negative patterns (inverted logic)
  let match = rawText.match(doubleNegativePattern1) || rawText.match(doubleNegativePattern2);
  if (match) {
    const threshold = parseFloat(match[1]);
    requirement = `Weight must be ≥ ${threshold}kg (from: "must not weigh < ${threshold}kg")`;
    matches = weightValue >= threshold;
    
    return {
      matches,
      confidence: getConfidenceByMatchType('exactMatch'),
      patientValue: patientValues.join(', '),
      confidenceReason: `Double-negative interpretation. ${requirement}`
    };
  }
  
  // Check less-than patterns
  match = rawText.match(lessThanPattern);
  if (match) {
    const threshold = parseFloat(match[1]);
    requirement = `Weight must be ≤ ${threshold}kg`;
    matches = weightValue <= threshold;
    
    return {
      matches,
      confidence: getConfidenceByMatchType('exactMatch'),
      patientValue: patientValues.join(', '),
      confidenceReason: `Parsed from raw text. ${requirement}`
    };
  }
  
  // Check greater-than patterns
  match = rawText.match(greaterThanPattern);
  if (match) {
    const threshold = parseFloat(match[1]);
    requirement = `Weight must be ≥ ${threshold}kg`;
    matches = weightValue >= threshold;
    
    return {
      matches,
      confidence: getConfidenceByMatchType('exactMatch'),
      patientValue: patientValues.join(', '),
      confidenceReason: `Parsed from raw text. ${requirement}`
    };
  }
  
  // Could not parse - flag for manual review or AI fallback
  return {
    matches: false,
    confidence: 0.5,
    requiresAI: true,
    patientValue: patientValues.join(', '),
    confidenceReason: `Could not parse weight requirement from: "${criterion.raw_text}". Manual review needed.`
  };
}
```

### Phase 2: Test Cases

**Test 1: BMI_1916 - Double Negative**
```javascript
const criterion = {
  id: "BMI_1916",
  raw_text: "Participants must not weigh < 30.0 kg at Screening and Day 1.",
  EXCLUSION_STRENGTH: "mandatory_exclude"
};
const patient = { weight: 71 };

// Expected:
// matches = true (71 >= 30, patient MEETS the requirement)
// Since EXCLUSION_STRENGTH = "mandatory_exclude" and matches = true
// → Patient MATCHES exclusion → Should be EXCLUDED
// 
// BUT WAIT! Double-negative means "must NOT weigh less than 30kg"
// = "must weigh 30kg or more" = INCLUSION criterion!
// 
// The matcher returns matches=true, but the criterion type is wrong!
```

**CRITICAL ISSUE DISCOVERED:** Even with parsing, we still have a problem!

The criterion says "must NOT weigh < 30kg" which is logically an **inclusion** criterion (minimum weight requirement), but it's labeled as `"mandatory_exclude"` in the database.

**The matcher will:**
1. Parse: "must not weigh < 30kg" → patient weight >= 30kg
2. Patient has 71kg → matches = true
3. EXCLUSION_STRENGTH = "mandatory_exclude"
4. **Result:** Patient EXCLUDED ❌ (because matches=true for an exclusion)

**This is STILL WRONG!**

---

## The Real Problem

The issue is **not just parsing** - it's a **logical contradiction** in the database:

- **Raw text semantics:** "must NOT weigh < 30kg" = inclusion (minimum requirement)
- **EXCLUSION_STRENGTH label:** "mandatory_exclude" = exclusion

These two are **contradictory**!

---

## Revised Implementation Plan

### Option A: Detect and Invert Double-Negative Exclusions

When we detect double-negative phrasing in an exclusion criterion, **invert the matching logic**:

```javascript
#parseWeightFromRawText(criterion, patientBMI, patientValues) {
  const rawText = criterion.raw_text.toLowerCase();
  const weightValue = patientBMI.weight?.value || patientBMI.weight;
  const isExclusion = criterion.EXCLUSION_STRENGTH !== 'inclusion';
  
  // Pattern: "must not weigh < X" (double negative)
  const doubleNegativePattern = /must\s+not\s+weigh\s*[<]\s*([\d.]+)\s*kg/i;
  
  let match = rawText.match(doubleNegativePattern);
  if (match) {
    const threshold = parseFloat(match[1]);
    
    // Double-negative in exclusion criterion creates logical inversion
    // "must NOT weigh < 30kg" as exclusion means:
    // - Literally: exclude if patient weight >= 30kg
    // - Semantically: this is actually a minimum weight INCLUSION criterion
    
    if (isExclusion) {
      // INVERT: Patient should be excluded if they DON'T meet the requirement
      const meetsRequirement = weightValue >= threshold;
      const matches = !meetsRequirement; // Inverted!
      
      return {
        matches,
        confidence: getConfidenceByMatchType('exactMatch'),
        patientValue: patientValues.join(', '),
        confidenceReason: `Double-negative exclusion criterion (inverted logic). Patient weight ${weightValue}kg, threshold ${threshold}kg. Criterion semantically means "minimum weight ${threshold}kg". Patient ${meetsRequirement ? 'MEETS' : 'FAILS'} requirement.`
      };
    }
  }
  
  // ... rest of patterns
}
```

**Test with this logic:**
- Criterion: "must not weigh < 30kg", EXCLUSION_STRENGTH = "mandatory_exclude"
- Patient: 71kg
- Parsing: threshold = 30kg
- meetsRequirement = (71 >= 30) = true
- matches = !meetsRequirement = false
- Since exclusion and matches=false → Patient NOT excluded ✅

### Option B: Database Normalization (Preferred Long-term)

Fix the database to have explicit fields and correct labels:

```json
{
  "id": "BMI_1916",
  "nct_id": "NCT06979453",
  "raw_text": "Participants must not weigh < 30.0 kg at Screening and Day 1.",
  "EXCLUSION_STRENGTH": "inclusion",  // ✅ Corrected
  "WEIGHT_MIN": 30.0,
  "WEIGHT_UNIT": "kg"
}
```

### Option C: Hybrid Approach (Recommended)

1. **Short-term:** Implement Option A (detect and invert)
2. **Long-term:** Fix database entries (Option B)
3. **Add warning:** Flag double-negative criteria for manual review

```javascript
if (match && isExclusion) {
  console.warn(`⚠️ Double-negative exclusion detected: ${criterion.id}. This may indicate database mislabeling.`);
  // Return special flag for admin review
  return {
    matches: !meetsRequirement,
    confidence: 0.85, // Slightly reduced confidence
    needsAdminReview: true,
    reviewPayload: {
      issue: 'double_negative_exclusion',
      criterionId: criterion.id,
      rawText: criterion.raw_text,
      recommendation: 'Review if this should be EXCLUSION_STRENGTH: "inclusion"'
    },
    // ... rest
  };
}
```

---

## Implementation Checklist

### Phase 1: Matcher Enhancement
- [ ] Add `#parseWeightFromRawText()` helper function
- [ ] Detect double-negative patterns
- [ ] Detect simple comparison patterns (≤, <, ≥, >)
- [ ] Implement logic inversion for double-negatives in exclusions
- [ ] Add warning logs for suspicious patterns
- [ ] Flag for admin review

### Phase 2: Testing
- [ ] Test BMI_1916 (NCT06979453): "must not weigh < 30kg"
- [ ] Test NCT04772079: "weighing ≤ 18kg"
- [ ] Test NCT04772079: "weighing ≤ 30kg"
- [ ] Test edge cases (missing units, different phrasings)
- [ ] Verify confidence scores

### Phase 3: Documentation
- [ ] Update ARCHITECTURE_AND_MATCHING_GUIDE.md
- [ ] Document double-negative handling
- [ ] Add examples of problematic patterns
- [ ] Create database cleanup task list

### Phase 4: Database Cleanup (Future)
- [ ] Identify all double-negative criteria
- [ ] Review and re-label as inclusion where appropriate
- [ ] Add explicit WEIGHT_MIN/MAX fields
- [ ] Deprecate reliance on raw_text parsing

---

## Expected Outcomes

**After Phase 1 implementation:**

| Criterion | Current Behavior | New Behavior |
|-----------|------------------|--------------|
| BMI_1916: "must not weigh < 30kg" (71kg patient) | ❌ EXCLUDED | ✅ NOT EXCLUDED |
| NCT04772079: "weighing ≤ 18kg" (71kg patient) | ❌ EXCLUDED | ✅ NOT EXCLUDED |
| NCT04772079: "weighing ≤ 30kg" (71kg patient) | ❌ EXCLUDED | ✅ NOT EXCLUDED |

**Confidence:**
- Explicit fields: 100% (exactMatch)
- Parsed from raw_text: 100% (exactMatch) with clear reasoning
- Double-negative with inversion: 85% (exactMatch but flagged for review)

---

## Questions for Review

1. **Approach confirmation:** Option C (Hybrid) - implement inversion logic + flag for review?
2. **Confidence levels:** Should double-negatives have reduced confidence (85% vs 100%)?
3. **Admin review:** Should we create a review queue for flagged criteria?
4. **Database cleanup:** Should we create a separate task for fixing database entries?
5. **Testing strategy:** Manual testing vs automated test suite?

---

**Status:** Plan complete, awaiting approval before implementation
**Next Step:** User confirms approach, then implement Phase 1
