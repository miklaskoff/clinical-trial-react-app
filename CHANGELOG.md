# Changelog

All notable changes to the Clinical Trial Patient Matching System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [5.0.7] - 2026-01-27

### 🔧 AI Response Truncation Fix & Dropdown UI

Fixed critical bug where AI-generated treatment questions failed due to response truncation.

### Fixed

- **AI Response Truncation** - Increased `max_tokens` from 1024 to 2048 in ClaudeClient.js
  - Claude API responses were being cut off mid-JSON, causing parse failures
  - Symptom: "AI Configuration Required" error despite valid API key
  - Root cause: Complex JSON responses with slotMapping exceeded 1024 tokens

- **Markdown Code Block Parsing** - Handle responses without closing backticks
  - Added fallback parsing for `\`\`\`json` blocks that don't close properly
  - More robust JSON extraction from AI responses

### Changed

- **Radio → Dropdown Conversion** - All follow-up questions now render as dropdowns
  - Changed `type: 'radio'` to render as `<select>` elements
  - More space-efficient UI for mobile and compact displays
  - Backend post-processing ensures no `type: 'text'` questions

### Added

- **TDD Tests for Dropdown Rendering** (4 tests)
  - `dropdownRendering.test.jsx` - Verifies radio/select types render as dropdowns
  - Tests for proper option rendering and text input fields

---

## [5.0.6] - 2026-01-27

### 🗄️ Cache Parity & Structured Questions

Enhanced cache management with database persistence for conditions and structured question format with slot mapping.

### Added

- **Cache Parity for Conditions (CMB Cluster)**
  - `generateConditionFollowUpQuestions()` now stores to SQLite DB cache (matching PTH behavior)
  - Uses `condition:{conditionType}` prefix to avoid collision with treatment cache
  - DB cache lookup before generating new questions
  - Persists across server restarts

- **Version-Based Cache Invalidation**
  - New `app_version` table in SQLite to track application version
  - `checkAndInvalidateCache(currentVersion)` function clears all caches when version changes
  - Ensures stale AI responses are cleared on code updates

- **Structured Questions with Slot Mapping**
  - `deriveTimingOptions(criteria)` extracts timeframe boundaries from matched criteria
  - Generates options like "Currently taking", "Stopped within last 12 weeks", etc.
  - `slotMapping` field maps option labels to slot-filled field values
  - `postProcessQuestions()` ensures all questions have valid types (no `text` type)
  - `getDefaultQuestionsWithSlotMapping()` replaces `getDefaultQuestions()`

- **New Test Files**
  - `server/__tests__/services/FollowUpGenerator.cache.test.js` (7 tests)
  - `server/__tests__/services/FollowUpGenerator.structured.test.js` (8 tests)

### Changed

- **AI Prompt Updated** to require `slotMapping` in response format
- **Backend vitest.config.js** - Added `fileParallelism: false` to prevent database contention
- **Cache prefixes standardized**: `treatment:{drugClass}` and `condition:{conditionType}`

### Fixed

- **Cache inconsistency** - CMB (conditions) cache now persists in DB like PTH (treatments)
- **Test isolation** - Sequential test file execution prevents SQLite contention
- **Function name error** - Fixed `getDefaultQuestions is not defined` for unknown drugs

### Results

| Feature | Before | After |
|---------|--------|-------|
| CMB Cache Persistence | Memory only | Memory + SQLite DB |
| PTH Cache Persistence | Memory + SQLite DB | Memory + SQLite DB |
| Cache Invalidation | Manual only | Automatic on version change |
| Question Format | `text` type allowed | `select`/`radio` only |
| Slot Mapping | Not included | Included for all questions |

---

## [5.0.5] - 2026-01-25

### 🔍 Comprehensive Drug Criteria Search

Enhanced drug-to-criteria matching with three-level search terms (drug name, class, and generic category).

### Added

- **`getGenericSearchTerms()` function** (`DrugCategoryResolver.js`)
  - Returns higher-level classification terms for each drug type
  - Biologics: "biologic", "biologic agent", "biological therapy", "monoclonal antibody", "antibody", "mAb"
  - bDMARDs: "bDMARD", "DMARD", "biologic DMARD"
  - csDMARDs: "csDMARD", "conventional DMARD", "conventional synthetic DMARD"
  - Small molecules: "small molecule", "targeted synthetic", "tsDMARD"
  - Immunosuppressants: "immunosuppressive", "immunosuppressant"

- **Unit Tests** (`server/__tests__/services/DrugCategoryResolver.test.js`)
  - Test: `resolveDrugCategory()` for adalimumab, secukinumab, methotrexate
  - Test: `getClassSearchTerms()` for TNF, IL-17 inhibitors
  - Test: `getGenericSearchTerms()` returns correct terms per drug type
  - Test: Small molecules do NOT include biologic terms
  - Test: Unknown drugs return empty array
  - **Total: 12 new tests (all passing)**

### Changed

- **`findMatchingCriteria()` in `FollowUpGenerator.js`**
  - Now uses all three search term levels: name + class + generic
  - Deduplicates search terms with `[...new Set()]`
  - Logs term count for debugging (e.g., "23 terms" for adalimumab)

### Fixed

- **Cluster-Scoped Search** - Treatment follow-ups now ONLY search CLUSTER_PTH (not FLR or CMB)

### Results

| Drug | Search Terms | Matched Criteria |
|------|--------------|-----------------|
| adalimumab | 23 | 10 (PTH_005, PTH_009, PTH_012, PTH_013, PTH_019, PTH_020, PTH_021, PTH_025, PTH_027, PTH_030) |
| methotrexate | 9 | 3 (PTH_013, PTH_017, PTH_029) |
| IL-17A inhibitor | 6 | 2 |

### Verified

- ✅ All 75 backend tests passing
- ✅ All 345 frontend tests passing
- ✅ TDD workflow followed: tests failed first, then implemented
- ✅ Documentation updated (lesson learned, architecture guide)

---

## [5.0.4] - 2026-01-25

### 🔧 Fixed Treatment Criterion IDs Prompt

**Issue**: AI prompt inconsistency prevented criterion IDs from being reliably included in treatment follow-up questions.

### Fixed

- **Prompt Inconsistency in `FollowUpGenerator.js`** (line 169)
  - **Before**: JSON example showed `criterionIds` array but instruction said `criterionId` (singular)
  - **After**: Both example and instruction now consistently request `criterionIds` array
  - **Impact**: Claude AI now correctly includes `criterionIds: ["PTH_XXXX", "PTH_YYYY"]` in treatment questions

### Added

- **Integration Tests** (`server/__tests__/services/FollowUpGenerator.treatmentCriteria.test.js`)
  - Test: Database loading from CLUSTER_PTH
  - Test: Criteria filtering by TREATMENT_TYPE/TREATMENT_PATTERN
  - Test: criterionIds in AI responses
  - Test: Criteria context in AI prompts
  - Test: aiGenerated:false blocking behavior
  - **Total: 5 new tests (all passing)**

### Technical Details

**Root Cause**: Mixed messaging in AI prompt
```javascript
// Line 163: Shows array format
"criterionIds": ["PTH_XXXX", "PTH_YYYY"]

// Line 169: Asked for singular (INCONSISTENT!)
"include the 'criterionId' field"
```

**Solution**: Updated instruction to match example format
```javascript
"include the 'criterionIds' field as an array with ALL relevant criterion IDs"
```

### Verified

- ✅ All 404 tests passing (59 backend + 345 frontend)
- ✅ Database loading logic confirmed working (loads 7 criteria for adalimumab)
- ✅ Prompt now consistently requests array format
- ✅ Backward compatibility preserved (normalization in ClaudeClient)

### Notes

- **Discovery**: Database loading was ALREADY implemented correctly
- **Issue**: Only prompt wording was inconsistent, causing AI confusion
- **Impact**: Treatment questions should now include criterion IDs like conditions already do

---

## [5.0.3] - 2026-01-25

### 🎯 Enhanced AI Follow-Up Questions

AI-generated follow-up questions now support referencing **multiple related criteria** with a single question.

### Added

- **Multiple Criterion IDs Support** (Backend + Frontend)
  - `ClaudeClient.js`: Normalizes `criterionId` to `criterionIds` array automatically
  - `FollowUpGenerator.js`: AI prompts request `criterionIds` array for each question
  - `App.jsx`: Report displays multiple IDs as "Criteria: ID1, ID2, ID3"
  - Backward compatible with old single-ID format

- **Integration Tests** (`src/__tests__/integration/multipleCriterionIds.test.jsx`)
  - Test: Multiple IDs in CMB cluster (conditions)
  - Test: Multiple IDs in PTH cluster (treatments)
  - Test: Backward compatibility with old format
  - Test: Graceful handling of missing IDs
  - **Total: 4 new tests**

### Changed

- AI can now consolidate related criteria intelligently
  - Example: "gastritis for 2 years" + "gastritis for 23 months" → ONE question: "How long have you had gastritis?"
  - Question labeled with BOTH criterion IDs: `(Criteria: CMB_2391, CMB_2392)`

### Verified

- ✅ All 345 tests passing (341 existing + 4 new)
- ✅ Backend normalization handles both old and new formats
- ✅ Frontend report generation supports arrays
- ✅ No breaking changes to existing functionality

---

## [5.0.2] - 2026-01-25

### 🔴 Critical Fixes + Enhanced Matching

Investigation and fix of clinical trial evaluation anomalies based on code simulation analysis.

### Added

- **Double-Negative Weight Parsing** (`ClinicalTrialMatcher.js`)
  - New `#parseWeightFromRawText()` method to parse criteria without slot-filled fields
  - Pattern detection: "must not weigh < X kg", "weighing ≤ X kg", "weighing ≥ X kg"
  - Logic inversion for double-negatives in exclusion criteria
  - Fixes BMI_1916 (NCT06979453) and NCT04772079 weight criteria bugs

- **Enhanced Synonym Matching** (`utils/array.js`, `medical-synonyms.json`)
  - Partial matching support in `arraysOverlap()` for compound medical terms
  - Substring matching and word-level matching (>3 chars)
  - New cancer-related synonyms: "malignant tumors", "breast cancer", "lung cancer", etc.
  - Fixes cancer exclusion matching (Issues 2e/4: NCT07150988)

- **Improved Report Formatting** (`App.jsx`)
  - Criterion IDs now displayed in all report sections
  - Criterion types shown (Inclusion/Exclusion/Mandatory Exclusion)
  - Updated 3 sections: non-exact matches, flagged criteria, failed/matched criteria
  - Better traceability and debugging

- **Documentation Updates** (`ARCHITECTURE_AND_MATCHING_GUIDE.md`)
  - New section: "Complex Criteria Handling" with OR-logic documentation
  - New section: "Weight Criteria with Double-Negatives"
  - Documented AI fallback behavior for OR-logic criteria

- **Investigation Documentation** (7 files)
  - Complete investigation package with factual code simulation
  - Implementation plan and analysis documents

### Fixed

- **Issue 2a:** 71kg patients incorrectly excluded by "must not weigh < 30kg" criteria
- **Issue 2e/4:** "breast cancer" now properly matches "malignant tumors" exclusion criteria
- **Issue 1:** Reports missing criterion IDs and types

### Changed

- `arraysOverlap()` signature: 3rd parameter can now be boolean `true` for partial matching
- `#evaluateComorbidity()` now uses partial matching for condition arrays
- `medical-synonyms.json` version bumped to 1.0.1

### Verified

- Investigation based on actual code simulation (no mocks)
- 7 issues analyzed with factual outputs
- 3 critical/high priority issues fixed
- 3 issues confirmed working correctly

---

## [5.0.1] - 2026-01-20

### 🔧 Cache Key Collision Fix

Fixed critical bug where treatments were showing condition questions due to cache key collisions.

### Fixed

- **ClaudeClient cache key collision** - Cache key now uses unique hash (first 50 + length + last 50) instead of just first 100 chars
- **FollowUpGenerator cache separation** - Treatment cache keys prefixed with `treatment:` to prevent collision with conditions
- **Frontend type parameter** - Treatment requests now include `type: 'treatment'` in API calls

### Verified

- Frontend tests: 328/328 passing ✅
- Backend tests: 54/54 passing ✅
- **Total: 382 tests passing**

---

## [5.0.0] - 2026-01-20

### 🔄 Major Backend Integration Release

Full Node.js/Express backend with SQLite persistence, secured API key, and admin functionality.

### Added

- **Express Backend Server** (`server/`)
  - Node.js + Express REST API on port 3001
  - SQLite database with `better-sqlite3` for persistence
  - Custom `AsyncDatabase` wrapper for async/await operations
  - Helmet security headers, CORS configuration
  - Comprehensive error handling

- **Database Schema** (`server/db.js`)
  - `approved_drugs` - Admin-approved drugs with classes
  - `followup_cache` - Cached AI follow-up questions (24h TTL)
  - `rate_limits` - Rate limiting tracking per IP/endpoint
  - `pending_reviews` - Drug reviews awaiting admin approval
  - Optimized indexes for all tables

- **API Endpoints**
  - `POST /api/match` - AI-powered patient-trial matching
  - `POST /api/match/batch` - Batch matching for multiple criteria
  - `POST /api/followups/generate` - AI-generated follow-up questions by drug
  - `POST /api/admin/login` - Password authentication with tokens
  - `GET/POST/DELETE /api/admin/drugs` - Drug CRUD operations
  - `GET/POST /api/admin/pending` - Pending review management
  - `POST /api/admin/pending/:id/approve` - Approve pending drugs
  - `GET /api/admin/stats` - Dashboard statistics

- **Rate Limiting** (`server/middleware/rateLimiter.js`)
  - SQLite-backed rate limiting with window-based tracking
  - 5 requests/minute for login (prevents brute force)
  - 100 requests/minute for admin operations
  - Standard rate limit headers (X-RateLimit-*)

- **Services**
  - `ClaudeClient.js` - Anthropic SDK wrapper with memory caching
  - `DrugCategoryResolver.js` - Drug → therapeutic class mapping
  - `FollowUpGenerator.js` - AI-driven follow-up question generation

- **Frontend BackendClient** (`src/services/api/backendClient.js`)
  - Full API client for Express backend communication
  - Authentication token management
  - Health check, match, follow-ups, admin methods
  - Error handling with graceful fallbacks

- **Backend Tests** (39 tests in `server/__tests__/`)
  - `db.test.js` - Database operations (11 tests)
  - `server.test.js` - Express server (5 tests)
  - `routes/match.test.js` - Match endpoints (5 tests)
  - `routes/followups.test.js` - Follow-up endpoints (8 tests)
  - `routes/admin.test.js` - Admin endpoints (10 tests)

### Fixed

- **Lung cancer exclusion bug** - "lung cancer" now correctly matches "malignancy" exclusion
  - Added 10+ specific cancer type synonyms
  - Each cancer type maps to 'cancer' and 'malignancy'
  - `findSynonyms()` now supports partial matching

- **AI fallback first-element bug** - Now checks ALL condition types
  - Changed from `patientTypes[0]` to iterating all types
  - AI matching uses `flatMap` to collect all terms
  - Fixed for both comorbidity and infection evaluations

### Changed

- **API Key Security** - Moved from frontend to backend-only `.env`
- **Follow-up Questions** - Now AI-generated based on drug class, cached 24h
- **Medical Synonyms** - Expanded with cancer types, melanoma, lymphoma, leukemia
- **Project Structure** - Added `server/` directory for backend

### Developer Experience

- **Strict TDD Rules** in copilot-instructions.md:
  - Tests BEFORE code changes
  - All tests must pass before commit
  - Async/await everywhere possible
  - Parallel DB operations with Promise.all()
  - Database indexes required

### Test Summary

- **Frontend**: 290 tests passing (16 test files)
- **Backend**: 39 tests passing (5 test files)
- **Total**: 329 tests

---

## [4.0.1] - 2026-01-12

### Added

- **AI Response Caching System**
  - `AIResponseCache` class with LRU eviction (max 100 entries)
  - TTL-based expiration (default 24 hours)
  - localStorage persistence with automatic restore
  - Hit/miss statistics tracking
  - Automatic cleanup of expired entries

- **E2E Testing with Playwright**
  - Added `playwright.config.js` configuration
  - Added `e2e/app.spec.js` with 8 test cases
  - Tests: app load, settings, API key persistence, navigation
  - Scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:install`

- **Confidence Breakdown UI**
  - Shows `patientValue` for each criterion
  - Shows `confidenceReason` explaining match logic
  - Adjustable confidence threshold sliders

- **32 New Tests**
  - AIResponseCache tests (16 tests)
  - ClaudeAPIClient tests (12 tests)
  - Additional App component tests (4 tests)
  - **Total: 138 tests passing**

### Changed

- `ClaudeAPIClient` now uses `AIResponseCache` instead of simple Map
- Cache responses include `fromCache: true` flag
- `getCacheStats()` method added to API client
- Test coverage configuration updated

### Removed

- Legacy files cleanup:
  - `CompleteIntegrationExample.jsx`
  - `EnhancedCompleteIntegrationExample.jsx`
  - `EnhancedIntegrationStyles.css`
  - `ClinicalTrialQuestionnaire.jsx`
  - `SYSTEM_DOCUMENTATION.md`
  - `test_inclusion_criteria.js`
  - `server.log`
  - Multiple outdated documentation files

---

## [4.0.0] - 2026-01-12

### 🔄 Major Refactoring Release

Complete project restructure following TDD principles and modern best practices.

### Added

- **New Build System**
  - Migrated from Create React App to **Vite** for faster builds
  - Added **Vitest** as test runner (Jest API compatible)
  - Added **@testing-library/react** for component testing
  - Added **MSW** for API mocking support
  - Configured **ESLint 9** with flat config
  - Configured **Prettier** for consistent formatting
  - Added **Husky** + **lint-staged** for pre-commit hooks

- **New Project Structure**
  ```
  src/
  ├── __tests__/           # All tests organized by type
  │   ├── components/      # Component tests
  │   ├── services/        # Service tests
  │   └── utils/           # Utility tests
  ├── components/          # React components
  ├── services/            # Business logic
  │   ├── api/             # API clients
  │   └── matcher/         # Matching logic
  ├── utils/               # Utility functions
  ├── data/                # JSON data
  └── styles/              # CSS files
  ```

- **Comprehensive Test Suite (106 tests)**
  - `string.test.js` - String utility tests (16 tests)
  - `array.test.js` - Array utility tests (14 tests)
  - `medical.test.js` - Medical utility tests (22 tests)
  - `drugDatabase.test.js` - Drug database tests (17 tests)
  - `results.test.js` - Result classes tests (14 tests)
  - `ClinicalTrialMatcher.test.js` - Matcher tests (13 tests)
  - `App.test.jsx` - App component tests (10 tests)

- **New Utility Modules**
  - `utils/string.js` - String normalization, comparison, truncation
  - `utils/array.js` - Array overlap, unique, groupBy, chunk
  - `utils/medical.js` - Timeframe conversion, severity matching, BMI calculation

- **Refactored Services**
  - `services/api/claudeClient.js` - Claude API wrapper with caching
  - `services/matcher/ClinicalTrialMatcher.js` - Core matching with parallel evaluation
  - `services/matcher/drugDatabase.js` - Drug classifications and synonyms
  - `services/matcher/results.js` - Result classes (CriterionMatchResult, TrialEligibilityResult)

- **Updated Configuration**
  - `vite.config.js` - Vite configuration with path aliases
  - `vitest.config.js` - Test configuration with coverage thresholds (80%)
  - `eslint.config.js` - ESLint flat config for React
  - `.prettierrc` - Prettier formatting rules
  - `.env.example` - Environment variables template

- **TDD Workflow in Copilot Instructions**
  - Mandatory test-first development
  - Commit only after tests pass
  - Double verification before commits

### Changed

- **React 18.3.1** (latest stable) - upgraded from 18.2.0
- **All async operations** now use async/await and Promise.all()
- **Parallel trial evaluation** for better performance
- **Private class fields** (#) for encapsulation
- **JSDoc comments** for better IDE support
- **Clean separation** of concerns (services/components/utils)

### Removed

- Removed `react-scripts` dependency (replaced by Vite)
- Removed legacy test file `test_inclusion_criteria.js`
- Deprecated components moved to legacy (not deleted for reference)

### Performance

- **Parallel matching** - All trials evaluated concurrently
- **Trial indexing** - Pre-built index for O(1) criterion lookup
- **API caching** - Reduced duplicate Claude API calls
- **Dynamic imports** - Lazy loading for reduced bundle size

### Security

- API keys through environment variables only
- No hardcoded secrets
- `.env` properly gitignored

---

## [3.1.0] - 2026-01-12

### Added
- **Inclusion Criteria Support** - Critical feature for evaluating required patient characteristics
  - System now handles 276 inclusion criteria (37.3% of database)
  - Updated `ClinicalTrialMatcher.evaluateTrial()` to separate inclusion/exclusion logic
  - New eligibility formula: Patient must match ALL inclusions AND avoid ALL exclusions
  - Added comprehensive documentation in `INCLUSION_CRITERIA_UPDATE.md`

- **New Database Clusters**
  - BIO (Biomarkers) - 4 criteria for lab test requirements
  - FLR (Flare History) - 52 criteria for disease flare patterns
  - Total clusters increased from 9 to 10

- **Database Validation Tools**
  - Created `test_inclusion_criteria.js` for automated database verification
  - Tests criterion structure, inclusion/exclusion counts, and data integrity
  - Validates corrected database entries

- **Comprehensive Documentation**
  - `.github/copilot-instructions.md` - GitHub Copilot integration guide
  - `DATABASE_ANALYSIS_REPORT.md` - Detailed database structure analysis
  - `INCLUSION_CRITERIA_UPDATE.md` - v3.1 implementation details
  - `CHANGELOG.md` - Version history (this file)

### Fixed
- **Critical: Questionnaire Submission Flow**
  - Fixed `ClinicalTrialEligibilityQuestionnaire` component not accepting `onSubmit` prop
  - Fixed `handleSubmit()` not calling parent callback, causing results to never display
  - Users now see loading screen → matching → results as expected
  - Issue: After submitting questionnaire, only alert appeared and user stayed on form
  - Location: `src/ClinicalTrialEligibilityQuestionnaire.jsx` lines 255, 1494-1505

- **Database Errors**
  - Fixed AGE_2365: Corrected `AGE_MIN: null, AGE_MAX: 6` to `AGE_MIN: 6, AGE_MAX: 17`
  - Fixed BMI_2366: Added missing `WEIGHT_MIN: 15, WEIGHT_UNIT: "kg"` fields
  - Location: `src/improved_slot_filled_database.json`

- **JSX Syntax Error**
  - Fixed unescaped `<` character in confidence threshold labels
  - Changed `Ignore Low Confidence (< {value}%)` to `Ignore Low Confidence (&lt; {value}%)`
  - Location: `src/EnhancedCompleteIntegrationExample.jsx` line 261

### Changed
- **Matching Logic Architecture**
  - `CriterionMatchResult.matches` now has dual interpretation:
    - For exclusions: `matches=true` means patient is ineligible
    - For inclusions: `matches=true` means patient is eligible
  - Updated `evaluateTrial()` to track inclusion/exclusion criteria separately
  - Added low-confidence handling for both criterion types

- **Database Structure**
  - Updated to v1.1 with 740 total criteria (was 403)
  - Now includes explicit `EXCLUSION_STRENGTH` field: "inclusion" or "exclusion"
  - 276 inclusion criteria, 464 exclusion criteria
  - Covers 75 unique clinical trials (NCT IDs)

- **Component Communication**
  - `ClinicalTrialEligibilityQuestionnaire` now properly accepts and calls `onSubmit` prop
  - Maintains backward compatibility with standalone usage (fallback to alert)
  - Parent component `EnhancedCompleteIntegrationExample` now receives response correctly

### Performance
- No performance regression
- Inclusion criteria evaluation uses same O(n) complexity as exclusions
- ~30 lines of code added to `ClinicalTrialMatcher.js`
- No new dependencies

### Security
- No security changes
- API key handling unchanged
- No new external dependencies

---

## [3.0.0] - 2026-01-11

### Added
- **Enhanced AI Integration with Claude API**
  - Complete pivot from OpenAI to Anthropic Claude API
  - Support for three models: Opus 4.5, Sonnet 4.5, Haiku 3.5
  - Real-time model selection in Settings UI

- **Hybrid Matching Engine** (`EnhancedAIMatchingEngine.js`)
  - Three-pass strategy: Exact → Rule-based → AI semantic
  - Drug classification database (15+ medications)
  - Medical synonym dictionary for common terms
  - Confidence scoring system (0.0-1.0)
  - Intelligent caching to reduce API costs by 70-90%

- **User-Configurable Settings**
  - Settings stage before questionnaire
  - API key input for Anthropic Claude
  - Model selection (Opus/Sonnet/Haiku)
  - Confidence threshold sliders:
    - Exclude threshold (default 80%)
    - Review threshold (default 50%)
    - Ignore threshold (default 30%)
  - Collapsible settings panel during questionnaire

- **Polished UI Components** (`EnhancedIntegrationStyles.css`)
  - Modern gradient design
  - Color-coded confidence badges
  - Smooth transitions and animations
  - Responsive layout
  - Loading spinner with status messages
  - Settings panel with visual sliders

- **Complete Integration Example** (`EnhancedCompleteIntegrationExample.jsx`)
  - Four-stage workflow: Settings → Questionnaire → Matching → Results
  - Results visualization with tabs (Eligible / Needs Review / Ineligible)
  - Export functionality (JSON and text formats)
  - Trial detail cards with confidence scores
  - AI reasoning display for flagged matches

- **Drug Classification Support**
  - TNF inhibitors: Humira, Enbrel, Remicade, etc.
  - IL-17 inhibitors: Cosentyx, Taltz
  - IL-23 inhibitors: Skyrizi, Tremfya
  - IL-12/23 inhibitors: Stelara
  - Brand/generic name matching

- **Comprehensive Documentation**
  - `INTEGRATION_GUIDE.md` - 7,500+ word technical guide
  - `QUICK_START.md` - User quickstart guide
  - Inline code comments and examples

### Changed
- **API Architecture**
  - Migrated from OpenAI API to Anthropic Claude API
  - Changed authentication: `Authorization: Bearer` → `x-api-key`
  - Updated model naming: GPT models → Claude models
  - New API endpoint: `https://api.anthropic.com/v1/messages`

- **ClinicalTrialMatcher Integration**
  - Updated constructor to accept `aiConfig` parameter
  - Replaced internal AI class with `EnhancedAIMatchingEngine` import
  - Added confidence threshold support in evaluation logic
  - Enhanced `evaluateCondition()` with AI fallback

- **Cost Optimization Strategy**
  - Prioritizes rule-based matching over AI
  - Only calls AI when exact and heuristic matching fail
  - Implements aggressive caching of AI responses
  - Allows model downgrade (Opus → Sonnet → Haiku) based on complexity

### Fixed
- Initial implementation used OpenAI API incorrectly
- Corrected to use Anthropic Claude API as intended
- Fixed UI text references from "OpenAI" to "Anthropic"

### Removed
- OpenAI API integration
- GPT model references
- Unnecessary OpenAI-specific error handling

---

## [2.0.0] - 2026-01-10 (Estimated)

### Added
- **Slot-Filled Database Architecture**
  - Structured criterion format with explicit fields
  - 9 clusters: AGE, BMI, NPV, CPD, SEV, AAO, AIC, CMB, PTH
  - 403 criteria covering multiple clinical trials

- **ClinicalTrialMatcher Core**
  - Exact slot matching logic
  - Cluster-based evaluation
  - Trial eligibility determination
  - Support for exclusion criteria only

- **Patient Questionnaire**
  - 9-cluster data collection
  - Slot-filled response builder
  - Multi-stage navigation

- **Basic AI Matching**
  - Initial AI semantic matching prototype
  - Placeholder for future enhancements

### Changed
- Migrated from rule-based text matching to slot-filled structure
- Improved matching accuracy with structured data
- Better support for complex medical conditions

---

## [1.0.0] - 2026-01-09 (Estimated)

### Added
- Initial React application setup
- Basic questionnaire UI
- Simple text-based matching
- Trial database (initial version)
- README and basic documentation

---

## Version History Summary

| Version | Date | Key Feature | Criteria Count | Trials |
|---------|------|-------------|----------------|--------|
| 3.1.0 | 2026-01-12 | Inclusion criteria support | 740 | 75 |
| 3.0.0 | 2026-01-11 | Claude API integration | 740 | 75 |
| 2.0.0 | 2026-01-10 | Slot-filled database | 403 | ~50 |
| 1.0.0 | 2026-01-09 | Initial release | ~200 | ~30 |

---

## Upgrade Notes

### Upgrading to 3.1.0 from 3.0.0

**Database Changes**:
- Replace `improved_slot_filled_database.json` with corrected version
- Database now includes `EXCLUSION_STRENGTH` field for all criteria
- 337 new criteria added (total 740)

**Code Changes**:
- `ClinicalTrialMatcher.js` - Updated eligibility logic (lines 254-314)
- `ClinicalTrialEligibilityQuestionnaire.jsx` - Fixed prop handling (lines 255, 1494-1505)
- No breaking changes to API or component interfaces

**Testing**:
- Run `node test_inclusion_criteria.js` to verify database
- Test questionnaire submission flow to confirm fix

**Migration Path**:
1. Pull latest code
2. Replace database file
3. Clear browser cache (Ctrl+Shift+Delete)
4. Restart dev server (`npm start`)
5. Test end-to-end flow

### Upgrading to 3.0.0 from 2.0.0

**Breaking Changes**:
- Must provide Anthropic API key (not OpenAI)
- Model names changed: `gpt-4` → `claude-sonnet-4-5-20250929`
- API configuration structure changed

**Migration Path**:
1. Obtain Anthropic API key from console.anthropic.com
2. Update `aiConfig` to use new format
3. Replace OpenAI model references with Claude models
4. Test with Settings → API Key flow

---

## Planned Features (Future Versions)

### Version 3.2.0 (Planned)
- [ ] Add BIO cluster questions to questionnaire UI
- [ ] Add FLR cluster questions to questionnaire UI
- [ ] Update metadata to show 10 clusters
- [ ] Batch API requests for multiple criteria
- [ ] Advanced caching with persistence (localStorage/IndexedDB)

### Version 3.3.0 (Planned)
- [ ] User authentication and patient profiles
- [ ] Save/load questionnaire progress
- [ ] Trial matching history
- [ ] Export results to PDF
- [ ] Email trial matches to patients

### Version 4.0.0 (Future)
- [ ] Real-time trial database sync with ClinicalTrials.gov API
- [ ] Multi-language support
- [ ] Mobile app (React Native)
- [ ] Healthcare provider dashboard
- [ ] Integration with EHR systems

---

## Contributing

When making changes to this project:

1. **Update this CHANGELOG** with your changes
2. **Follow semantic versioning**:
   - MAJOR: Breaking changes (API changes, removed features)
   - MINOR: New features, non-breaking changes
   - PATCH: Bug fixes, documentation updates
3. **Add database changes** to DATABASE_ANALYSIS_REPORT.md
4. **Update copilot-instructions.md** for architectural changes
5. **Run validation tests** before committing

---

## Links

- **GitHub Copilot Instructions**: [.github/copilot-instructions.md](.github/copilot-instructions.md)
- **Technical Guide**: [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)
- **Quick Start**: [QUICK_START.md](QUICK_START.md)
- **Database Analysis**: [DATABASE_ANALYSIS_REPORT.md](DATABASE_ANALYSIS_REPORT.md)
- **v3.1 Changes**: [INCLUSION_CRITERIA_UPDATE.md](INCLUSION_CRITERIA_UPDATE.md)

---

**Current Version**: 3.1.0
**Status**: Production Ready ✅
**Last Updated**: 2026-01-12
