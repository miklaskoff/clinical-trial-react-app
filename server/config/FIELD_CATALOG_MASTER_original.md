# Clinical Trial Criteria Parser - Admin Workflow Documentation

**Version:** 2.1  
**Date:** February 2, 2026  
**Purpose:** Admin review workflow for unfamiliar terms and reference list management

> ⚠️ **For complete field definitions**, see [FIELD_CATALOG_v2.1.md](./FIELD_CATALOG_v2.1.md)  
> This document focuses on Admin UI workflow only.

---

## Unfamiliar Term Detection (Stage 2-3 Example)

```python
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