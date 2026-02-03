# Implementation Contract: Parser UI Polling Fix

## Feature: Parser Cost & Download Button Update

### Requirement (Что должно работать)
1. **Cost Display**: Progress bar must show actual cost (`$X.XX spent`) updating during parsing
2. **Download Button**: Must appear when job completes with results

### Root Cause Analysis
The `useEffect` hook that manages polling (lines 80-95 in ParserPage.jsx) has a race condition:
- When `fetchJobStatus()` receives `status: 'completed'`, it calls `setJobStatus('completed')`
- This triggers useEffect re-run with `jobStatus === 'completed'`
- useEffect immediately clears the polling interval
- But `setCurrentCost()` and `fetchJobResults()` may not have completed yet

### Acceptance Tests (ДОЛЖНЫ ПРОЙТИ перед завершением)
- Test file: `e2e/parser-polling.spec.js`
- Test 1: Cost updates during parsing (from $0.00 to actual cost)
- Test 2: Download button appears after job completes
- Test 3: Results table displays after completion

### Solution Design
1. **Don't clear polling on status change** - Move clearInterval inside fetchJobStatus
2. **Explicit final fetch** - When detecting completion, await fetchJobResults before clearing
3. **Add ref to track completion** - Prevent race between state update and interval clear

### Verification Checklist
1. [ ] E2E test created (tests ACTUAL browser behavior)
2. [ ] E2E test FAILS initially (proves it tests real behavior)
3. [ ] Fix implemented
4. [ ] E2E test PASSES after fix
5. [ ] Manual verification in browser with screenshot
6. [ ] lesson learned.md updated

### Anti-Patterns (ЗАПРЕЩЕНО)
- ❌ Unit test with mocked fetch that doesn't test real polling
- ❌ Claiming "done" without seeing Download button in browser
- ❌ Testing only that setCurrentCost is called, not that UI displays it

### Files to Modify
- `src/components/Parser/ParserPage.jsx` - Fix polling useEffect
- `e2e/parser-polling.spec.js` - New E2E test
