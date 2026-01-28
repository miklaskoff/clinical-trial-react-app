# Manual Verification Guide - Treatment Criterion IDs Fix (v5.0.4)

## 🎯 What We're Testing

Verify that AI-generated follow-up questions for **treatments** now include criterion IDs in the report, just like conditions already do.

**Fix Applied**: Updated AI prompt in `FollowUpGenerator.js` to consistently request `criterionIds` array format (was inconsistent: example showed array, instruction said singular).

---

## ✅ Pre-Verification Checklist

- [x] All 404 tests passing (59 backend + 345 frontend)
- [x] Frontend running: http://localhost:3000
- [x] Backend running: http://localhost:3001
- [x] API key configured in backend

---

## 📋 Verification Steps

### Step 1: Open Application

1. Open browser: **http://localhost:3000**
2. You should see the Clinical Trial Matching System

### Step 2: Add a Treatment (Adalimumab)

1. Click "Start Questionnaire" or navigate to questionnaire
2. Scroll to **"Previous treatments (past treatment history)"** section
3. In the treatment input field, type: **adalimumab**
4. Click **"Add Treatment"** button
5. **Watch for loading indicator** - AI is generating questions

### Step 3: Answer Follow-Up Questions

1. You should see AI-generated questions like:
   - "Are you currently taking adalimumab?"
   - "When did you last receive a dose?"
   - "How did you respond to this treatment?"

2. Answer each question (any answer is fine for testing)

### Step 4: Complete Questionnaire

1. Fill in any other required fields (age, gender, etc.)
2. Click **"Generate Matching Report"** or similar button
3. Wait for matching to complete

### Step 5: CHECK THE REPORT ⚠️ CRITICAL

In the generated report, look for the **"Previous treatments"** section:

**EXPECTED OUTPUT** (✅ Success):
```
• Previous treatments: 1 reported
  - adalimumab (TNF_inhibitors)
    🤖 AI Follow-up Questions:
      - Are you currently taking adalimumab? → [answer] (Criteria: PTH_XXXX, PTH_YYYY)
      - When did you last receive a dose? → [answer] (Criteria: PTH_XXXX)
      - How did you respond? → [answer] (Criteria: PTH_ZZZZ)
```

**FAILURE INDICATORS** (❌ Bug):
```
• Previous treatments: 1 reported
  - adalimumab (TNF_inhibitors)
    🤖 AI Follow-up Questions:
      - Are you currently taking adalimumab? → [answer]
      - When did you last receive a dose? → [answer]
      - How did you respond? → [answer]
```
⚠️ **NO `(Criteria: PTH_XXXX)` labels** = Fix did NOT work!

### Step 6: Take Screenshot

1. Scroll to show the **entire treatment section with criterion IDs**
2. Screenshot should clearly show:
   - Treatment name: adalimumab
   - AI-generated questions
   - **Criterion IDs in parentheses**: `(Criteria: PTH_XXXX)`

3. Save as: `evidence_treatment_criterionids.png`

---

## 🔍 What to Look For

### Success Criteria (ALL must be true):

1. ✅ Treatment "adalimumab" appears in report
2. ✅ Questions are under `🤖 AI Follow-up Questions:` label
3. ✅ Each question shows `(Criteria: PTH_XXXX)` or similar
4. ✅ Criterion IDs start with `PTH_` (treatment cluster)
5. ✅ At least ONE question has a criterion ID

### Bonus Check:

If a question addresses multiple criteria, it should show multiple IDs:
- `(Criteria: PTH_1234, PTH_5678)` ✅ Excellent!

---

## 🐛 Troubleshooting

### Problem: No AI questions, only "Loading..."

**Solution**: 
- Wait 5-10 seconds for AI to respond
- Check backend terminal for errors
- Verify API key is configured: `GET http://localhost:3001/api/config/apikey/status`

### Problem: Default questions instead of AI

**Example**: "Are you currently taking this medication?" (generic)

**Cause**: AI not configured or failed
**Solution**: 
- Check backend terminal for: `⚠ AI not configured`
- Verify `.env` file in `server/` has `ANTHROPIC_API_KEY`

### Problem: AI questions but NO criterion IDs

**This is the bug we're testing for!**

**If this happens**:
1. Check backend terminal for: `🤖 Generating AI questions for drug: adalimumab`
2. Look for log: `✅ AI generated X questions for drug: adalimumab`
3. Screenshot the report showing MISSING criterion IDs
4. Report as: "Fix did NOT work, criterion IDs still missing"

---

## 📊 Backend Logs to Check

When you add adalimumab, backend should log:

```
🤖 Generating AI questions for drug: adalimumab (class: TNF_inhibitors)
📋 Raw AI response questions: [
  {
    "id": "q1",
    "text": "Are you currently taking adalimumab?",
    "criterionIds": ["PTH_XXXX", "PTH_YYYY"]  <-- MUST BE PRESENT
  }
]
✅ AI generated 3 questions for drug: adalimumab
```

**Check for**:
- `criterionIds` field in raw response ✅
- Array format: `["PTH_XXXX"]` ✅
- NOT singular: `"criterionId": "PTH_XXXX"` ❌

---

## 📸 Screenshot Checklist

Before submitting screenshot, verify it shows:

- [ ] Browser URL: http://localhost:3000
- [ ] Report section: "Previous treatments"
- [ ] Treatment name: adalimumab
- [ ] 🤖 AI Follow-up Questions label
- [ ] At least 2-3 questions listed
- [ ] Criterion IDs visible: `(Criteria: PTH_XXXX)`
- [ ] Clear, readable text (zoom if needed)

---

## ✅ Expected Outcome

**If fix worked**:
- Criterion IDs appear for treatment questions ✅
- IDs start with `PTH_` ✅
- Format matches condition questions (already working) ✅

**Success Message**: 
> "Treatment criterion IDs verified! Fix successful. ✅"

**Evidence**: Screenshot showing criterion IDs

---

## 🚀 Ready to Test!

1. Frontend: http://localhost:3000 (running)
2. Backend: http://localhost:3001 (running)
3. Test treatment: adalimumab
4. Expected result: Criterion IDs in report
5. Screenshot: evidence_treatment_criterionids.png

**Good luck! 🎯**
