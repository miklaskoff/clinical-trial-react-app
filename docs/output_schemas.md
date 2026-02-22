# Output Schemas Reference

> **Version**: 1.1.0  
> **Last Generated**: 2026-02-16  
> **Source**: [output-schemas.json](../server/config/output-schemas.json)  
> **⚠️ AUTO-GENERATED** — Do not edit directly! Run `npm run docs:schemas` to regenerate.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

- [Overview](#overview)
- [Common Fields](#common-fields)
- [Cluster Schemas](#cluster-schemas)
- [Field Types](#field-types)
- [Defaults](#defaults)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

---

## Overview

This document describes the output schema for each cluster type in the clinical trial criteria parser.

**Total Clusters**: 10

| Cluster | Description |
|---------|-------------|
| AGE | Age-based eligibility criteria |
| BMI | Weight and body mass index |
| SEV | Severity scores and measurements |
| AAO | Affected area and organs |
| DIT | Disease type and variants |
| BIO | Biomarkers |
| CMB | Comorbid conditions and risk factors |
| DD | Disease duration |
| AIC | Active infection history criteria |
| PTH | Psoriasis treatment history |

---

## Common Fields

All clusters share these common fields:

### Required Fields

- `id` — Unique criterion identifier
- `nct_id` — ClinicalTrials.gov identifier
- `raw_text` — Original criterion text
- `CRITERION_TYPE` — inclusion or exclusion
- `EXCLUSION_STRENGTH` — How strictly to apply criterion
- `confidence` — Parser confidence score (0-1)
- `parsing_status` — complete, pending_admin_review, or error

### Optional Fields

- `_thought_process` — AI reasoning explanation
- `LOGICAL_OPERATOR` — AND/OR for compound criteria
- `NESTED_CONDITION` — Complex nested conditions
- `unfamiliar_term_flag` — Contains unknown medical term
- `AMBIGUITY_FLAG` — Criterion is ambiguous
- `REQUIRES_CLINICAL_JUDGMENT` — Needs expert review
- `SUBJECTIVE_ESTIMATE` — Contains subjective assessment
- `original` — Original source data
- `TREATMENT_HISTORY` — Prior treatment information

---

## Cluster Schemas

### CLUSTER_AGE

**Required Fields:**
- `id`
- `nct_id`
- `raw_text`
- `CRITERION_TYPE`
- `EXCLUSION_STRENGTH`
- `confidence`
- `parsing_status`

**Optional Fields:**
- `_thought_process`
- `AGE_MIN`
- `AGE_MAX`
- `AGE_UNIT`
- `MEASUREMENTS`
- `LOGICAL_OPERATOR`
- `NESTED_CONDITION`
- `SUBJECTIVE_ESTIMATE`
- `unfamiliar_term_flag`
- `AMBIGUITY_FLAG`
- `original`

**Example:**
```json
{
  "id": "AGE_001",
  "nct_id": "NCT12345678",
  "raw_text": "Example AGE criterion",
  "CRITERION_TYPE": "inclusion",
  "EXCLUSION_STRENGTH": "mandatory_include",
  "confidence": 1.0,
  "parsing_status": "complete",
  "AGE_MIN": 18,
  "AGE_MAX": 75,
  "AGE_UNIT": "years"
}
```

---

### CLUSTER_BMI

**Required Fields:**
- `id`
- `nct_id`
- `raw_text`
- `CRITERION_TYPE`
- `EXCLUSION_STRENGTH`
- `confidence`
- `parsing_status`

**Optional Fields:**
- `_thought_process`
- `BMI_MIN`
- `BMI_MAX`
- `WEIGHT_MIN`
- `WEIGHT_MAX`
- `WEIGHT_UNIT`
- `MEASUREMENTS`
- `LOGICAL_OPERATOR`
- `NESTED_CONDITION`
- `SUBJECTIVE_ESTIMATE`
- `unfamiliar_term_flag`
- `AMBIGUITY_FLAG`
- `original`

**Example:**
```json
{
  "id": "BMI_001",
  "nct_id": "NCT12345678",
  "raw_text": "Example BMI criterion",
  "CRITERION_TYPE": "inclusion",
  "EXCLUSION_STRENGTH": "mandatory_include",
  "confidence": 1.0,
  "parsing_status": "complete",
  "BMI_MIN": 18.5,
  "BMI_MAX": 35.0
}
```

---

### CLUSTER_SEV

**Required Fields:**
- `id`
- `nct_id`
- `raw_text`
- `CRITERION_TYPE`
- `EXCLUSION_STRENGTH`
- `confidence`
- `parsing_status`

**Optional Fields:**
- `_thought_process`
- `SEVERITY`
- `CONDITION_PATTERN`
- `MEASUREMENTS`
- `ANATOMICAL_LOCATION`
- `LOGICAL_OPERATOR`
- `NESTED_CONDITION`
- `SUBJECTIVE_ESTIMATE`
- `unfamiliar_term_flag`
- `AMBIGUITY_FLAG`
- `original`

**Example:**
```json
{
  "id": "SEV_001",
  "nct_id": "NCT12345678",
  "raw_text": "Example SEV criterion",
  "CRITERION_TYPE": "inclusion",
  "EXCLUSION_STRENGTH": "mandatory_include",
  "confidence": 1.0,
  "parsing_status": "complete",
  "SEVERITY": ["moderate", "severe"],
  "MEASUREMENTS": [{ "parameter": "PASI", "min": 10 }]
}
```

---

### CLUSTER_AAO

**Required Fields:**
- `id`
- `nct_id`
- `raw_text`
- `CRITERION_TYPE`
- `EXCLUSION_STRENGTH`
- `confidence`
- `parsing_status`

**Optional Fields:**
- `_thought_process`
- `ANATOMICAL_LOCATION`
- `MEASUREMENTS`
- `LOGICAL_OPERATOR`
- `NESTED_CONDITION`
- `SUBJECTIVE_ESTIMATE`
- `unfamiliar_term_flag`
- `AMBIGUITY_FLAG`
- `original`

**Example:**
```json
{
  "id": "AAO_001",
  "nct_id": "NCT12345678",
  "raw_text": "Example AAO criterion",
  "CRITERION_TYPE": "inclusion",
  "EXCLUSION_STRENGTH": "mandatory_include",
  "confidence": 1.0,
  "parsing_status": "complete",
  "ANATOMICAL_LOCATION": ["scalp", "nails"]
}
```

---

### CLUSTER_DIT

**Required Fields:**
- `id`
- `nct_id`
- `raw_text`
- `CRITERION_TYPE`
- `EXCLUSION_STRENGTH`
- `confidence`
- `parsing_status`

**Optional Fields:**
- `_thought_process`
- `DISEASE_VARIANT`
- `CONDITION_TYPE`
- `NEGATION_DETECTED`
- `LOGICAL_OPERATOR`
- `NESTED_CONDITION`
- `SUBJECTIVE_ESTIMATE`
- `unfamiliar_term_flag`
- `AMBIGUITY_FLAG`
- `original`

**Example:**
```json
{
  "id": "DIT_001",
  "nct_id": "NCT12345678",
  "raw_text": "Example DIT criterion",
  "CRITERION_TYPE": "inclusion",
  "EXCLUSION_STRENGTH": "mandatory_include",
  "confidence": 1.0,
  "parsing_status": "complete",
  "DISEASE_VARIANT": ["plaque psoriasis"]
}
```

---

### CLUSTER_BIO

**Required Fields:**
- `id`
- `nct_id`
- `raw_text`
- `CRITERION_TYPE`
- `EXCLUSION_STRENGTH`
- `confidence`
- `parsing_status`

**Optional Fields:**
- `_thought_process`
- `CONDITION_TYPE`
- `CONDITION_PATTERN`
- `MEASUREMENTS`
- `LOGICAL_OPERATOR`
- `NESTED_CONDITION`
- `SUBJECTIVE_ESTIMATE`
- `unfamiliar_term_flag`
- `AMBIGUITY_FLAG`
- `original`

**Example:**
```json
{
  "id": "BIO_001",
  "nct_id": "NCT12345678",
  "raw_text": "Example BIO criterion",
  "CRITERION_TYPE": "inclusion",
  "EXCLUSION_STRENGTH": "mandatory_include",
  "confidence": 1.0,
  "parsing_status": "complete",
  "MEASUREMENTS": [{ "parameter": "CRP", "max": 10, "unit": "mg/L" }]
}
```

---

### CLUSTER_CMB

**Required Fields:**
- `id`
- `nct_id`
- `raw_text`
- `CRITERION_TYPE`
- `EXCLUSION_STRENGTH`
- `CONDITION_TYPE`
- `confidence`
- `parsing_status`

**Optional Fields:**
- `_thought_process`
- `CONDITION_PATTERN`
- `SEVERITY`
- `MEASUREMENTS`
- `ANATOMICAL_LOCATION`
- `TIMEFRAME`
- `EXCEPTION_CONDITION`
- `NEGATION_DETECTED`
- `NESTED_CONDITION`
- `LOGICAL_OPERATOR`
- `REQUIRES_CLINICAL_JUDGMENT`
- `SUBJECTIVE_ESTIMATE`
- `unfamiliar_term_flag`
- `AMBIGUITY_FLAG`
- `original`

**Example:**
```json
{
  "id": "CMB_001",
  "nct_id": "NCT12345678",
  "raw_text": "Example CMB criterion",
  "CRITERION_TYPE": "inclusion",
  "EXCLUSION_STRENGTH": "mandatory_include",
  "confidence": 1.0,
  "parsing_status": "complete",
  "CONDITION_TYPE": ["cardiovascular disease"],
  "TIMEFRAME": { "relation": "within", "amount": 5, "unit": "years" }
}
```

---

### CLUSTER_DD

**Required Fields:**
- `id`
- `nct_id`
- `raw_text`
- `CRITERION_TYPE`
- `EXCLUSION_STRENGTH`
- `confidence`
- `parsing_status`

**Optional Fields:**
- `_thought_process`
- `CONDITION_TYPE`
- `CONDITION_PATTERN`
- `TIMEFRAME`
- `LOGICAL_OPERATOR`
- `NESTED_CONDITION`
- `SUBJECTIVE_ESTIMATE`
- `unfamiliar_term_flag`
- `AMBIGUITY_FLAG`
- `original`

**Example:**
```json
{
  "id": "DD_001",
  "nct_id": "NCT12345678",
  "raw_text": "Example DD criterion",
  "CRITERION_TYPE": "inclusion",
  "EXCLUSION_STRENGTH": "mandatory_include",
  "confidence": 1.0,
  "parsing_status": "complete",
  "TIMEFRAME": { "relation": ">=", "amount": 6, "unit": "months" }
}
```

---

### CLUSTER_AIC

**Required Fields:**
- `id`
- `nct_id`
- `raw_text`
- `CRITERION_TYPE`
- `EXCLUSION_STRENGTH`
- `confidence`
- `parsing_status`

**Optional Fields:**
- `_thought_process`
- `CONDITION_TYPE`
- `CONDITION_PATTERN`
- `SEVERITY`
- `ANATOMICAL_LOCATION`
- `TIMEFRAME`
- `NEGATION_DETECTED`
- `TREATMENT_HISTORY`
- `MEASUREMENTS`
- `DISEASE_VARIANT`
- `EXCEPTION_CONDITION`
- `LOGICAL_OPERATOR`
- `NESTED_CONDITION`
- `SUBJECTIVE_ESTIMATE`
- `unfamiliar_term_flag`
- `AMBIGUITY_FLAG`
- `REQUIRES_CLINICAL_JUDGMENT`
- `original`

**Example:**
```json
{
  "id": "AIC_001",
  "nct_id": "NCT12345678",
  "raw_text": "Example AIC criterion",
  "CRITERION_TYPE": "inclusion",
  "EXCLUSION_STRENGTH": "mandatory_include",
  "confidence": 1.0,
  "parsing_status": "complete",
  "CONDITION_TYPE": ["active infection"],
  "TIMEFRAME": { "relation": "within", "amount": 4, "unit": "weeks" }
}
```

---

### CLUSTER_PTH

**Required Fields:**
- `id`
- `nct_id`
- `raw_text`
- `CRITERION_TYPE`
- `EXCLUSION_STRENGTH`
- `confidence`
- `parsing_status`

**Optional Fields:**
- `_thought_process`
- `CONDITION_TYPE`
- `CONDITION_PATTERN`
- `TIMEFRAME`
- `EXCEPTION_CONDITION`
- `LOGICAL_OPERATOR`
- `NESTED_CONDITION`
- `SUBJECTIVE_ESTIMATE`
- `unfamiliar_term_flag`
- `AMBIGUITY_FLAG`
- `original`

**Example:**
```json
{
  "id": "PTH_001",
  "nct_id": "NCT12345678",
  "raw_text": "Example PTH criterion",
  "CRITERION_TYPE": "inclusion",
  "EXCLUSION_STRENGTH": "mandatory_include",
  "confidence": 1.0,
  "parsing_status": "complete",
  "TREATMENT_HISTORY": [{ "treatment": "methotrexate", "response": "inadequate" }]
}
```

---

## Field Types

### Basic Types

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique criterion identifier |
| `nct_id` | string | ClinicalTrials.gov identifier |
| `raw_text` | string | Original criterion text |
| `_thought_process` | string | AI reasoning explanation |
| `SUBJECTIVE_ESTIMATE` | boolean | Contains subjective assessment |
| `confidence` | number | Parser confidence score (0-1) |
| `unfamiliar_term_flag` | boolean | Contains unknown medical term |
| `AMBIGUITY_FLAG` | boolean | Criterion is ambiguous |
| `REQUIRES_CLINICAL_JUDGMENT` | boolean | Needs expert review |
| `CONDITION_TYPE` | array |  |
| `CONDITION_PATTERN` | array |  |
| `SEVERITY` | array |  |
| `ANATOMICAL_LOCATION` | array |  |
| `DISEASE_VARIANT` | array |  |
| `AGE_UNIT` | string |  |
| `WEIGHT_UNIT` | string |  |

### Enum Types

| Field | Allowed Values |
|-------|----------------|
| `CRITERION_TYPE` | `inclusion`, `exclusion` |
| `EXCLUSION_STRENGTH` | `mandatory_exclude`, `conditional_exclude`, `mandatory_include`, `conditional_include` |
| `parsing_status` | `complete`, `pending_admin_review`, `error` |
| `LOGICAL_OPERATOR` | `AND`, `OR`, `null` |

### Complex Types

#### TIMEFRAME

```json
{
  "relation": "within",
  "amount": 6,
  "unit": "months",
  "reference": "screening"
}
```

#### TREATMENT_HISTORY

```json
[
  {
    "treatment": "adalimumab",
    "treatment_class": "TNF_INHIBITOR",
    "response": "inadequate",
    "timing": "prior to screening",
    "confidence": 0.95
  }
]
```

#### NEGATION_DETECTED

```json
{
  "is_negated": true,
  "negated_term": "no history of",
  "context": "exclusion criterion",
  "negation_type": "absence",
  "interpretation": "patient must NOT have condition",
  "affected_fields": ["CONDITION_TYPE"]
}
```

#### NESTED_CONDITION

```json
{
  "main_condition": { "type": "cardiac" },
  "nested_operator": ">=",
  "nested_count": 2,
  "nested_items": [
    { "type": "CONDITION_TYPE", "value": "heart failure" },
    { "type": "CONDITION_TYPE", "value": "arrhythmia" }
  ],
  "nested_logical_operator": "OR"
}
```

---

## Defaults

When a field is not specified in parsed output, these defaults apply:

| Field | Default Value |
|-------|---------------|
| `confidence` | `1` |
| `parsing_status` | `"complete"` |
| `unfamiliar_term_flag` | `false` |
| `AMBIGUITY_FLAG` | `false` |
| `REQUIRES_CLINICAL_JUDGMENT` | `false` |
| `SUBJECTIVE_ESTIMATE` | `false` |
| `CONDITION_TYPE` | `[]` |
| `CONDITION_PATTERN` | `[]` |
| `SEVERITY` | `[]` |
| `ANATOMICAL_LOCATION` | `[]` |

---

## Nested Item Types

Valid types for `NESTED_CONDITION.nested_items`:

- `CONDITION_TYPE`
- `ANATOMICAL_LOCATION`
- `SEVERITY`
- `TIMEFRAME`
- `TREATMENT_HISTORY`
- `CONDITION_PATTERN`
- `MEASUREMENT`
- `TREATMENT_REQUIREMENT`
- `EXCEPTION`

---

## Treatment History Subfields

Valid subfields for `TREATMENT_HISTORY` entries:

- `treatment`
- `treatment_class`
- `response`
- `timing`
- `confidence`
- `requires_hospitalization`
- `duration`
- `count`
- `route`
- `dose`
- `frequency`
- `indication`
- `unfamiliar_term_flag`

---

## Negation Detected Fields

Valid fields for `NEGATION_DETECTED`:

- `is_negated`
- `negated_term`
- `context`
- `negation_type`
- `interpretation`
- `affected_fields`
- `parsing_note`

---

> **See Also:**  
> - [Architecture Guide](ARCHITECTURE_AND_MATCHING_GUIDE.md) — System design  
> - [FIELD_CATALOG_v2.1.md](../server/config/FIELD_CATALOG_v2.1.md) — Parsing rules  
> - [output-schemas.json](../server/config/output-schemas.json) — Source JSON
