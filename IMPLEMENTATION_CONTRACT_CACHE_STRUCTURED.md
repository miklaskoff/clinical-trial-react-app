# Implementation Contract: Cache Parity & Structured Questions

## Feature 1: Cache Parity (CMB = PTH)

### Requirement
CMB (condition) follow-up questions should be cached in SQLite DB the same way PTH (treatment) questions are cached.

### Acceptance Tests
- Test file: `server/__tests__/services/FollowUpGenerator.cache.test.js`
- Test 1: Condition questions are stored in DB after generation
- Test 2: Condition questions are retrieved from DB cache on restart
- Test 3: Cache key uses `condition:` prefix to avoid collision with treatments

### Verification Checklist
1. [ ] Integration test created
2. [ ] Test verifies REAL DB storage (not mocked)
3. [ ] Test FAILS initially
4. [ ] After implementation test PASSES
5. [ ] Manual verification: restart server, check cache persists

---

## Feature 2: Version-Based Cache Invalidation

### Requirement
When app version changes (code update), ALL caches (memory + DB) should be cleared automatically.

### Acceptance Tests
- Test file: `server/__tests__/services/FollowUpGenerator.cache.test.js`
- Test 1: `app_version` table exists in DB
- Test 2: On version change, cache is cleared
- Test 3: On same version, cache is preserved

### Verification Checklist
1. [ ] Integration test created
2. [ ] Test verifies REAL cache clearing
3. [ ] Test FAILS initially
4. [ ] After implementation test PASSES
5. [ ] Manual verification: change version in package.json, restart, verify cache cleared

---

## Feature 3: Structured Questions with Slot Mapping

### Requirement
AI-generated questions must:
1. Use `select` type (not `text`) for timing/status questions
2. Include `slotMapping` that maps options to slot-filled values
3. Options derived from matched criteria timeframes

### Acceptance Tests
- Test file: `server/__tests__/services/FollowUpGenerator.structured.test.js`
- Test 1: Questions have type `select` for timing questions
- Test 2: Questions include `slotMapping` field
- Test 3: `slotMapping` values are valid slot-filled format
- Test 4: Options are derived from criteria TIMEFRAME fields

### Verification Checklist
1. [ ] Integration test created
2. [ ] Test verifies actual AI response structure
3. [ ] Test FAILS initially
4. [ ] After implementation test PASSES
5. [ ] Manual verification: call API, check response structure

---

## Anti-Patterns (FORBIDDEN)
- ❌ Mocking the database for cache tests
- ❌ Hardcoding options instead of deriving from criteria
- ❌ Claiming "done" without seeing it work in browser/API

---

**Created**: 2026-01-26
**Status**: In Progress
