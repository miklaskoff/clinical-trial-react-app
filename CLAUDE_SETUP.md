# Claude AI Semantic Matching - Quick Setup

## ✅ What Was Changed

I've updated the implementation to use **Anthropic's Claude API** instead of OpenAI, which makes much more sense since you're working in Claude Code!

## 🚀 Quick Start

### 1. Get Your Anthropic API Key

1. Go to **https://console.anthropic.com**
2. Sign in or create an account
3. Navigate to **API Keys** section
4. Click **Create Key**
5. Copy your key (starts with `sk-ant-api...`)

### 2. Run the Application

```bash
npm start
```

### 3. Configure AI Matching

1. Click **"⚙️ Show AI Matching Settings"**
2. Check **"Enable AI-powered semantic matching"**
3. Paste your **Anthropic API key**
4. Choose your **Claude model**:
   - **Opus 4.5**: Most capable, best for complex medical reasoning
   - **Sonnet 4.5**: Balanced speed/cost/quality (Recommended)
   - **Haiku 3.5**: Fastest and cheapest
5. Adjust confidence thresholds as needed

## 📊 Model Comparison

| Model | Speed | Cost | Accuracy | Best For |
|-------|-------|------|----------|----------|
| **Claude Opus 4.5** | Slower | Higher | Highest | Complex medical cases |
| **Claude Sonnet 4.5** | Fast | Medium | High | General use (Recommended) |
| **Claude Haiku 3.5** | Fastest | Lowest | Good | High-volume screening |

## 🎯 Features

### AI Semantic Matching
- **Hybrid approach**: Rule-based matching first, AI as fallback
- **Medical understanding**: Recognizes synonyms and relationships
- **Confidence scoring**: 0.0-1.0 scale with adjustable thresholds
- **Smart caching**: Reduces duplicate API calls

### Adjustable Confidence Thresholds

**Three sliders to control matching sensitivity:**

1. **Exclude Threshold** (default: 80%)
   - Match confidence ≥ 80% → Patient EXCLUDED from trial
   - High confidence matches trigger exclusion

2. **Review Threshold** (default: 50%)
   - Match confidence 50-79% → Trial NEEDS REVIEW
   - Moderate confidence requires manual verification

3. **Ignore Threshold** (default: 30%)
   - Match confidence < 30% → Match IGNORED
   - Low confidence matches don't affect eligibility

## 💡 Example Test Cases

### Test 1: Medical Synonym
**Input:** Patient has "hypertension"
**Trial excludes:** "high blood pressure"
**Expected:** Claude matches with ~95% confidence
**Result:** Patient excluded (if threshold ≤ 95%)

### Test 2: Related Condition
**Input:** Patient has "depression"
**Trial excludes:** "psychoneuro-related disease"
**Expected:** Claude matches with ~85% confidence
**Result:** Patient excluded (if threshold ≤ 85%)

### Test 3: Treatment Name
**Input:** Patient took "Humira"
**Trial excludes:** "adalimumab"
**Expected:** Claude matches with ~99% confidence (brand vs generic)
**Result:** Patient excluded

## 💰 Cost Estimates

### Anthropic Claude Pricing (as of 2025)

**Sonnet 4.5** (Recommended):
- Input: ~$3 per million tokens
- Output: ~$15 per million tokens
- **Per questionnaire: ~$0.005-0.015**

**Haiku 3.5** (Budget):
- Input: ~$0.25 per million tokens
- Output: ~$1.25 per million tokens
- **Per questionnaire: ~$0.001-0.003**

**Opus 4.5** (Premium):
- Input: ~$15 per million tokens
- Output: ~$75 per million tokens
- **Per questionnaire: ~$0.02-0.05**

### Cost Optimization Tips
1. Use Sonnet for balanced performance
2. Use Haiku for high-volume screening
3. Higher ignore threshold = fewer AI calls
4. Caching reduces repeat API calls

## 🔧 Troubleshooting

### "API key not configured" error
- Make sure you've entered the key in the UI
- Key should start with `sk-ant-api...`
- Check that AI matching checkbox is enabled

### "Rate limit exceeded"
- Wait a few minutes between submissions
- Check your Anthropic account usage limits
- Consider upgrading your Anthropic plan

### Unexpected confidence scores
- Claude models can have different reasoning
- Check the AI reasoning explanation
- Try adjusting thresholds for your use case
- Different models may give slightly different scores

## 🎨 How to Adjust Thresholds

### Conservative (Fewer False Positives)
```
Exclude:  90%  ████████████████████|██
Review:   70%  ███████████████|█████████
Ignore:   40%  ████████|████████████████
```
**Result:** More trials eligible, fewer false exclusions

### Balanced (Recommended)
```
Exclude:  80%  ████████████████|████████
Review:   50%  ██████████|██████████████
Ignore:   30%  ██████|████████████████████
```
**Result:** Good balance of sensitivity/specificity

### Aggressive (Catch More Matches)
```
Exclude:  70%  ██████████████|██████████
Review:   40%  ████████|████████████████
Ignore:   20%  ████|████████████████████
```
**Result:** More trials in review, catches edge cases

## 📝 What Changed from OpenAI

### Technical Changes:
1. **API Endpoint**: `api.openai.com` → `api.anthropic.com`
2. **Authentication**: `Authorization: Bearer` → `x-api-key`
3. **Request Format**: Chat Completions → Messages API
4. **Model Names**: `gpt-4o-mini` → Claude model names
5. **Response Format**: `choices[0].message.content` → `content[0].text`

### UI Changes:
1. Label changed to "Anthropic API Key"
2. Added Claude model selector dropdown
3. Updated placeholder to `sk-ant-api...`
4. Updated help text and links

### Benefits of Claude:
- ✅ More consistent with your workflow (Claude Code)
- ✅ Excellent medical reasoning capabilities
- ✅ Flexible model options (Opus/Sonnet/Haiku)
- ✅ Competitive pricing
- ✅ Strong performance on complex medical relationships

## 🚦 Quick Verification

After setup, test with this simple case:

1. **Enable AI matching** with your Anthropic key
2. **Step 1**: Enter condition: `diabetes type 2`
3. **Complete steps 2-9** with any values
4. **Submit** and check results
5. **Expected**: Should match trials excluding "diabetes mellitus" with high confidence

## 📚 Additional Resources

- **Anthropic Console**: https://console.anthropic.com
- **Claude API Docs**: https://docs.anthropic.com
- **Model Comparison**: https://docs.anthropic.com/models
- **Pricing**: https://www.anthropic.com/pricing

## ✅ Summary

You now have:
- ✅ Claude API integration (Opus, Sonnet, Haiku)
- ✅ Model selector in UI
- ✅ Adjustable confidence thresholds (3 sliders)
- ✅ Hybrid matching (rules + AI)
- ✅ Detailed results with confidence scores
- ✅ Cost-effective implementation with caching

**Ready to test!** Just get your Anthropic API key and start matching! 🎉
