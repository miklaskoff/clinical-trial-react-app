# Implementation Contract: Parser Testing UI

## Version: 1.0
## Date: 2026-02-02

---

## Feature Overview

A web UI for testing the clinical trial criteria parser with colleagues. Allows uploading JSON files, selecting parsing options, viewing results, and managing parsing history.

---

## Requirements (Complete List)

### Core Features
| # | Requirement | Priority |
|---|-------------|----------|
| R1 | Upload JSON file containing criteria cluster | Must |
| R2 | Show criteria count after upload | Must |
| R3 | Select cluster type (AGE, BMI, AIC, etc.) | Must |
| R4 | Select Claude model (Opus/Sonnet/Haiku) | Must |
| R5 | Select how many criteria to parse (all or N) | Must |
| R6 | Show cost estimate BEFORE parsing | Must |
| R7 | Show time estimate BEFORE parsing | Must |
| R8 | Show progress during parsing | Must |
| R9 | Show actual cost AFTER parsing | Must |
| R10 | Display results with validation status | Must |
| R11 | Download results as JSON | Must |

### Advanced Features
| # | Requirement | Priority |
|---|-------------|----------|
| R12 | Stop/Resume capability | Must |
| R13 | Save parsing history to database | Must |
| R14 | Show API balance (money remaining) | Must |
| R15 | Prompt caching support (cost savings) | Must |
| R16 | Skip already-parsed criteria (by ID) | Must |
| R17 | Track parser version per criterion | Must |
| R18 | Show current parser version in UI | Must |
| R19 | Force re-parse option (override skip) | Must |

---

## Architecture Design

### Parser Versioning

```javascript
// server/config/parser-version.js
export const PARSER_VERSION = '2.2.0';  // Matches FIELD_CATALOG version

// Parsed output includes:
{
  criterionId: 'AIC_2319',
  parsedAt: '2026-02-02T15:00:00Z',
  parserVersion: '2.2.0',
  modelUsed: 'claude-sonnet-4-5-20250929',
  parsed: { ... }
}
```

### Database Schema (SQLite)

```sql
-- Parser job history
CREATE TABLE parser_jobs (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'pending', 'running', 'paused', 'completed', 'failed'
  clusterType TEXT NOT NULL,
  modelId TEXT NOT NULL,
  totalCriteria INTEGER NOT NULL,
  parsedCount INTEGER DEFAULT 0,
  skippedCount INTEGER DEFAULT 0,
  inputFile TEXT NOT NULL,  -- Original filename
  estimatedCost REAL,
  actualCost REAL DEFAULT 0,
  parserVersion TEXT NOT NULL
);

-- Parsed criteria cache
CREATE TABLE parsed_criteria (
  criterionId TEXT PRIMARY KEY,
  nctId TEXT NOT NULL,            -- NCT ID from source trial (e.g., 'NCT06170840')
  clusterType TEXT NOT NULL,
  parsedAt TEXT NOT NULL,
  parserVersion TEXT NOT NULL,
  modelUsed TEXT NOT NULL,
  inputTokens INTEGER,
  outputTokens INTEGER,
  cacheReadTokens INTEGER DEFAULT 0,
  cacheWriteTokens INTEGER DEFAULT 0,
  costUsd REAL,
  rawInput TEXT NOT NULL,
  parsedOutput TEXT NOT NULL,
  validationStatus TEXT,  -- 'valid', 'warnings', 'errors'
  validationErrors TEXT   -- JSON array of errors
);

CREATE INDEX idx_parsed_criteria_nct ON parsed_criteria(nctId);

-- API usage tracking
CREATE TABLE api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  modelId TEXT NOT NULL,
  inputTokens INTEGER NOT NULL,
  outputTokens INTEGER NOT NULL,
  cacheReadTokens INTEGER DEFAULT 0,
  cacheWriteTokens INTEGER DEFAULT 0,
  costUsd REAL NOT NULL,
  jobId TEXT REFERENCES parser_jobs(id)
);
```

### API Endpoints

```
POST /api/parser/upload
  - Upload JSON file, returns: { jobId, criteriaCount, alreadyParsed, needsParsing }

POST /api/parser/start
  - Body: { jobId, model, count, forceReparse }
  - Starts/resumes parsing job

POST /api/parser/pause
  - Body: { jobId }
  - Pauses parsing job

GET /api/parser/status/:jobId
  - Returns job status, progress, costs

GET /api/parser/results/:jobId
  - Returns parsed criteria for job

GET /api/parser/history
  - Returns list of past jobs

GET /api/parser/balance
  - Returns: { budgetLimit, usedAmount, remaining }
  - Note: Anthropic API doesn't expose balance, so this tracks LOCAL usage

GET /api/parser/version
  - Returns: { parserVersion, fieldCatalogVersion }

DELETE /api/parser/cache/:criterionId
  - Clears cached parse for specific criterion
```

### Cost Calculation

```javascript
// Pricing per 1M tokens (as of 2026)
const PRICING = {
  'claude-opus-4-20250514': {
    input: 15.00,
    output: 75.00,
    cacheRead: 1.50,   // 90% discount
    cacheWrite: 18.75  // 25% premium
  },
  'claude-sonnet-4-5-20250929': {
    input: 3.00,
    output: 15.00,
    cacheRead: 0.30,
    cacheWrite: 3.75
  },
  'claude-3-5-haiku-20241022': {
    input: 0.80,
    output: 4.00,
    cacheRead: 0.08,
    cacheWrite: 1.00
  }
};

function calculateCost(usage, model) {
  const prices = PRICING[model];
  return (
    (usage.inputTokens / 1_000_000) * prices.input +
    (usage.outputTokens / 1_000_000) * prices.output +
    (usage.cacheReadTokens / 1_000_000) * prices.cacheRead +
    (usage.cacheWriteTokens / 1_000_000) * prices.cacheWrite
  );
}
```

### Prompt Caching Strategy

```javascript
// System prompt (FIELD_CATALOG) is ~75KB = ~18,750 tokens
// With cache_control: { type: 'ephemeral' }, cached for 5 minutes
// 
// Cost savings example (Sonnet, 30 criteria batch):
// Without cache: 30 × 18,750 × $3/1M = $1.69
// With cache: 1 × 18,750 × $3.75/1M + 29 × 18,750 × $0.30/1M = $0.07 + $0.16 = $0.23
// Savings: 86%!

// ClaudeClient already implements this - no changes needed
// Just ensure batch operations run within 5-minute window
```

---

## UI Components

### Component Tree

```
ParserPage
├── Header
│   ├── ParserVersionBadge (current: v2.2.0)
│   └── ApiBalanceIndicator ($XX.XX remaining)
├── FileUploadSection
│   ├── FileDropzone
│   ├── CriteriaCountDisplay (30 total, 10 already parsed)
│   └── ClusterTypeSelector
├── ParsingOptionsSection
│   ├── ModelSelector (Opus/Sonnet/Haiku)
│   ├── CountSelector (All / Custom N)
│   ├── ForceReparseCheckbox
│   └── CostTimeEstimate (Est: $0.23, ~2 min)
├── ActionButtons
│   ├── StartButton
│   ├── PauseButton
│   └── ResumeButton
├── ProgressSection
│   ├── ProgressBar (10/30, 33%)
│   ├── CurrentCriterion (Parsing: AIC_2319)
│   ├── SkippedCount (Skipped: 5 already parsed)
│   └── LiveCostTracker ($0.08 spent)
├── ResultsSection
│   ├── ResultsTable
│   │   ├── CriterionRow (ID, Status, Warnings, Actions)
│   │   └── ValidationIndicator (✅/⚠️/❌)
│   ├── ResultsFilter (All/Valid/Warnings/Errors)
│   └── DownloadButton
└── HistorySection
    ├── JobHistoryTable
    └── LoadJobButton
```

### UI Mockup (ASCII)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔬 Parser Testing UI                    v2.2.0  │  API: $47.32 left │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  📁 Drop JSON file here or click to upload                   │   │
│  │                                                               │   │
│  │  Supported: cluster JSON files (AGE, BMI, AIC, CMB, etc.)    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  📊 Criteria: 30 total │ 10 already parsed (v2.1.0) │ 20 new        │
│  📁 Cluster: [AIC ▼]                                                 │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  ⚙️ Parsing Options                                                  │
│                                                                      │
│  Model: ( ) Opus ($15/$75)  (●) Sonnet ($3/$15)  ( ) Haiku ($0.80)  │
│                                                                      │
│  Parse: (●) All 20 new  ( ) Custom: [____] criteria                 │
│                                                                      │
│  [ ] Force re-parse (ignore cached results)                         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 💰 Estimate: $0.23  │  ⏱️ Time: ~2 min  │  📦 Cache savings: 86% │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [ ▶️ Start Parsing ]  [ ⏸️ Pause ]  [ 📥 Resume ]                   │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  📈 Progress                                                         │
│                                                                      │
│  ████████████░░░░░░░░░░░░░░░░░░  10/30 (33%)                        │
│                                                                      │
│  🔄 Current: AIC_2319 - "History of chronic infections..."          │
│  ⏭️ Skipped: 5 (already parsed with v2.2.0)                         │
│  💵 Cost so far: $0.08                                               │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  📋 Results                                    Filter: [All ▼]       │
│                                                                      │
│  ┌────────┬──────────┬───────────────────┬─────────┬───────────────┐│
│  │ ID     │ Version  │ Status            │ Cost    │ Actions       ││
│  ├────────┼──────────┼───────────────────┼─────────┼───────────────┤│
│  │AIC_2301│ v2.2.0   │ ✅ Valid          │ $0.008  │ [View] [🔄]   ││
│  │AIC_2302│ v2.1.0   │ ⚠️ 1 warning      │ $0.007  │ [View] [🔄]   ││
│  │AIC_2303│ v2.2.0   │ ❌ 2 errors       │ $0.009  │ [View] [🔄]   ││
│  │AIC_2319│ v2.2.0   │ ✅ Valid          │ $0.008  │ [View] [🔄]   ││
│  └────────┴──────────┴───────────────────┴─────────┴───────────────┘│
│                                                                      │
│  [ 📥 Download All Results ]  [ 📥 Download Errors Only ]            │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  📜 History                                                          │
│                                                                      │
│  │ Date       │ Cluster │ Model   │ Parsed │ Cost   │ Status      │ │
│  │ 2026-02-02 │ AIC     │ Sonnet  │ 30/30  │ $0.23  │ ✅ Complete │ │
│  │ 2026-02-01 │ CMB     │ Haiku   │ 45/50  │ $0.12  │ ⏸️ Paused   │ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Tests

### Test File: `src/__tests__/components/Parser/ParserPage.test.jsx`

| Test # | Description | Verification |
|--------|-------------|--------------|
| T1 | Upload JSON shows criteria count | `screen.getByText('30 total')` |
| T2 | Shows already-parsed count | `screen.getByText('10 already parsed')` |
| T3 | Model selection updates estimate | Cost changes when model clicked |
| T4 | Cost estimate shows before start | `screen.getByText('$0.23')` |
| T5 | Start button calls API | `fetch('/api/parser/start')` |
| T6 | Pause button pauses job | Status changes to 'paused' |
| T7 | Resume continues from last | Progress increments from pause point |
| T8 | Skips already-parsed criteria | Skipped count increases |
| T9 | Force reparse parses all | No criteria skipped |
| T10 | Parser version shown in header | `screen.getByText('v2.2.0')` |
| T11 | Results show version per criterion | Each row has version |
| T12 | Download exports JSON | File contains all results |
| T13 | History loads past jobs | Job list populated |
| T14 | API balance shown | `screen.getByText('$47.32')` |

### Test File: `server/__tests__/routes/parser.test.js`

| Test # | Description | Verification |
|--------|-------------|--------------|
| T15 | POST /upload returns criteria count | `{ criteriaCount: 30 }` |
| T16 | Already-parsed criteria identified | `{ alreadyParsed: 10 }` |
| T17 | POST /start creates job | Job in database |
| T18 | GET /status returns progress | `{ parsed: 10, total: 30 }` |
| T19 | POST /pause updates status | `status: 'paused'` |
| T20 | Resume continues from pausePoint | Parsing resumes correctly |
| T21 | Cache tokens tracked | `cacheReadTokens > 0` |
| T22 | Parser version in output | `parserVersion: '2.2.0'` |
| T23 | Cost calculated correctly | Matches manual calculation |
| T24 | Balance endpoint returns usage | `{ remaining: 47.32 }` |

---

## Implementation Plan

### Phase 1: Backend Foundation (Iteration 3.1)

1. Create `server/config/parser-version.js`
2. Add parser tables to `server/db.js`
3. Create `server/routes/parser.js` with all endpoints
4. Create `server/services/ParserJobService.js`
5. Update `ClaudeClient.js` to return usage stats
6. Write backend tests (T15-T24)

### Phase 2: Frontend Components (Iteration 3.2)

1. Create `src/components/Parser/ParserPage.jsx` (main page)
2. Create `src/components/Parser/FileUpload.jsx`
3. Create `src/components/Parser/ModelSelector.jsx`
4. Create `src/components/Parser/CostEstimator.jsx`
5. Create `src/components/Parser/ProgressSection.jsx`
6. Create `src/components/Parser/ResultsTable.jsx`
7. Create `src/components/Parser/HistorySection.jsx`
8. Add route to App.jsx
9. Write frontend tests (T1-T14)

### Phase 3: Integration & Polish (Iteration 3.3)

1. WebSocket for real-time progress (or polling)
2. Error handling and retry logic
3. Export functionality
4. API balance tracking
5. E2E tests
6. Manual verification

---

## Verification Checklist

### Before Claiming Done

```markdown
□ All 24 acceptance tests pass
□ Manual test: Upload JSON → See criteria count with already-parsed
□ Manual test: Select model → See cost estimate update
□ Manual test: Start → See progress bar move
□ Manual test: Pause → Parsing stops
□ Manual test: Resume → Parsing continues from pause point
□ Manual test: Skip already-parsed → See skipped count
□ Manual test: Force reparse → All criteria parsed
□ Manual test: View result → See parsed output with version
□ Manual test: Download → Get valid JSON file
□ Manual test: Check history → See past jobs
□ Manual test: Check API balance → See remaining amount
□ Prompt caching verified (check cache stats in response)
□ CHANGELOG.md updated
□ git push executed
```

---

## Anti-Patterns (FORBIDDEN)

- ❌ Hardcoding criteria count instead of counting from file
- ❌ Skipping cache check on already-parsed criteria
- ❌ Not tracking parser version per criterion
- ❌ Losing prompt caching (must use cache_control)
- ❌ Not persisting job state for resume
- ❌ Claiming "done" without all 24 tests passing
- ❌ Not updating API usage tracking

---

## Questions Resolved

| Question | Answer |
|----------|--------|
| Stop/Resume capability? | ✅ Yes, required |
| Configurable rate limit? | Not answered - will use default 1 req/sec |
| Save parsing history? | ✅ Yes, to database |
| Show API balance? | ✅ Yes, track local usage |
| Prompt caching? | ✅ Yes, already implemented in ClaudeClient |
| Skip already-parsed? | ✅ Yes, with parser version tracking |

---

## Open Questions for User

1. **Budget limit**: Should there be a configurable budget limit that stops parsing when exceeded?
2. **Notifications**: Should parsing completion send browser notification?
3. **Concurrent users**: Will multiple colleagues use this simultaneously? (affects job isolation)

---

## Files to Create/Modify

### New Files
- `server/config/parser-version.js`
- `server/routes/parser.js`
- `server/services/ParserJobService.js`
- `server/__tests__/routes/parser.test.js`
- `src/components/Parser/ParserPage.jsx`
- `src/components/Parser/FileUpload.jsx`
- `src/components/Parser/ModelSelector.jsx`
- `src/components/Parser/CostEstimator.jsx`
- `src/components/Parser/ProgressSection.jsx`
- `src/components/Parser/ResultsTable.jsx`
- `src/components/Parser/HistorySection.jsx`
- `src/components/Parser/ParserPage.css`
- `src/__tests__/components/Parser/ParserPage.test.jsx`

### Modified Files
- `server/db.js` - Add parser tables
- `server/index.js` - Register parser routes
- `server/services/ClaudeClient.js` - Return usage stats
- `src/components/App.jsx` - Add parser route
- `CHANGELOG.md` - Document feature

---

**Status**: PLAN APPROVED, AWAITING IMPLEMENTATION
**Next Step**: User confirms open questions, then begin Phase 1
