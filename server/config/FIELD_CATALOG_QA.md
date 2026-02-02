# Field Catalog Q&A - Design Clarifications

**Date:** January 31, 2026  
**Status:** Pre-Implementation Review

---

## Question 1: How does the system determine unfamiliar conditions?

### **Answer:**

The system uses a **two-stage matching process**:

#### **Stage 1: Exact Match**
```python
# Check if condition exists in reference list
condition_text = "plaque psoriasis"
if condition_text.lower() in reference_list['condition_types']:
    familiar = True
else:
    familiar = False
```

#### **Stage 2: Fuzzy Match (for variants)**
```python
# Check for partial matches with qualifiers
base_terms = ["psoriasis", "arthritis", "diabetes", "cancer", "infection"]

for base_term in base_terms:
    if base_term in condition_text.lower():
        # It's a variant of a known condition
        familiar = True
        break
```

#### **Stage 3: LLM Confidence Score**
```python
# LLM assigns confidence score
{
  "CONDITION_TYPE": ["plaque psoriasis"],
  "confidence": 0.95  // High confidence = familiar
}

# If confidence < 0.7, flag as unfamiliar
if confidence < 0.7:
    unfamiliar_term_flag = True
```

---

### **Concrete Example:**

#### **Example 1: Familiar Condition**
```
Raw Text: "Diagnosis of plaque psoriasis"

Step 1: Extract condition → "plaque psoriasis"
Step 2: Check reference list → FOUND (13 occurrences)
Step 3: Confidence = 1.0
Result: Familiar ✅

Output:
{
  "CONDITION_TYPE": ["plaque psoriasis"],
  "unfamiliar_term_flag": false
}
```

#### **Example 2: Variant of Familiar Condition**
```
Raw Text: "Diagnosis of generalized pustular psoriasis"

Step 1: Extract condition → "generalized pustular psoriasis"
Step 2: Check reference list → NOT FOUND
Step 3: Check for base term → "psoriasis" FOUND
Step 4: Confidence = 0.85 (variant of known condition)
Result: Familiar (variant) ✅

Output:
{
  "CONDITION_TYPE": ["generalized pustular psoriasis"],
  "unfamiliar_term_flag": false,
  "note": "Variant of known condition: psoriasis"
}
```

#### **Example 3: Unfamiliar Condition**
```
Raw Text: "Diagnosis of Schnitzler syndrome"

Step 1: Extract condition → "schnitzler syndrome"
Step 2: Check reference list → NOT FOUND
Step 3: Check for base terms → NONE FOUND
Step 4: LLM confidence = 0.6 (low, unfamiliar medical term)
Result: Unfamiliar ❌

Output:
{
  "CONDITION_TYPE": ["schnitzler syndrome"],
  "unfamiliar_term_flag": true,  // ← Admin review needed
  "confidence": 0.6
}
```

---

### **Proposed Algorithm:**

```python
def is_familiar_condition(condition_text, reference_lists):
    """
    Determine if a condition is familiar or needs admin review.
    
    Returns:
        (bool, float): (is_familiar, confidence_score)
    """
    condition_lower = condition_text.lower()
    
    # Stage 1: Exact match
    if condition_lower in reference_lists['condition_types']:
        return (True, 1.0)
    
    # Stage 2: Base term match
    base_medical_terms = [
        "psoriasis", "arthritis", "diabetes", "cancer", "infection",
        "hepatitis", "tuberculosis", "malignancy", "disease", "syndrome"
    ]
    
    for base_term in base_medical_terms:
        if base_term in condition_lower:
            # It's a variant/qualifier of known condition
            return (True, 0.85)
    
    # Stage 3: LLM confidence (if we reach here, it's unfamiliar)
    # LLM will assign confidence based on medical knowledge
    # For now, flag as unfamiliar
    return (False, 0.6)
```

---

## Question 2: How do you handle mixing categories (e.g., "active" in SEVERITY vs CONDITION_PATTERN)?

### **The Problem:**

**SEVERITY includes:**
- Activity: active, inactive, quiescent, flaring

**CONDITION_PATTERN includes:**
- Status: active, inactive, ongoing, resolved

**Both have "active" and "inactive"!**

---

### **Answer:**

**Use CONTEXT to determine which field to populate.**

#### **Decision Rules:**

| Context | Field | Example |
|---------|-------|---------|
| "active" modifies **disease status** | CONDITION_PATTERN | "active psoriatic arthritis" |
| "active" modifies **disease intensity** | SEVERITY | "active flare" |
| "active" modifies **infection status** | CONDITION_PATTERN | "active infection" |
| "acute" (time-based) | SEVERITY | "acute GPP flare" |
| "chronic" (time-based) | SEVERITY | "chronic plaque psoriasis" |
| "current" (temporal) | CONDITION_PATTERN | "current diagnosis" |
| "history" (temporal) | CONDITION_PATTERN | "history of cancer" |

---

### **Concrete Examples:**

#### **Example 1: "active" → CONDITION_PATTERN**
```
Raw Text: "Diagnosis of active psoriatic arthritis"

LLM Reasoning:
1. "active" modifies "psoriatic arthritis" (the condition itself)
2. It describes the STATUS of the condition (active vs inactive)
3. This is CONDITION_PATTERN, not SEVERITY

Output:
{
  "CONDITION_TYPE": ["psoriatic arthritis"],
  "CONDITION_PATTERN": ["active"],
  "SEVERITY": []  // Empty, no severity descriptor
}
```

#### **Example 2: "active" → SEVERITY**
```
Raw Text: "Patients experiencing an active GPP flare"

LLM Reasoning:
1. "active" modifies "flare" (the disease activity)
2. "flare" is a SEVERITY descriptor (intensity of disease)
3. This is SEVERITY, not CONDITION_PATTERN

Output:
{
  "CONDITION_TYPE": ["generalized pustular psoriasis"],
  "CONDITION_PATTERN": ["current"],  // Implied
  "SEVERITY": ["active", "flaring"]
}
```

#### **Example 3: Both fields populated**
```
Raw Text: "History of chronic active hepatitis B"

LLM Reasoning:
1. "history" → CONDITION_PATTERN (temporal)
2. "chronic" → SEVERITY (duration/acuity)
3. "active" → CONDITION_PATTERN (status)
4. Both fields are populated

Output:
{
  "CONDITION_TYPE": ["hepatitis b"],
  "CONDITION_PATTERN": ["history", "active"],
  "SEVERITY": ["chronic"]
}
```

---

### **Proposed Decision Tree:**

```
Is the term temporal? (current, history, past, previous)
  → YES: CONDITION_PATTERN
  → NO: Continue

Is the term about disease status? (active, inactive, ongoing, resolved)
  → YES: CONDITION_PATTERN
  → NO: Continue

Is the term about disease intensity? (mild, moderate, severe)
  → YES: SEVERITY
  → NO: Continue

Is the term about disease acuity? (acute, chronic, subacute)
  → YES: SEVERITY
  → NO: Continue

Is the term about disease activity? (flaring, quiescent, remission)
  → YES: SEVERITY
  → NO: Continue

Is the term about disease stability? (stable, unstable, progressive)
  → YES: SEVERITY
```

---

### **Updated Field Definitions:**

#### **SEVERITY (revised):**
```
Purpose: Disease intensity, acuity, stability, and activity LEVEL

Categories:
- Intensity: mild, moderate, severe, critical
- Acuity: acute, chronic, subacute, recurrent
- Stability: stable, unstable, progressive, deteriorating
- Activity LEVEL: flaring, quiescent, remission

Do NOT include: active, inactive (these go in CONDITION_PATTERN)
```

#### **CONDITION_PATTERN (revised):**
```
Purpose: Disease temporal status and current state

Categories:
- Temporal: current, history, past, previous, prior, recent
- Status: active, inactive, ongoing, resolved
- Change: new, worsening, improving
- Diagnosis: confirmed, suspected, diagnosed

Do NOT include: acute, chronic, mild, moderate, severe (these go in SEVERITY)
```

---

## Question 3: AMBIGUITY_FLAG lacks examples

### **Answer:**

### **AMBIGUITY_FLAG (Revised with Examples)**

**Purpose:** Flag indicating criterion text is ambiguous or unclear

**Data Type:** `boolean`

**Format:**
```json
{
  "AMBIGUITY_FLAG": true,
  "ambiguity_reason": "Incomplete sentence; missing what 'the following' refers to"
}
```

---

### **Examples:**

#### **Example 1: Incomplete Sentence**
```
Raw Text: "PASI score is ≥10 and <12 with at least one of the following: >"

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

Output:
{
  "id": "XXX_9012",
  "raw_text": "PASI ≥10 or PASI <10",
  "AMBIGUITY_FLAG": true,
  "ambiguity_reason": "Contradictory: criterion covers all possible PASI values (always true); likely data entry error"
}
```

#### **Example 5: Clear Criterion (No Ambiguity)**
```
Raw Text: "PASI score ≥ 10 at baseline"

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

## Question 4: How are nested conditions processed to JSON?

### **Answer:**

### **NESTED_CONDITION (Revised with Full Examples)**

**Purpose:** Structured representation of nested logical conditions for patient matching

**Data Type:** `object` (changed from `string`)

**Format:**
```json
{
  "NESTED_CONDITION": {
    "main_condition": {
      "parameter": "PASI",
      "value": 10,
      "comparison": ">="
    },
    "nested_operator": "at_least_one",  // "all", "any", "at_least_one", "at_least_n"
    "nested_count": 2,                   // Only for "at_least_n"
    "nested_items": [
      {
        "type": "ANATOMICAL_LOCATION",
        "values": ["facial", "scalp"]
      }
    ],
    "nested_logical_operator": "OR"  // OR between nested items
  }
}
```

---

### **Complete Examples:**

#### **Example 1: At Least One**
```
Raw Text: "PASI score is ≥10 and <12 with at least one of the following: facial or scalp involvement"

Output:
{
  "id": "SEV_1597",
  "raw_text": "PASI score is ≥10 and <12 with at least one of the following: >Clinically relevant facial or scalp involvement",
  
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
  },
  
  "REQUIRES_CLINICAL_JUDGMENT": true  // "Clinically relevant"
}
```

**Patient Matching Logic:**
```javascript
function matchesCriterion(patient, criterion) {
  // Check main condition
  if (!(10 <= patient.pasi_score && patient.pasi_score < 12)) {
    return false;
  }
  
  // Check nested condition
  const nested = criterion.NESTED_CONDITION;
  if (nested.nested_operator === 'at_least_one') {
    // Patient needs at least one of: facial OR scalp involvement
    const hasFacial = patient.hasInvolvement('facial');
    const hasScalp = patient.hasInvolvement('scalp');
    
    if (!(hasFacial || hasScalp)) {
      return false;
    }
  }
  
  return true;
}
```

---

#### **Example 2: At Least N**
```
Raw Text: "BSA ≥ 10% with involvement of at least two of the following: scalp, face, hands, feet"

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
    "nested_count": 2,  // At least 2 items
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

---

#### **Example 3: All Required**
```
Raw Text: "PASI ≥ 12 with all of the following: scalp involvement, nail involvement, and joint involvement"

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
    "nested_logical_operator": "AND"  // ALL items required
  }
}
```

---

## Question 5: How is NEGATION_DETECTED parsed into normal informative fields?

### **Answer:**

NEGATION_DETECTED should be **supplementary documentation**, not a replacement for parsing into normal fields.

---

### **Complete Example: Non-Plaque Psoriasis**

```
Raw Text: "Diagnosis of non-plaque psoriasis or drug-induced psoriasis"

Output:
{
  "id": "NPV_2109",
  "nct_id": "NCT06672393",
  "raw_text": "Diagnosis of non-plaque psoriasis or drug-induced psoriasis",
  
  // ✅ PARSED INTO NORMAL FIELDS
  "CONDITION_TYPE": [
    "non-plaque psoriasis",
    "drug-induced psoriasis"
  ],
  
  "PSORIASIS_VARIANT": [
    "non-plaque",      // ← Parsed as a variant category
    "drug-induced"
  ],
  
  "CONDITION_PATTERN": ["current"],
  
  "LOGICAL_OPERATOR": "OR",
  
  "EXCLUSION_STRENGTH": "mandatory_exclude",
  
  // ✅ SUPPLEMENTARY DOCUMENTATION
  "NEGATION_DETECTED": {
    "negated_term": "plaque",
    "interpretation": "Excludes patients with plaque psoriasis; includes all other psoriasis variants",
    "affected_fields": ["CONDITION_TYPE", "PSORIASIS_VARIANT"],
    "parsing_note": "'non-plaque' treated as a distinct variant category, NOT as absence of 'plaque'"
  }
}
```

---

### **Example 2: Absence of Plaque Psoriasis**

```
Raw Text: "Patients in the absence of plaque psoriasis"

Output:
{
  "id": "NPV_2426",
  "raw_text": "Patients in the absence of plaque psoriasis",
  
  // ✅ PARSED INTO NORMAL FIELDS
  "CONDITION_TYPE": ["plaque psoriasis"],
  
  "CONDITION_PATTERN": ["absence"],  // ← Indicates negation
  
  "PSORIASIS_VARIANT": [],  // Empty - no specific variant mentioned
  
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

---

### **Example 3: Exception Clause**

```
Raw Text: "History of cancer except basal cell carcinoma"

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

---

## Summary: Key Rule Changes in v2.1

| Field | Change |
|-------|--------|
| CONDITION_PATTERN | Added `absence` for negation; `active/inactive` ONLY here |
| SEVERITY | Removed `active/inactive`; kept `flaring/quiescent/remission` |
| NESTED_CONDITION | Changed from string to object with `main_condition`, `nested_operator`, `nested_items` |
| NEGATION_DETECTED | Supplementary only; negation ALWAYS parsed into normal fields |
| AMBIGUITY_FLAG | Added `ambiguity_reason` field |
| unfamiliar_term_flag | 3-stage detection: exact → base term → LLM confidence |

---

**Version:** 2.1  
**Date:** January 31, 2026
