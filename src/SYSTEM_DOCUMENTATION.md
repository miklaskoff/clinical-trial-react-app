# Clinical Trial Eligibility System - Complete Guide

**Version:** 3.0  
**Date:** 2026-01-11  
**Author:** Clinical Trial Matching System

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Questionnaire Component](#questionnaire-component)
4. [Matcher Component](#matcher-component)
5. [Slot-Filled Data Format](#slot-filled-data-format)
6. [AI Reasoning Engine](#ai-reasoning-engine)
7. [Usage Examples](#usage-examples)
8. [API Reference](#api-reference)
9. [Testing & Validation](#testing--validation)
10. [Deployment](#deployment)

---

## System Overview

This system converts patient responses into structured slot-filled format and matches them against clinical trial eligibility criteria to determine which trials a patient is eligible for.

### Key Features

- ✅ **Multi-Cluster Questionnaire**: Covers 9 different eligibility domains
- ✅ **Autocomplete Input**: Smart suggestions for conditions and treatments
- ✅ **Slot-Filled Responses**: Standardized data format matching database structure
- ✅ **AI-Powered Matching**: Uses semantic reasoning when exact matches fail
- ✅ **Confidence Scoring**: Flags low-confidence matches for manual review
- ✅ **Comprehensive Reporting**: Detailed eligibility reports with reasoning

### The 9 Clusters

1. **CMB** - Comorbid Conditions and Risk Factors
2. **PTH** - Psoriasis Treatment History and Restrictions
3. **AIC** - Active Infection History Criteria
4. **AAO** - Affected Area and Organs
5. **AGE** - Age-Based Eligibility Criteria
6. **NPV** - Non-Plaque Psoriasis Variants
7. **CPD** - Chronic Plaque Psoriasis Duration Criteria
8. **SEV** - Severity Scores
9. **BMI** - Weight and Body Mass Index Criteria

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PATIENT INTERFACE                        │
│  (ClinicalTrialEligibilityQuestionnaire.jsx)               │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ Slot-Filled Response
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              SLOT-FILLED RESPONSE BUILDER                   │
│  • Converts UI inputs to standardized format                │
│  • Validates data completeness                              │
│  • Ensures database format compatibility                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ {responses: {CMB: [...], PTH: [...]}}
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                 CLINICAL TRIAL MATCHER                      │
│              (ClinicalTrialMatcher.js)                      │
│                                                             │
│  ┌───────────────────────────────────────────────┐         │
│  │  EXACT SLOT MATCHING                          │         │
│  │  • Condition type matching                    │         │
│  │  • Timeframe evaluation                       │         │
│  │  • Severity comparison                        │         │
│  │  • Measurement threshold checks               │         │
│  └──────────┬────────────────────────────────────┘         │
│             │                                               │
│             │ If no exact match...                          │
│             ▼                                               │
│  ┌───────────────────────────────────────────────┐         │
│  │  AI REASONING ENGINE                          │         │
│  │  • Semantic similarity detection              │         │
│  │  • Drug class matching                        │         │
│  │  • Synonym recognition                        │         │
│  │  • Confidence scoring (0.0-1.0)               │         │
│  └──────────┬────────────────────────────────────┘         │
│             │                                               │
│             ▼                                               │
│  ┌───────────────────────────────────────────────┐         │
│  │  TRIAL ELIGIBILITY DETERMINATION              │         │
│  │  • Eligible (all checks pass)                 │         │
│  │  • Ineligible (matched exclusion)             │         │
│  │  • Needs Review (low confidence AI match)     │         │
│  └──────────┬────────────────────────────────────┘         │
└─────────────┼───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│                 MATCH REPORT GENERATOR                      │
│  • Text report (human-readable)                             │
│  • JSON report (machine-readable)                           │
│  • Confidence scores and AI reasoning explanations          │
└─────────────────────────────────────────────────────────────┘
```

---

## Questionnaire Component

### Features

**Cluster-Based Navigation**
- Progress bar showing completion status
- Previous/Next navigation
- Per-cluster validation

**Smart Input Components**
- **Autocomplete**: Suggests conditions/treatments as user types
- **Conditional Rendering**: Follow-up questions appear based on answers
- **Visual Hierarchy**: Nested questions reflect AND logic, sibling questions reflect OR logic

**Real-Time Response Building**
- Live preview of slot-filled response structure
- Developer panel shows current response state
- Validates data before submission

### Example Usage

```jsx
import ClinicalTrialEligibilityQuestionnaire from './ClinicalTrialEligibilityQuestionnaire';

function App() {
  return <ClinicalTrialEligibilityQuestionnaire />;
}
```

### Questionnaire Flow

1. **User answers primary question** (e.g., "Do you have any other diseases?")
2. **If YES**: Conditional follow-up questions appear
   - Autocomplete input for condition selection
   - Pattern questions (current vs. history)
   - Timeframe questions (when did it occur?)
   - Severity questions (how severe?)
3. **User can add multiple entries** per cluster
4. **Progress to next cluster** via Next button
5. **Submit at final cluster** to trigger matching

---

## Matcher Component

### Core Matching Logic

The matcher uses a **hierarchical evaluation strategy**:

#### 1. Exact Slot Matching

```javascript
// Example: Checking condition type
if (arraysOverlap(criterionCondition.CONDITION_TYPE, patientCondition.CONDITION_TYPE)) {
  // Condition type matches - proceed to check other constraints
  
  // Check pattern (current vs. history)
  if (criterionCondition.CONDITION_PATTERN.length > 0) {
    if (!arraysOverlap(criterionCondition.CONDITION_PATTERN, patientCondition.CONDITION_PATTERN)) {
      continue; // Pattern mismatch
    }
  }
  
  // Check timeframe
  if (criterionCondition.TIMEFRAME) {
    if (!timeframeMatches(criterionCondition.TIMEFRAME, patientCondition.TIMEFRAME)) {
      continue; // Timeframe mismatch
    }
  }
  
  // All checks passed - MATCH!
  matches = true;
}
```

#### 2. AI Semantic Matching

When exact slot matching fails, the AI engine evaluates semantic similarity:

```javascript
// Example: Treatment class matching
const aiResult = await AIMatchingEngine.evaluateMatch(
  patientData,
  criterionCondition,
  patientCondition,
  criterionCondition
);

if (aiResult.matches) {
  matches = true;
  requiresAI = true;
  aiReasoning = "Patient's treatment 'Humira' is classified as TNF inhibitor, 
                 which matches criterion requiring non-TNFi biologics.";
  confidence = 0.9; // High confidence but flagged for review
}
```

#### 3. Exception Condition Handling

```javascript
// Example: Exception that makes patient eligible
if (criterionCondition.EXCEPTION_CONDITION) {
  // "Excluding clinically cured skin cancers"
  if (this.evaluateException(criterionCondition.EXCEPTION_CONDITION, patientCondition)) {
    continue; // Exception applies - patient is eligible
  }
}
```

### Confidence Scoring

| Confidence | Meaning | Action |
|------------|---------|--------|
| **1.0** | Exact match | Auto-approve |
| **0.9-0.99** | High semantic similarity | Flag for review |
| **0.8-0.89** | Moderate similarity | Flag for manual review |
| **< 0.8** | Low confidence | Requires manual adjudication |

---

## Slot-Filled Data Format

### Patient Response Structure

```json
{
  "timestamp": "2026-01-11T10:30:00Z",
  "version": "3.0",
  "responses": {
    "CMB": [
      {
        "CONDITION_TYPE": ["depression"],
        "CONDITION_PATTERN": ["current"],
        "SEVERITY": "moderate",
        "TIMEFRAME": null,
        "ANATOMICAL_LOCATION": ["neuropsychiatric"]
      }
    ],
    "PTH": [
      {
        "TREATMENT_TYPE": ["humira"],
        "TREATMENT_PATTERN": ["used previously"],
        "TIMEFRAME": {
          "relation": "within",
          "amount": 12,
          "unit": "weeks",
          "reference": "last use"
        },
        "DRUG_CLASSIFICATION": {
          "drug_class": "TNF inhibitor",
          "mechanism": "Anti-TNFα",
          "is_tnf": true,
          "is_biologic": true,
          "aliases": ["adalimumab"]
        }
      }
    ],
    "AGE": {
      "age": 45
    },
    "AAO": {
      "BSA": { "value": 15 },
      "PASI": { "value": 18 }
    },
    "BMI": {
      "weight": { "value": 75, "unit": "kg" },
      "height": { "value": 175, "unit": "cm" },
      "bmi": 24.49
    }
  }
}
```

### Database Criterion Structure

```json
{
  "id": "CMB_001",
  "nct_id": "NCT06170840",
  "raw_text": "Patients with depression affecting medication compliance",
  "conditions": [
    {
      "CONDITION_TYPE": ["depression"],
      "CONDITION_PATTERN": ["current", "history"],
      "SEVERITY": "affects medication compliance",
      "ANATOMICAL_LOCATION": ["neuropsychiatric"],
      "TIMEFRAME": null,
      "LOGICAL_OPERATOR": "OR",
      "EXCEPTION_CONDITION": null
    }
  ],
  "EXCLUSION_STRENGTH": "mandatory_exclude"
}
```

---

## AI Reasoning Engine

### Semantic Similarity Detection

The AI engine uses multiple strategies to detect matches:

#### 1. Synonym Dictionary

```javascript
const synonyms = {
  'depression': ['major depressive disorder', 'clinical depression', 'depressive episode'],
  'heart failure': ['cardiac insufficiency', 'congestive heart failure', 'CHF'],
  'myocardial infarction': ['heart attack', 'MI', 'cardiac infarction']
};
```

#### 2. Substring Matching

```javascript
// "heart failure" matches "congestive heart failure"
if (normCriterion.includes(normPatient) || normPatient.includes(normCriterion)) {
  return { matches: true, confidence: 0.9 };
}
```

#### 3. Drug Class Inference

```javascript
// Patient took "Humira" → Database knows it's a TNF inhibitor
// Criterion excludes "biologics" → Match via class hierarchy
if (drugClassification?.is_biologic) {
  return {
    matches: true,
    confidence: 0.9,
    explanation: "Patient's treatment is classified as biologic"
  };
}
```

### When AI Flagging Occurs

**Triggers for "Needs Review" status:**
- Confidence < 0.8 on any matched criterion
- Multiple AI-matched criteria in same trial
- Conflicting signals across clusters

**Benefits:**
- Prevents false negatives (missing eligible patients)
- Provides transparency in reasoning
- Enables human oversight of edge cases

---

## Usage Examples

### Example 1: Basic Matching Flow

```javascript
import { ClinicalTrialMatcher, runMatcher } from './ClinicalTrialMatcher';

// Patient completed questionnaire - slot-filled response generated
const patientResponse = {
  timestamp: "2026-01-11T14:00:00Z",
  version: "3.0",
  responses: {
    CMB: [{
      CONDITION_TYPE: ["diabetes"],
      CONDITION_PATTERN: ["current"],
      SEVERITY: "none_specified",
      TIMEFRAME: null
    }],
    AGE: { age: 52 },
    BMI: {
      weight: { value: 80, unit: "kg" },
      height: { value: 170, unit: "cm" },
      bmi: 27.68
    }
  }
};

// Run matcher
const report = await runMatcher(patientResponse);

console.log(report.textReport);
// Output:
// ═══════════════════════════════════════════════════════════
//          CLINICAL TRIAL ELIGIBILITY MATCH REPORT
// ═══════════════════════════════════════════════════════════
// 
// Timestamp: 2026-01-11T14:00:00Z
// Total Trials Evaluated: 37
// Eligible Trials: 28
// Ineligible Trials: 7
// Needs Review: 2
```

### Example 2: Handling AI Flagged Results

```javascript
const results = await matcher.matchPatient(patientResponse);

// Get trials needing manual review
const needsReview = results.needsReviewTrials;

needsReview.forEach(trial => {
  console.log(`Trial: ${trial.nctId}`);
  console.log(`Confidence: ${trial.getConfidenceScore()}`);
  
  trial.flaggedCriteria.forEach(flag => {
    console.log(`  Criterion: ${flag.criterionId}`);
    console.log(`  Reasoning: ${flag.aiReasoning}`);
    console.log(`  Confidence: ${flag.confidence}`);
  });
});

// Output:
// Trial: NCT06648772
// Confidence: 0.875
//   Criterion: PTH_012
//   Reasoning: Patient's treatment "Humira" is classified as TNF inhibitor, 
//              which matches criterion requiring biologics.
//   Confidence: 0.9
```

### Example 3: React Integration

```jsx
import React, { useState } from 'react';
import ClinicalTrialEligibilityQuestionnaire from './ClinicalTrialEligibilityQuestionnaire';
import { ClinicalTrialMatcher, MatchReportGenerator } from './ClinicalTrialMatcher';

function TrialMatchingApp() {
  const [matchResults, setMatchResults] = useState(null);
  
  const handleQuestionnaireSubmit = async (patientResponse) => {
    const matcher = new ClinicalTrialMatcher();
    const results = await matcher.matchPatient(patientResponse);
    setMatchResults(results);
  };
  
  return (
    <div>
      {!matchResults ? (
        <ClinicalTrialEligibilityQuestionnaire 
          onSubmit={handleQuestionnaireSubmit}
        />
      ) : (
        <div>
          <h2>Your Matching Trials</h2>
          <div className="eligible-trials">
            <h3>Eligible: {matchResults.eligibleTrials.length}</h3>
            {matchResults.eligibleTrials.map(trial => (
              <div key={trial.nctId} className="trial-card">
                <h4>{trial.nctId}</h4>
                <p>Confidence: {(trial.getConfidenceScore() * 100).toFixed(1)}%</p>
              </div>
            ))}
          </div>
          
          {matchResults.needsReviewTrials.length > 0 && (
            <div className="needs-review">
              <h3>Needs Review: {matchResults.needsReviewTrials.length}</h3>
              <p>These trials require manual verification by a clinician.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## API Reference

### SlotFilledResponseBuilder

**Methods:**

- `addComorbidCondition(conditionType, pattern, severity, timeframe, location)`
- `addTreatmentHistory(treatmentType, pattern, timeframe, drugClassification)`
- `addInfectionHistory(infectionType, pattern, severity, timeframe, treatment)`
- `addAffectedArea(measurementType, value, threshold)`
- `setAge(age)`
- `setPsoriasisVariant(variant)`
- `setDiseaseDuration(duration, unit)`
- `setSeverityScore(scoreType, value)`
- `setWeightBMI(weight, height, weightUnit, heightUnit)`
- `getResponse()` → Returns complete slot-filled response

### ClinicalTrialMatcher

**Constructor:**
```javascript
const matcher = new ClinicalTrialMatcher(database);
```

**Methods:**

- `matchPatient(patientResponse)` → Returns `MatchResults`
  - `eligibleTrials: TrialEligibilityResult[]`
  - `ineligibleTrials: TrialEligibilityResult[]`
  - `needsReviewTrials: TrialEligibilityResult[]`
  - `totalTrialsEvaluated: number`

- `evaluateTrial(nctId, patientResponse)` → Returns `TrialEligibilityResult`
- `evaluateCriterion(criterion, patientResponse, clusterCode)` → Returns `CriterionMatchResult`

### TrialEligibilityResult

**Properties:**

- `nctId: string` - ClinicalTrials.gov identifier
- `status: 'eligible' | 'ineligible' | 'needs_review'`
- `matchedCriteria: CriterionMatchResult[]` - All evaluated criteria
- `flaggedCriteria: CriterionMatchResult[]` - AI-matched criteria requiring review

**Methods:**

- `getConfidenceScore()` → Average confidence across all matched criteria (0.0-1.0)

### MatchReportGenerator

**Static Methods:**

- `generateReport(matchResults)` → Returns human-readable text report
- `generateJSONReport(matchResults)` → Returns machine-readable JSON report

---

## Testing & Validation

### Unit Tests

```javascript
// Test exact matching
test('exact condition type match', async () => {
  const patient = {
    responses: {
      CMB: [{ CONDITION_TYPE: ['depression'], CONDITION_PATTERN: ['current'] }]
    }
  };
  
  const criterion = {
    conditions: [{
      CONDITION_TYPE: ['depression'],
      CONDITION_PATTERN: ['current', 'history']
    }]
  };
  
  const result = await matcher.evaluateCriterion(criterion, patient, 'CMB');
  expect(result.matches).toBe(true);
  expect(result.requiresAI).toBe(false);
});

// Test AI semantic matching
test('AI matches synonym', async () => {
  const patient = {
    responses: {
      CMB: [{ CONDITION_TYPE: ['heart attack'] }]
    }
  };
  
  const criterion = {
    conditions: [{
      CONDITION_TYPE: ['myocardial infarction']
    }]
  };
  
  const result = await matcher.evaluateCriterion(criterion, patient, 'CMB');
  expect(result.matches).toBe(true);
  expect(result.requiresAI).toBe(true);
  expect(result.confidence).toBeGreaterThan(0.8);
});
```

### Integration Tests

```javascript
test('full patient matching flow', async () => {
  const patientResponse = {
    // Complete response with multiple clusters
  };
  
  const results = await matcher.matchPatient(patientResponse);
  
  expect(results.totalTrialsEvaluated).toBeGreaterThan(0);
  expect(results.eligibleTrials.length + 
         results.ineligibleTrials.length + 
         results.needsReviewTrials.length)
    .toBe(results.totalTrialsEvaluated);
});
```

---

## Deployment

### Production Checklist

- [ ] Database loaded and accessible
- [ ] Medication database integrated for drug classification
- [ ] Error handling implemented for all API calls
- [ ] Loading states shown during matching
- [ ] User feedback for long-running matches
- [ ] Logging configured for debugging
- [ ] Security review completed (PII handling)
- [ ] Performance testing at scale (1000+ trials)

### Performance Considerations

**Optimization Strategies:**

1. **Caching**: Cache trial lists by cluster
2. **Parallel Processing**: Evaluate trials concurrently
3. **Early Termination**: Stop evaluating trial after first exclusion match
4. **Indexed Lookups**: Index database by NCT ID

```javascript
// Example: Parallel trial evaluation
async evaluateAllTrials(trials, patientResponse) {
  const promises = trials.map(nctId => 
    this.evaluateTrial(nctId, patientResponse)
  );
  
  return await Promise.all(promises);
}
```

---

## Troubleshooting

### Common Issues

**Issue: Too many "Needs Review" trials**
- **Cause**: Low confidence thresholds
- **Fix**: Expand synonym dictionary, improve drug classification

**Issue: Missing eligible trials**
- **Cause**: Overly strict exact matching
- **Fix**: Enable AI matching for more fields

**Issue: Incorrect exclusions**
- **Cause**: Exception conditions not evaluated properly
- **Fix**: Review exception handling logic

---

## Future Enhancements

1. **Machine Learning Integration**
   - Train ML model on historical match/review decisions
   - Improve confidence scoring accuracy

2. **Natural Language Processing**
   - Extract drug classifications from free text
   - Auto-categorize patient-reported conditions

3. **Real-time Updates**
   - Live database sync with ClinicalTrials.gov
   - Auto-refresh eligibility as trials update

4. **Multi-language Support**
   - Translate questionnaires
   - Cross-language semantic matching

---

## Support & Contact

For questions or issues:
- Review this documentation
- Check code comments in source files
- Consult field catalog: `/mnt/project/field_catalog_comprehensive.md`
- Reference slot-filled database: `/mnt/project/improved_slot_filled_database.json`

---

**END OF DOCUMENTATION**
