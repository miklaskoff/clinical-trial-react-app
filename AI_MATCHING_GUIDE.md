# AI Semantic Matching Guide

## Overview

This application now includes **AI-powered semantic matching** using OpenAI's GPT models to improve clinical trial eligibility matching accuracy. When exact string matching fails, the AI can understand medical relationships and synonyms.

## Features

### 1. **Hybrid Matching Strategy**
- **Rule-based matching** (exact and substring) runs first
- **AI semantic matching** activates only when rule-based matching fails
- Reduces API costs by using AI only when necessary

### 2. **Adjustable Confidence Thresholds**
You can control how confidence scores affect trial eligibility:

| Threshold | Default | Purpose |
|-----------|---------|---------|
| **Exclude** | 80% | Confidence ≥ 80% = Patient is excluded from trial |
| **Review** | 50% | Confidence 50-79% = Trial needs manual review |
| **Ignore** | 30% | Confidence < 30% = Match is ignored (too weak) |

### 3. **Match Type Indicators**
Results display the matching method used:
- `exact` - Exact string match (100% confidence)
- `substring` - Substring/partial match (85-90% confidence)
- `ai-semantic` - AI-determined semantic match (varies)

## Setup Instructions

### Step 1: Get an OpenAI API Key

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

### Step 2: Configure the Application

You have two options:

#### Option A: Enter API Key in UI (Recommended)
1. Start the application: `npm start`
2. Click "⚙️ Show AI Matching Settings"
3. Check "Enable AI-powered semantic matching"
4. Paste your API key in the "OpenAI API Key" field
5. Adjust confidence thresholds if desired

#### Option B: Use Environment Variable
1. Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and add your key:
   ```
   REACT_APP_OPENAI_API_KEY=sk-your-api-key-here
   ```
3. Restart the application

**Security Note:** The API key is only used client-side (in your browser) and is never sent to any server except OpenAI's API.

## How It Works

### Matching Flow

```
Patient Input: "diabetes type 2"
Trial Criterion: "diabetes mellitus"

Step 1: Exact Match?
→ No ("diabetes type 2" ≠ "diabetes mellitus")

Step 2: Substring Match?
→ Partial ("diabetes" is common)
→ Confidence: 85%

If AI enabled and no rule match:
Step 3: AI Semantic Analysis
→ Analyzes medical relationship
→ Result: "Type 2 diabetes is a form of diabetes mellitus"
→ Confidence: 95%
```

### AI Prompt Engineering

The AI matcher uses specialized medical prompts:
- Analyzes semantic equivalence
- Considers medical synonyms and relationships
- Provides confidence scores with reasoning
- Returns structured JSON responses

## Cost Considerations

### API Usage
- Model: `gpt-4o-mini` (cost-effective)
- Average cost: ~$0.01-0.02 per questionnaire
- Caching reduces duplicate API calls
- Only calls API when rule-based matching fails

### Optimization Tips
1. **Use caching**: The app caches AI results during the session
2. **Adjust thresholds**: Higher ignore threshold = fewer AI calls
3. **Batch processing**: AI calls are batched per trial for efficiency

## Confidence Threshold Tuning

### Conservative Configuration (Fewer False Positives)
```
Exclude: 90%
Review: 70%
Ignore: 40%
```
- Stricter matching
- More trials marked "eligible"
- Fewer false exclusions

### Aggressive Configuration (Catch More Matches)
```
Exclude: 70%
Review: 40%
Ignore: 20%
```
- Broader matching
- More trials marked "needs review"
- May catch edge cases

### Balanced Configuration (Default)
```
Exclude: 80%
Review: 50%
Ignore: 30%
```
- Good balance of sensitivity and specificity
- Recommended for most use cases

## Example Scenarios

### Scenario 1: Clear Medical Synonym
```
Patient: "hypertension"
Criterion: "high blood pressure"

Rule Match: None
AI Match: YES
Confidence: 98%
Reasoning: "Hypertension is the medical term for high blood pressure"
Result: EXCLUDE (if threshold ≤ 98%)
```

### Scenario 2: Related Condition
```
Patient: "depression"
Criterion: "psychoneuro-related disease"

Rule Match: None
AI Match: YES
Confidence: 85%
Reasoning: "Depression is a psychoneurological disorder"
Result: EXCLUDE (if threshold ≤ 85%)
```

### Scenario 3: Unrelated Terms
```
Patient: "headache"
Criterion: "cancer"

Rule Match: None
AI Match: NO
Confidence: 5%
Reasoning: "No meaningful medical relationship"
Result: IGNORE
```

## Results Interpretation

### Match Details Display

Each match shows:
1. **Confidence Badge** - Visual indicator of match strength
   - Red (90-100%): Very strong match
   - Orange (70-89%): Strong match
   - Yellow (50-69%): Moderate match

2. **Match Type Badge** - How the match was found
   - `EXACT`: Perfect string match
   - `SUBSTRING`: Partial string match
   - `AI-SEMANTIC`: AI-determined match

3. **Reasoning** - Explanation of why it matched
   - Rule-based: Shows matched terms
   - AI-based: Shows medical reasoning

### Trial Status Categories

| Status | Meaning | Action |
|--------|---------|--------|
| ✓ **Eligible** | No exclusion criteria matched | Patient may qualify |
| ⚠ **Needs Review** | Moderate-confidence matches | Manual review required |
| ✗ **Ineligible** | High-confidence exclusion match | Patient likely excluded |

## Troubleshooting

### AI Matching Not Working

**Problem:** Checkbox is checked but no AI matches appear

**Solutions:**
1. Verify API key is entered correctly
2. Check browser console for errors (F12)
3. Ensure you have OpenAI API credits
4. Try disabling browser extensions

### Too Many API Errors

**Problem:** Getting rate limit or quota errors

**Solutions:**
1. Reduce the number of conditions/treatments entered
2. Wait a few minutes between submissions
3. Check your OpenAI account usage limits
4. Consider upgrading your OpenAI plan

### Unexpected Confidence Scores

**Problem:** AI giving surprising confidence values

**Solutions:**
1. AI models can be uncertain - use review threshold
2. Adjust thresholds to be more conservative
3. Medical terms can have nuanced relationships
4. Check the AI reasoning for explanation

## Privacy & Security

- ✅ API key is stored in browser memory only (not on disk)
- ✅ Patient data is sent only to OpenAI (via HTTPS)
- ✅ No data is stored on remote servers
- ✅ All processing happens client-side
- ⚠️ OpenAI may use data for model improvement (check their policy)
- ⚠️ For production use, consider server-side API key management

## Best Practices

1. **Start with defaults**: Use default thresholds initially
2. **Review "needs review"**: Always manually check moderate-confidence matches
3. **Monitor costs**: Track OpenAI API usage regularly
4. **Test thoroughly**: Validate AI matches with medical experts
5. **Document decisions**: Keep records of threshold configurations used
6. **Update regularly**: Check for new model versions from OpenAI

## Technical Details

### Model Configuration
```javascript
{
  model: 'gpt-4o-mini',
  temperature: 0.3,  // Low for consistency
  max_tokens: 200    // Concise responses
}
```

### API Response Format
```json
{
  "match": true,
  "confidence": 0.85,
  "reasoning": "Depression is a psychoneurological disorder"
}
```

### Caching Strategy
- In-memory cache per session
- Key: `patientTerm::criterionTerm` (lowercase)
- Cleared on page reload
- Reduces duplicate API calls

## Support

For issues or questions:
1. Check this guide first
2. Review browser console for errors
3. Test with AI disabled to isolate issues
4. Check OpenAI API status: [status.openai.com](https://status.openai.com)

## Future Enhancements

Potential improvements:
- [ ] Support for other AI providers (Anthropic, etc.)
- [ ] Persistent caching across sessions
- [ ] Confidence score calibration
- [ ] Medical knowledge base integration
- [ ] Batch processing for multiple patients
- [ ] Export AI reasoning to reports
