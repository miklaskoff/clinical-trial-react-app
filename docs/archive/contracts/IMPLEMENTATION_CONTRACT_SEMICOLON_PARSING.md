# Implementation Contract: Semicolon Branch Separation & Timeframe Scope Rules

**Iteration:** 2.4  
**Date:** February 2, 2026  
**Status:** ✅ COMPLETE

---

## Feature: Semicolon Branch Separation & Timeframe Scope Rules

### Requirement (What should work)

1. **Semicolon Branch Separation**: When a criterion contains semicolons (`;`), the parser should recognize these as TOP-LEVEL OR branches with potentially different scopes
2. **Timeframe Scope**: TIMEFRAME should only apply to the clause it's grammatically attached to, NOT the entire criterion
3. **Treatment vs Condition Classification**: "hospitalization" and "IV antibiotics" should be in TREATMENT_HISTORY, not treated as condition examples

### Problem Being Solved

AIC_2319 was incorrectly parsed:
- "hospitalization OR treatment with IV antibiotics" was nested under NESTED_CONDITION instead of being TOP-LEVEL OR alternatives
- The 2-month TIMEFRAME was applied to the entire criterion instead of just the hospitalization/IV treatment branch
- Treatment events were mixed with condition types

### Acceptance Tests (MUST PASS before completion)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| T1 | Semicolon detection | Parser identifies `;` as branch separator |
| T2 | Multiple branches with different timeframes | Each branch gets correct TIMEFRAME (or null) |
| T3 | Treatment classification | "hospitalization", "IV antibiotics" → TREATMENT_HISTORY |
| T4 | Condition classification | "infection", "sepsis" → CONDITION_TYPE |
| T5 | OR at top level | LOGICAL_OPERATOR correctly set for multi-branch criteria |
| T6 | Re-parse AIC_2319 | Produces correct structure with hospitalization/IV in TREATMENT_HISTORY |

### Verification Checklist

1. [x] Tests written FIRST (must FAIL initially)
2. [x] FIELD_CATALOG updated with new rules
3. [x] Tests PASS after implementation
4. [x] Re-parse AIC_2319 shows correct structure
5. [x] Manual verification of parsed output
6. [x] CHANGELOG updated
7. [x] Lesson learned reviewed
8. [ ] Git pushed

### Anti-Patterns (FORBIDDEN)

- ❌ Applying TIMEFRAME to entire criterion when it only applies to part
- ❌ Putting treatment events (hospitalization, IV therapy) in NESTED_CONDITION.nested_items
- ❌ Ignoring semicolons as structural separators
- ❌ Claiming "done" without re-parsing and verifying output

---

## New Rules to Add to FIELD_CATALOG

### Rule 1: Semicolon Branch Separation

```markdown
### SEMICOLON PARSING RULE

Semicolons (`;`) in criteria text typically indicate TOP-LEVEL OR branches with different scopes.

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
- Segment A: "Known history of chronic infections" → CONDITION_TYPE + CONDITION_PATTERN, no TIMEFRAME
- Segment B: "hospitalization for infections within 2 months" → TREATMENT_HISTORY, TIMEFRAME: 2 months

**Output Guidance:**
When segments have DIFFERENT timeframes, document in parsing notes and apply TIMEFRAME only to relevant segment.
```

### Rule 2: Timeframe Scope

```markdown
### TIMEFRAME SCOPE RULE

TIMEFRAME only applies to the clause it's grammatically attached to.

**Patterns:**
- "X within 2 months" → TIMEFRAME applies to X only
- "X; Y within 2 months" → TIMEFRAME applies to Y only, NOT X
- "X and Y within 2 months" → TIMEFRAME applies to BOTH X and Y
- "X, or Y within 2 months" → TIMEFRAME applies to Y only (comma + or = new scope)

**When scopes differ:**
- Document which elements have timeframes in _thought_process
- Set TIMEFRAME to the most restrictive/relevant one
- Add note in parsing about scope limitation
```

### Rule 3: Treatment vs Condition Classification

```markdown
### TREATMENT vs CONDITION CLASSIFICATION

Some terms describe TREATMENT EVENTS (use TREATMENT_HISTORY), not conditions.

**TREATMENT EVENTS → Use TREATMENT_HISTORY:**
- hospitalization
- treatment with [drug/therapy]
- intravenous (IV) [anything]
- surgery/surgical procedure
- therapy/intervention
- infusion
- transfusion

**CONDITIONS → Use CONDITION_TYPE:**
- infections, diseases, disorders
- symptoms (pain, fever, etc.)
- diagnoses (sepsis, pneumonia, etc.)

**Combined phrases:**
- "hospitalization FOR infection" → 
  - "hospitalization" → TREATMENT_HISTORY (with indication: "infection")
  - "infection" → Can also be in CONDITION_TYPE if needed for matching

**Example:**
```json
"TREATMENT_HISTORY": [{
  "treatment": "hospitalization",
  "indication": "infection",
  "timing": { "within": 2, "unit": "months" }
}]
```
```

---

## Expected Output for AIC_2319 (After Fix)

```json
{
  "id": "AIC_2319",
  "raw_text": "Known history of recurrent or chronic infections, or prior history of chronic or recurrent infections, including but not limited to: chronic renal infection, chronic chest infection (e.g., bronchiectasis), symptomatic urinary tract infection, and open, draining, or infected skin wounds; history of serious infections (e.g., sepsis, pneumonia, and pyelonephritis), or hospitalization or treatment with intravenous antibiotics for infections within 2 months before screening",
  
  "CONDITION_TYPE": [
    "recurrent infections",
    "chronic infections", 
    "chronic renal infection",
    "chronic chest infection",
    "bronchiectasis",
    "urinary tract infection",
    "infected skin wounds",
    "serious infections",
    "sepsis",
    "pneumonia",
    "pyelonephritis"
  ],
  
  "CONDITION_PATTERN": ["history", "prior", "recurrent", "chronic"],
  
  "SEVERITY": ["chronic", "serious", "symptomatic"],
  
  "ANATOMICAL_LOCATION": ["renal", "chest", "urinary tract", "skin"],
  
  "TREATMENT_HISTORY": [
    {
      "treatment": "hospitalization",
      "indication": "infections",
      "timing": {
        "relation": "within",
        "amount": 2,
        "unit": "months",
        "reference": "screening"
      }
    },
    {
      "treatment": "intravenous antibiotics",
      "indication": "infections",
      "timing": {
        "relation": "within",
        "amount": 2,
        "unit": "months",
        "reference": "screening"
      }
    }
  ],
  
  "LOGICAL_OPERATOR": "OR",
  
  "CRITERION_TYPE": "exclusion",
  "EXCLUSION_STRENGTH": "mandatory_exclude",
  
  "_parsing_notes": "Semicolon separates condition history (no timeframe) from treatment events (2-month timeframe). TIMEFRAME applies ONLY to hospitalization/IV antibiotics branch."
}
```

**Key Differences from Original:**
1. ✅ `TREATMENT_HISTORY` contains hospitalization and IV antibiotics
2. ✅ No more `NESTED_CONDITION` with treatment requirements inside
3. ✅ TIMEFRAME scope documented in `_parsing_notes`
4. ✅ Cleaner separation of conditions vs treatments
