# Implementation Contract

## Feature 1: Remove Hardcoded Base Questions from PTH Cluster

### Requirement (Что должно работать)
When user adds a treatment and AI generates follow-up questions, ONLY AI-generated questions should appear. The hardcoded "default questions" (pattern, timeframe, response) must be removed.

### Acceptance Tests (ДОЛЖНЫ ПРОЙТИ перед завершением)
- Test file: `src/__tests__/integration/pthQuestionsOnlyAI.test.jsx`
- Test 1: PTH cluster renders ONLY AI questions when aiGenerated: true
- Test 2: PTH cluster shows blocking message when aiGenerated: false
- Test 3: No hardcoded "Are you currently using" question appears
- Test 4: No hardcoded "When did you last use" question appears
- Test 5: No hardcoded "How did you respond" dropdown appears

### Verification Checklist
1. [ ] Integration test created (NOT unit test with mocks)
2. [ ] Test checks ACTUAL DOM TEXT (not just function calls)
3. [ ] Test FAILS initially (proves it checks reality)
4. [ ] After implementation test PASSES
5. [ ] Manual verification in browser
6. [ ] Screenshot/evidence collected

### Anti-Patterns (ЗАПРЕЩЕНО)
- ❌ Mock the renderTreatmentFollowUps function
- ❌ Check only that component renders
- ❌ Assume code works without seeing browser

---

## Feature 2: Label AI-Generated Questions in Clinical Trial Report

### Requirement (Что должно работать)
After questionnaire submission, the clinical trial matching report must show:
1. Which follow-up questions were AI-generated (with "🤖 AI" label)
2. Which criterion IDs triggered each follow-up question
3. Clear distinction between AI and non-AI questions

### Acceptance Tests (ДОЛЖНЫ ПРОЙТИ перед завершением)
- Test file: `src/__tests__/integration/reportAILabeling.test.jsx`
- Test 1: Report displays "🤖 AI-generated" label for AI questions
- Test 2: Report shows criterion IDs that triggered questions
- Test 3: AI questions grouped by criterion ID
- Test 4: Non-AI questions (if any) not labeled as AI

### Verification Checklist
1. [ ] Integration test created (NOT unit test with mocks)
2. [ ] Test verifies ACTUAL REPORT CONTENT
3. [ ] Test FAILS initially
4. [ ] After implementation test PASSES
5. [ ] Manual verification in browser
6. [ ] Screenshot of report with AI labels

### Anti-Patterns (ЗАПРЕЩЕНО)
- ❌ Mock the report generation
- ❌ Test only that label string exists in code
- ❌ Skip manual verification of report UI

---

## Contract Workflow

1. PLAN → ✅ Contract created
2. VERIFY FAIL → Write tests, confirm they FAIL
3. IMPLEMENT → Make tests pass
4. VERIFY PASS → All tests green
5. MANUAL TEST → Open browser, verify both features
6. EVIDENCE → Screenshots
7. COMMIT → Only after all steps

---

## Definition of Done

- [ ] All tests pass (including existing ones)
- [ ] Manual verification completed
- [ ] Screenshots captured
- [ ] copilot-instructions.md updated
- [ ] lesson learned.md updated (if new lessons)
- [ ] ARCHITECTURE_AND_MATCHING_GUIDE.md updated
- [ ] npm run verify passes
