# Clinical Trial Eligibility Questionnaire

React application for matching patients against clinical trial eligibility criteria with **AI-powered semantic matching**.

## 📦 What's Included

- **ClinicalTrialQuestionnaire.jsx** - Main questionnaire component with AI integration
- **aiSemanticMatcher.js** - AI-powered semantic matching engine
- **improved_slot_filled_database.json** - Database with 19 trials (75 criteria from CMB & PTH clusters)
- **Adjustable confidence thresholds** - Control matching sensitivity
- **Complete React setup** - All configuration files included

## 🚀 Quick Start

### Prerequisites
- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. **Extract all files** to a folder (e.g., `clinical-trial-app`)

2. **Open terminal** in that folder

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start the app:**
   ```bash
   npm start
   ```

5. **Open browser** - App will automatically open at `http://localhost:3000`

6. **(Optional) Enable AI Matching:**
   - Click "⚙️ Show AI Matching Settings"
   - Check "Enable AI-powered semantic matching"
   - Enter your OpenAI API key
   - Adjust confidence thresholds as needed
   - See [AI_MATCHING_GUIDE.md](AI_MATCHING_GUIDE.md) for details

## 📂 Project Structure

```
clinical-trial-app/
├── public/
│   └── index.html
├── src/  (create this folder and place files here)
│   ├── ClinicalTrialQuestionnaire.jsx
│   ├── improved_slot_filled_database.json
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── index.css
├── package.json
└── README.md
```

## 📋 How to Use

1. **Fill out the questionnaire** (9 steps):
   - Step 1: Comorbid Conditions
   - Step 2: Treatment History
   - Step 3: Infections
   - Step 4: Affected Area (BSA, PASI, PGA)
   - Step 5: Age
   - Step 6: Psoriasis Type
   - Step 7: Disease Duration
   - Step 8: Severity Scores
   - Step 9: Weight & BMI

2. **Click "Submit & Match Trials"**

3. **Download JSON** - Your responses are automatically downloaded

4. **View Results** - See eligible, needs review, and ineligible trials

## 🤖 AI Semantic Matching

### Features
- **Hybrid Matching**: Rule-based (exact/substring) + AI semantic analysis
- **Smart Fallback**: AI only activates when rule-based matching fails
- **Medical Understanding**: Recognizes synonyms and medical relationships
- **Confidence Scoring**: 0.0-1.0 scale with adjustable thresholds
- **Match Type Indicators**: Shows exact, substring, or ai-semantic matches
- **Cost Optimization**: Caching and batch processing reduce API costs

### Configuration
Three adjustable confidence thresholds:
- **Exclude Threshold** (default: 80%) - High confidence matches exclude patient
- **Review Threshold** (default: 50%) - Moderate matches need manual review
- **Ignore Threshold** (default: 30%) - Low confidence matches are ignored

### Example Matches
| Patient Input | Trial Criterion | Match Type | Confidence |
|---------------|-----------------|------------|------------|
| "diabetes type 2" | "diabetes mellitus" | AI Semantic | 95% |
| "hypertension" | "high blood pressure" | AI Semantic | 98% |
| "depression" | "psychoneuro-related" | AI Semantic | 85% |
| "Humira" | "adalimumab" | AI Semantic | 99% |

For complete guide, see [AI_MATCHING_GUIDE.md](AI_MATCHING_GUIDE.md)

## 🗄️ Database Status

**Current:** 19 trials, 75 criteria (2 clusters: CMB, PTH only)

**Missing:** 7 clusters not yet added

## 🛠️ Troubleshooting

### "npm: command not found"
- Install Node.js from https://nodejs.org/

### Port 3000 already in use
```bash
PORT=3001 npm start
```

### Missing dependencies
```bash
rm -rf node_modules
npm install
```

## 📝 License

Research tool - use for research purposes only.
