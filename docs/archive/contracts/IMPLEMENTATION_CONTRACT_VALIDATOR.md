# Implementation Contract: Output Schema Validator

## Feature: Post-Processing Validation for LLM Parser Output

### Requirement (What must work)
1. Parser output must conform to OUTPUT_SCHEMAS.json for each cluster
2. Missing required fields must be added with correct defaults
3. Field types must be validated (arrays are arrays, objects are objects)
4. EXCLUSION_STRENGTH must ALWAYS be present for CMB cluster
5. CRITERION_TYPE must ALWAYS be present
6. Rate limiting must be handled to parse 30+ criteria without interruption

### Acceptance Tests (MUST PASS before completion)

**Test file:** `server/__tests__/config/output-validator.test.js`

| Test | Description | Status |
|------|-------------|--------|
| 1 | Validator adds missing EXCLUSION_STRENGTH | ⬜ |
| 2 | Validator adds missing CRITERION_TYPE from original | ⬜ |
| 3 | Validator converts string to array for array fields | ⬜ |
| 4 | Validator validates MEASUREMENTS structure | ⬜ |
| 5 | Validator validates NESTED_CONDITION structure | ⬜ |
| 6 | Validator returns validation report with errors/warnings | ⬜ |
| 7 | Parser integrates validator and outputs consistent schema | ⬜ |
| 8 | Rate limiter parses 30 criteria without 429 errors | ⬜ |

### Verification Checklist
- [ ] Integration test created (NOT unit test with mocks)
- [ ] Test proofs REAL behavior (not mocking tested code)
- [ ] Test FAILS initially (proves it checks reality)
- [ ] After implementation test PASSES
- [ ] Manual verification in browser/terminal
- [ ] Screenshot/evidence collected

### Anti-Patterns (FORBIDDEN)
- ❌ Mocking the validator when testing validator
- ❌ Testing "function was called" without checking result
- ❌ Claiming done without running tests
- ❌ Skipping npm run verify

### Files to Create/Modify
| File | Action |
|------|--------|
| `server/config/output-schemas.json` | CREATE |
| `server/config/output-validator.js` | CREATE |
| `server/config/universal-parser-v2.js` | MODIFY |
| `server/__tests__/config/output-validator.test.js` | CREATE |
| `server/parse-full-cluster.js` | MODIFY (rate limiting) |
| `docs/parser/validate_cmb_structure.py` | MODIFY |

---
**Date:** 2026-02-02
**Status:** In Progress
