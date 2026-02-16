# Implementation Contract: Ad-Hoc Field Prevention System

**STATUS: ✅ COMPLETED** (2026-02-02)

## Feature: Prevent LLM Parser from Creating Ad-Hoc Fields

### Requirement (Что должно работать)

LLM parser MUST NOT invent field names, types, or values that are not defined in the schema.
All parser output fields must be validated against a whitelist of allowed fields/types.
Any ad-hoc field discovered must be flagged for admin review.

**Based on Audit Results:**

1. **Unknown Top-Level Fields:**
   - `TREATMENT_HISTORY` — needs to be added to schema

2. **Ad-Hoc nested_items.type values:**
   - `infection_category` ❌ — invented by LLM
   - `requirement` ❌ — invented by LLM
   - Valid types: `CONDITION_TYPE`, `TREATMENT_HISTORY`, `CONDITION_PATTERN`

3. **Undefined Subfields in TREATMENT_HISTORY:**
   - `requires_hospitalization`, `duration`, `count` — not in FIELD_CATALOG

4. **NEGATION_DETECTED Structure Mismatch:**
   - Schema: `is_negated`, `negated_term`, `context`
   - Parser: `negated_term`, `negation_type`, `interpretation`, `affected_fields`, `parsing_note`

### Acceptance Tests (ДОЛЖНЫ ПРОЙТИ перед завершением)

- Test file: `server/__tests__/config/output-validator.adhoc.test.js`

| Test ID | Description | Expected Behavior |
|---------|-------------|-------------------|
| T1 | Detect unknown top-level field | `{ unknownTopLevel: ['UNKNOWN_FIELD'] }` |
| T2 | Detect ad-hoc nested_items.type | `{ adhocNestedTypes: ['infection_category'] }` |
| T3 | Accept valid nested_items.type | No errors for CONDITION_TYPE |
| T4 | Detect undefined TREATMENT_HISTORY subfields | `{ undefinedSubfields: ['unknown_field'] }` |
| T5 | Validate NEGATION_DETECTED structure | Accept new schema, reject unknown fields |
| T6 | Return validation result with all issues | `{ isValid, issues: { ... } }` |
| T7 | Integration: Parser output passes validation | Real AIC output validates successfully |

### Verification Checklist

1. [x] Integration test created (NOT unit test with mocks)
2. [x] Test checks REAL behavior (not mocked validator)
3. [x] Test FAILS initially (proves it checks reality)
4. [x] After implementation test PASSES
5. [x] Manual verification with actual parser output
6. [x] Evidence: test output logged

### Anti-Patterns (ЗАПРЕЩЕНО)

- ❌ Mocking the validator to make tests pass
- ❌ Accepting any field without whitelist check
- ❌ Silent failures (must report all issues)
- ❌ Claiming "done" without running against real AIC output

### Files to Modify

1. `server/config/output-schemas.json` — ✅ Added TREATMENT_HISTORY schema, valid nested types
2. `server/config/reference-lists.json` — ✅ Added valid_nested_item_types array
3. `server/config/output-validator.js` — ✅ Added ad-hoc detection logic (6 new functions)
4. `server/config/FIELD_CATALOG_v2.1.md` — ✅ Documented all nested structures

### Definition of Done

- [x] All 7 acceptance tests pass (16 tests total)
- [x] Validator detects ALL ad-hoc fields from audit (infection_category, requirement)
- [x] Real AIC output validates without false positives (28 criteria pass, 2 have ad-hoc types)
- [x] FIELD_CATALOG documents all valid nested structures
- [x] 206 backend tests pass (+16 new)
- [x] CHANGELOG.md updated
- [ ] lesson learned.md updated if needed
- [ ] git push executed
