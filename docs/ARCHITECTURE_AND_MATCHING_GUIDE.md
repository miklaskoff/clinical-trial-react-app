# Canonical Architecture Document

⚠️ This document is the SINGLE SOURCE OF TRUTH for:
- System architecture
- Component responsibilities
- Matching logic
- Inclusion/exclusion rules
- AI integration strategy

All other documentation files are supportive, partial, or derived.
If there is a conflict, THIS document takes precedence.

# Clinical Trial Matching System — Architecture & Matching Guide

# GitHub Copilot Instructions - Clinical Trial Matching System


## Project Overview


**Name**: Clinical Trial Patient Matching System
**Type**: React Web Application
**Purpose**: Match patients with suitable clinical trials using hybrid AI + rule-based matching
**Tech Stack**: React 18, Anthropic Claude API, Slot-Filled Database Architecture
**Version**: 3.1 (with Inclusion Criteria Support)


---


## Architecture Overview


### Core Components


1. **EnhancedCompleteIntegrationExample.jsx** - Main orchestrator
   - Manages 4 stages: Settings → Questionnaire → Matching → Results
   - Handles Claude API configuration
   - Coordinates between UI and matching engine


2. **ClinicalTrialEligibilityQuestionnaire.jsx** - Patient data collection
   - 10-cluster questionnaire (CMB, PTH, AIC, AAO, AGE, NPV, CPD, SEV, BMI, BIO, FLR)
   - Builds slot-filled patient responses
   - Accepts `onSubmit` prop to trigger matching


3. **ClinicalTrialMatcher.js** - Core matching logic
   - Evaluates patient eligibility against trial criteria
   - Handles BOTH inclusion and exclusion criteria
   - Returns eligible/ineligible/needs_review results


4. **EnhancedAIMatchingEngine.js** - Hybrid matching engine
   - Three-pass strategy: Exact → Rule-based → AI semantic
   - Drug classification support (TNF inhibitors, IL-17/23, biologics)
   - Confidence scoring (0.0-1.0)
   - Caching for cost reduction


5. **aiSemanticMatcher.js** - Claude API wrapper
   - Direct integration with Anthropic Claude API
   - Models: Opus 4.5, Sonnet 4.5, Haiku 3.5
   - In-memory caching


### Database Structure


**File**: `src/improved_slot_filled_database.json`


**Format**: Cluster-based with slot-filled criteria
```json
{
  "metadata": { "version": "1.1", "clusters": 10, "total_criteria": 740 },
  "CLUSTER_AGE": {
    "cluster_code": "AGE",
    "criteria": [
      {
        "id": "AGE_2447",
        "nct_id": "NCT06170840",
        "raw_text": "Age 18-75 years old",
        "AGE_MIN": 18,
        "AGE_MAX": 75,
        "AGE_UNIT": "years",
        "EXCLUSION_STRENGTH": "inclusion"
      }
    ]
  }
}
```


**Clusters**:
- AGE: Age requirements
- BMI: Body Mass Index / Weight
- CMB: Comorbidities
- PTH: Prior Treatment History
- AIC: Active Infections/Conditions
- AAO: Age at Onset / Measurements
- SEV: Severity indicators
- CPD: Condition patterns
- NPV: Negative predictors
- BIO: Biomarkers (NEW in v1.1)
- FLR: Flare history (NEW in v1.1)


---


## Critical Concepts


### Inclusion vs Exclusion Criteria


**IMPORTANT**: The system handles TWO types of criteria:


**Exclusion Criteria** (Traditional):
- Patient must NOT match
- `EXCLUSION_STRENGTH: "exclusion"` or missing field
- If patient matches → INELIGIBLE
- Example: "Has active cancer" → Patient with cancer is excluded


**Inclusion Criteria** (NEW in v3.1):
- Patient MUST match
- `EXCLUSION_STRENGTH: "inclusion"`
- If patient doesn't match → INELIGIBLE
- Example: "Age 18-75" → Patient age 16 is excluded


**Eligibility Formula**:
```
Patient is ELIGIBLE if:
  (Matches ALL inclusions) AND (Avoids ALL exclusions)
```


### Matching Strategy


**Three-Pass Hybrid Approach**:


```
Pass 1: EXACT MATCH
├─ Direct slot comparison (AGE_MIN, BMI_MIN, etc.)
├─ Confidence: 1.0
└─ Fast, no API cost


Pass 2: RULE-BASED HEURISTICS
├─ Substring matching
├─ Medical synonyms (psoriasis → plaque psoriasis)
├─ Drug classification (Humira → TNF inhibitor → adalimumab)
├─ Confidence: 0.7-0.9
└─ Fast, no API cost


Pass 3: AI SEMANTIC (if enabled)
├─ Claude API semantic analysis
├─ Understands medical context
├─ Confidence: 0.3-1.0 (from Claude)
└─ Slower, has API cost
```


**Cost Optimization**:
- Caching: Reuse previous API results
- Early termination: Stop after exact/heuristic match
- Model selection: Use Haiku for simple, Sonnet for complex


### Confidence Scoring


**Thresholds** (User-configurable):
- **Exclude threshold** (default 0.8): Auto-exclude patient
- **Review threshold** (default 0.5): Flag for manual review
- **Ignore threshold** (default 0.3): Discard low confidence


**Trial Status**:
- `eligible`: Passes all criteria, high confidence
- `ineligible`: Failed inclusion or matched exclusion
- `needs_review`: Passed but low confidence scores


---


## Code Patterns to Follow


### 1. Slot-Filled Response Structure


When building patient responses, always use slot-filled format:


```javascript
const patientResponse = {
  metadata: {
    questionnaire_version: "1.0",
    submission_date: new Date().toISOString()
  },
  responses: {
    AGE: { age: 25 },
    BMI: { bmi: 24.5, weight: 71, height: 170 },
    CMB: [
      {
        CONDITION_TYPE: ["psoriasis"],
        CONDITION_PATTERN: ["plaque"],
        SEVERITY: "moderate",
        TIMEFRAME: { value: 5, unit: "years", relation: "for" }
      }
    ],
    PTH: [
      {
        TREATMENT_TYPE: ["biologic"],
        TREATMENT_PATTERN: ["humira"],
        TIMEFRAME: { value: 2, unit: "years", relation: "for" }
      }
    ]
  }
};
```


### 2. Adding New Criteria Types


When adding a new cluster or criterion type:


1. **Update database schema** in `improved_slot_filled_database.json`
2. **Add questionnaire UI** in `ClinicalTrialEligibilityQuestionnaire.jsx`
3. **Add matching logic** in `ClinicalTrialMatcher.evaluateCondition()`
4. **Update metadata** to reflect new cluster count


Example for new cluster:
```javascript
// In ClinicalTrialMatcher.js, evaluateCondition()
else if (clusterCode === 'NEW_CLUSTER') {
  // Add matching logic here
  const value = patientData.someField;
  if (criterionCondition.THRESHOLD && value > criterionCondition.THRESHOLD) {
    matches = true;
  }
}
```


### 3. Handling Inclusion Criteria


Always check `EXCLUSION_STRENGTH` when evaluating criteria:


```javascript
// In evaluateTrial()
const inclusionCriteria = [];
const exclusionCriteria = [];


for (const criterion of criteriaForTrial) {
  const matchResult = await this.evaluateCriterion(criterion, ...);


  if (criterion.EXCLUSION_STRENGTH === 'inclusion') {
    inclusionCriteria.push(matchResult);
  } else {
    exclusionCriteria.push(matchResult);
  }
}


// Check eligibility
const failedInclusions = inclusionCriteria.filter(c => !c.matches);
const matchedExclusions = exclusionCriteria.filter(c => c.matches);


if (failedInclusions.length > 0 || matchedExclusions.length > 0) {
  status = 'ineligible';
}
```


### 4. Drug Classification Matching


Use the built-in drug database in `EnhancedAIMatchingEngine.js`:


```javascript
this.drugAliases = {
  'humira': {
    generic: 'adalimumab',
    class: 'TNF inhibitor',
    is_tnf: true,
    is_biologic: true
  },
  'cosentyx': {
    generic: 'secukinumab',
    class: 'IL-17 inhibitor',
    is_il17: true,
    is_biologic: true
  }
  // ... 15+ medications
};


// Match "patient took Humira" against "requires TNF inhibitor"
const patientDrug = this.normalizeDrugName('humira');
const criterionClass = 'tnf inhibitor';
if (this.drugAliases[patientDrug]?.class.includes(criterionClass)) {
  return { matches: true, confidence: 0.95 };
}
```


### 5. Component Communication Pattern


**Parent → Child**: Pass props
```jsx
<ClinicalTrialEligibilityQuestionnaire
  onSubmit={handleQuestionnaireSubmit}
/>
```


**Child → Parent**: Call callback
```javascript
const handleSubmit = () => {
  const response = buildSlotFilledResponse();
  if (onSubmit) {
    onSubmit(response); // Triggers parent's handler
  }
};
```


**Parent handles state transitions**:
```javascript
const handleQuestionnaireSubmit = async (response) => {
  setStage('matching'); // Show loading
  const results = await matcher.matchPatient(response);
  setMatchResults(results);
  setStage('results'); // Show results
};
```


---


## Common Tasks


### Adding a New Question to Questionnaire


1. **Add state** in `ClinicalTrialEligibilityQuestionnaire.jsx`:
```javascript
const [newField, setNewField] = useState('');
```


2. **Add UI** in the appropriate cluster section:
```jsx
<input
  type="text"
  value={newField}
  onChange={(e) => setNewField(e.target.value)}
  placeholder="Enter value..."
/>
```


3. **Add to response builder** in `buildSlotFilledResponse()`:
```javascript
responses: {
  CLUSTER_NAME: {
    ...existingFields,
    newField: newField
  }
}
```


### Adding a New Trial to Database


1. **Identify cluster** (AGE, BMI, CMB, etc.)
2. **Add criterion object** with required fields:
```json
{
  "id": "AGE_9999",
  "nct_id": "NCT12345678",
  "raw_text": "Original trial criterion text",
  "AGE_MIN": 18,
  "AGE_MAX": 65,
  "AGE_UNIT": "years",
  "EXCLUSION_STRENGTH": "inclusion"
}
```
3. **Run validation** with `test_inclusion_criteria.js`


### Debugging Matching Issues


1. **Enable console logging** (already active):
```javascript
console.log('📝 Patient Response:', response);
console.log('🔍 Matching trial:', nctId);
console.log('✅ Match result:', matchResult);
```


2. **Check browser console** (F12 → Console tab)
3. **Verify database structure** with test script:
```bash
node test_inclusion_criteria.js
```


4. **Check confidence scores** in results:
```javascript
const confidenceScore = trial.getConfidenceScore();
if (confidenceScore < 0.5) {
  console.warn('Low confidence match');
}
```


### Modifying Confidence Thresholds


Thresholds are configured in `EnhancedCompleteIntegrationExample.jsx`:


```javascript
const [confidenceThresholds, setConfidenceThresholds] = useState({
  exclude: 0.8,  // Auto-exclude if ≥80% confidence
  review: 0.5,   // Manual review if ≥50% confidence
  ignore: 0.3    // Ignore if <30% confidence
});
```


Users can adjust via UI sliders in the Settings stage.


---


## API Integration


### Claude API Configuration


**Supported Models**:
- `claude-opus-4-5-20251101` - Most capable, expensive
- `claude-sonnet-4-5-20250929` - Balanced (default)
- `claude-haiku-3-5-20241022` - Fast, cheap


**Usage**:
```javascript
const aiConfig = {
  apiKey: 'sk-ant-...',
  model: 'claude-sonnet-4-5-20250929',
  confidenceThresholds: { exclude: 0.8, review: 0.5, ignore: 0.3 }
};


const matcher = new ClinicalTrialMatcher(database, aiConfig);
const results = await matcher.matchPatient(patientResponse);
```


**API Call Format** (in `aiSemanticMatcher.js`):
```javascript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': this.apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    model: this.model,
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Compare patient: "${patientTerm}" with criterion: "${criterionTerm}"`
      }
    ]
  })
});
```


---


## Testing Guidelines


### Unit Testing Pattern


```javascript
// Test inclusion criterion matching
const criterion = {
  id: "AGE_TEST",
  nct_id: "NCT00000000",
  AGE_MIN: 18,
  AGE_MAX: 65,
  EXCLUSION_STRENGTH: "inclusion"
};


const patient = { responses: { AGE: { age: 25 } } };


const matcher = new ClinicalTrialMatcher();
const result = await matcher.evaluateCriterion(criterion, patient, 'AGE');


expect(result.matches).toBe(true); // Patient age 25 is within 18-65
expect(result.confidence).toBe(1.0); // Exact match
```


### Integration Testing


Run the validation script:
```bash
node test_inclusion_criteria.js
```


Expected output:
```
✅ Total Criteria: 740 (276 inclusions, 464 exclusions)
✅ AGE_2365: CORRECT
✅ BMI_2366: CORRECT
✅ Found 75 trials
```


### Manual Testing Workflow


1. Start app: `npm start`
2. Settings → Enter API key or disable AI
3. Questionnaire → Fill all fields
4. Submit → Verify loading screen appears
5. Results → Check eligible/ineligible/needs_review tabs
6. Console → Verify matching logs


---


## Performance Considerations


### Optimization Strategies


1. **Caching**: Reuse AI responses
```javascript
const cacheKey = `${patientTerm}::${criterionTerm}`;
if (this.cache.has(cacheKey)) {
  return this.cache.get(cacheKey);
}
```


2. **Early Termination**: Stop after exact match
```javascript
if (exactMatch.matches && exactMatch.confidence >= 0.85) {
  return exactMatch; // Don't call AI
}
```


3. **Model Selection**: Use cheaper models when possible
```javascript
const model = complexCriterion ? 'opus' : 'haiku';
```


4. **Batch Processing**: Future enhancement
```javascript
// TODO: Batch multiple criteria into single API call
const results = await this.batchEvaluate(criteria);
```


### Typical Performance


- **Without AI**: <1 second for 75 trials
- **With AI (Haiku)**: 2-5 seconds
- **With AI (Sonnet)**: 5-10 seconds
- **With AI (Opus)**: 10-20 seconds


---


## Error Handling


### Common Errors


**API Key Missing**:
```javascript
if (useAIMatching && !anthropicKey) {
  alert('Please enter API key or disable AI matching');
  return;
}
```


**Invalid API Response**:
```javascript
try {
  const results = await matcher.matchPatient(response);
  setMatchResults(results);
} catch (err) {
  console.error('❌ Matching error:', err);
  setError(err.message);
  setStage('questionnaire'); // Go back
}
```


**Database Load Error**:
```javascript
try {
  const db = require('./improved_slot_filled_database.json');
} catch (err) {
  console.error('Failed to load database:', err);
  // Use empty database or show error
}
```


---


## File Organization


```
clinical-trial-react-app/
├── .github/
│   └── copilot-instructions.md          # This file
├── public/
│   └── index.html
├── src/
│   ├── EnhancedCompleteIntegrationExample.jsx  # Main orchestrator
│   ├── ClinicalTrialEligibilityQuestionnaire.jsx  # Questionnaire UI
│   ├── ClinicalTrialMatcher.js           # Core matching logic
│   ├── EnhancedAIMatchingEngine.js       # Hybrid AI engine
│   ├── aiSemanticMatcher.js              # Claude API wrapper
│   ├── EnhancedIntegrationStyles.css     # Styles
│   ├── improved_slot_filled_database.json  # Trial criteria (740)
│   ├── App.js                            # React entry point
│   └── index.js                          # ReactDOM render
├── test_inclusion_criteria.js            # Database validation
├── CHANGELOG.md                          # Version history
├── DATABASE_ANALYSIS_REPORT.md           # Database audit
├── INCLUSION_CRITERIA_UPDATE.md          # v3.1 changes
├── INTEGRATION_GUIDE.md                  # Technical docs
├── QUICK_START.md                        # User guide
├── package.json
└── README.md
```


---


## Recent Changes (v3.1)


See [CHANGELOG.md](../CHANGELOG.md) for detailed version history.


**Latest (2026-01-12)**:
- ✅ Fixed questionnaire submission flow (onSubmit callback)
- ✅ Added inclusion criteria support (276 criteria)
- ✅ Fixed AGE_2365 and BMI_2366 database errors
- ✅ Updated ClinicalTrialMatcher eligibility logic
- ✅ Created comprehensive test suite


---


## Key Principles


1. **Always handle inclusion AND exclusion** criteria
2. **Use slot-filled format** for all patient/criterion data
3. **Three-pass matching** for cost optimization
4. **Confidence scoring** for transparency
5. **Component separation** for maintainability
6. **Console logging** for debugging
7. **Backward compatibility** for standalone components
8. **User-configurable** thresholds and API keys


---


## Getting Help


**Documentation**:
- [CHANGELOG.md](../CHANGELOG.md) - Version history
- [QUICK_START.md](../QUICK_START.md) - User guide
- [INTEGRATION_GUIDE.md](../INTEGRATION_GUIDE.md) - Technical deep dive
- [DATABASE_ANALYSIS_REPORT.md](../DATABASE_ANALYSIS_REPORT.md) - Database structure
- [INCLUSION_CRITERIA_UPDATE.md](../INCLUSION_CRITERIA_UPDATE.md) - v3.1 changes


**Key Files**:
- [ClinicalTrialMatcher.js](../src/ClinicalTrialMatcher.js) - Main matching logic
- [EnhancedAIMatchingEngine.js](../src/EnhancedAIMatchingEngine.js) - AI integration
- [improved_slot_filled_database.json](../src/improved_slot_filled_database.json) - Data


**Testing**:
```bash
# Validate database
node test_inclusion_criteria.js


# Run dev server
npm start


# Build production
npm run build
```


---


## Contact & Support


For questions about:
- **Architecture**: See INTEGRATION_GUIDE.md
- **Database**: See DATABASE_ANALYSIS_REPORT.md
- **Inclusion criteria**: See INCLUSION_CRITERIA_UPDATE.md
- **API usage**: See aiSemanticMatcher.js comments


**Version**: 3.1 (2026-01-12)
**Status**: Production Ready ✅



