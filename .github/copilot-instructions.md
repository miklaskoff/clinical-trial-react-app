# Copilot Instructions — Clinical Trial Matching System

## ⚠️ MANDATORY DEVELOPMENT RULES — КРИТИЧЕСКИ ВАЖНО

### TDD (Test-Driven Development) — СТРОГО ОБЯЗАТЕЛЬНО

1. **ПЕРЕД каждым изменением** — СНАЧАЛА напиши тест
2. **После каждого изменения** — запусти ВСЕ тесты (`npm test`)
3. **Тесты не прошли?** — ❌ НЕ КОММИТЬ. Исправь код до прохождения
4. **Тесты прошли?** — Проверь результат **ДВАЖДЫ**, потом коммить
5. **Нельзя заканчивать работу** — пока ВСЕ тесты не пройдены
6. **Каждое изменение = набор тестов** — добавляй в соответствующую тестовую группу

---

## ⚠️ IMPLEMENTATION CONTRACT SYSTEM — КРИТИЧЕСКИ ВАЖНО

### Почему это нужно

Unit тесты с моками могут проходить, но реальная интеграция не работает.
**Implementation Contract** гарантирует, что каждая фича действительно работает end-to-end.

### Contract Template — ОБЯЗАТЕЛЬНО для каждой фичи

Перед реализацией любой фичи, создай Implementation Contract:

```markdown
## Feature: [Название]

### Requirement (Что должно работать)
[Точное описание требования]

### Acceptance Tests (ДОЛЖНЫ ПРОЙТИ перед завершением)
- Test file: `path/to/integration/test.js`
- Test 1: [конкретное поведение]
- Test 2: [конкретное поведение]

### Verification Checklist
1. [ ] Integration test создан (НЕ unit test с моками)
2. [ ] Test проверяет РЕАЛЬНОЕ поведение (не мокает тестируемый код)
3. [ ] Test FAILS изначально (доказывает, что проверяет реальность)
4. [ ] После реализации test PASSES
5. [ ] Manual verification в браузере
6. [ ] Screenshot/evidence собран

### Anti-Patterns (ЗАПРЕЩЕНО)
- ❌ Мокать тестируемый компонент
- ❌ Тестировать "component renders" без проверки что именно рендерится
- ❌ Проверять что функция вызвана, без проверки результата
- ❌ Считать done когда тесты прошли, без manual verification
```

### Contract Workflow — ПОРЯДОК ДЕЙСТВИЙ

```
1. PLAN → Создай Implementation Contract с acceptance tests
2. VERIFY FAIL → Запусти тесты, убедись что FAIL (иначе тест бесполезен)
3. IMPLEMENT → Напиши код чтобы тесты прошли
4. VERIFY PASS → Все тесты проходят
5. MANUAL TEST → Проверь в браузере/Postman вручную
6. EVIDENCE → Сделай screenshot или лог как доказательство
7. COMMIT → Только после всех шагов
```

### Integration Test Rules — СТРОГО

```javascript
// ✅ CORRECT - тестирует реальную интеграцию
it('frontend calls backend for API key storage', async () => {
  const fetchSpy = vi.spyOn(global, 'fetch');
  
  // Действие
  await user.type(screen.getByLabelText('API Key'), 'sk-test');
  await user.click(screen.getByText('Save'));
  
  // Проверка: fetch вызван с правильным URL
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining('/api/config/apikey'),
    expect.any(Object)
  );
  
  // Проверка: localStorage НЕ содержит ключ
  expect(localStorage.getItem('api_key')).toBeNull();
});

// ❌ WRONG - мокает то, что тестируем
it('saves API key', async () => {
  const mockSave = vi.fn();
  render(<Settings onSave={mockSave} />);
  
  await user.click(screen.getByText('Save'));
  
  expect(mockSave).toHaveBeenCalled(); // Ничего не доказывает!
});
```

### Verification Commands — ЗАПУСКАТЬ ПЕРЕД COMMIT

```bash
# АВТОМАТИЧЕСКАЯ ПРОВЕРКА (ОБЯЗАТЕЛЬНО)
npm run verify

# Это запускает scripts/verify-implementation.ps1 который проверяет:
# 1. Все тесты проходят
# 2. Нет прямых вызовов Anthropic из frontend
# 3. Нет API ключей в localStorage
# 4. Backend доступен (опционально)
# 5. Integration тесты проходят
# 6. Все необходимые файлы существуют
```

### ⚠️ ОБЯЗАТЕЛЬНЫЙ WORKFLOW ПЕРЕД COMMIT

```
1. npm run verify         ← ОБЯЗАТЕЛЬНО, не пропускай!
2. Открой браузер         ← Manual verification
3. Проверь каждый пункт   ← Screenshot как доказательство
4. git add -A && git commit -m "..."  ← ТОЛЬКО после шагов 1-3
```

### Contract Report — ГЕНЕРИРУЙ ПОСЛЕ КАЖДОЙ ФИЧИ

```markdown
## CONTRACT REPORT: [Feature Name]

| Requirement | Test File | Test Name | Status |
|-------------|-----------|-----------|--------|
| [Req 1] | [file.test.js] | [test name] | ✅/❌ |

### Verification Script Output
npm run verify → [PASS/FAIL]

### Manual Verification
- [ ] Tested in browser
- [ ] Screenshot captured
```

### Failure Recovery — ЕСЛИ ТЕСТЫ ПРОШЛИ, НО НЕ РАБОТАЕТ

1. **STOP** — Не продолжай реализацию
2. **ANALYZE** — Почему тест не поймал проблему?
3. **FIX TEST** — Добавь проверку реального поведения
4. **VERIFY FAIL** — Убедись что новый тест FAIL
5. **FIX CODE** — Исправь реализацию
6. **VERIFY PASS** — Тест проходит
7. **MANUAL** — Проверь в браузере

---

## ⛔ DELIVERY GATE — НЕЛЬЗЯ ОБОЙТИ

### Absolute Rule: NO PARTIAL DELIVERY

**Before saying "done", "complete", "implemented", or "fixed":**

1. **Every requirement in the Contract MUST be implemented** — Not "partially", not "foundation laid"
2. **Every acceptance test MUST verify ACTUAL behavior** — Not mocks, not "fetch was called"
3. **Manual verification MUST be performed** — Open browser, see it work, screenshot

### If Implementation Cannot Be Completed

**STOP and ask permission BEFORE delivering:**

```markdown
## ⚠️ PERMISSION REQUEST

### What Was Requested
[Original requirement]

### What I Can Deliver
[What is actually working]

### What Is Missing
[What is NOT implemented]

### Why It Cannot Be Completed
[Technical reason - not laziness]

### Options
A) Deliver partial implementation with documented limitations
B) Continue implementing until complete
C) Change approach to [alternative]

### Recommendation
[My recommendation with reasoning]

**Do I have permission to proceed with Option [X]?**
```

### Violation Examples — ЗАПРЕЩЕНО

```javascript
// ❌ FORBIDDEN: Claiming AI-driven with hardcoded data
return [
  { text: 'Are you currently taking this medication?' },  // HARDCODED!
  { text: 'How many weeks ago was your last dose?' }      // HARDCODED!
];
// While claiming: "AI-driven follow-up generation implemented ✅"

// ❌ FORBIDDEN: Claiming dynamic with static
const questions = DEFAULT_QUESTIONS[type];  // STATIC LOOKUP!
// While claiming: "Dynamic questions from AI ✅"

// ❌ FORBIDDEN: Tests that prove nothing
expect(fetchSpy).toHaveBeenCalled();  // Only proves fetch was called
// While claiming: "Integration test passes ✅"
// Reality: Response could be ignored, UI could be hardcoded
```

### Self-Check Before Delivery — ОБЯЗАТЕЛЬНО

Ask yourself these questions. If ANY answer is "no" or "partially", **DO NOT DELIVER**:

```markdown
□ Does the code ACTUALLY do what I'm claiming?
  - If I said "AI generates questions" — is there an actual AI call?
  - If I said "dynamic" — does the data come from a variable source?
  - If I said "from database" — is there an actual DB query?

□ Do tests verify ACTUAL BEHAVIOR, not just function calls?
  - Does test check the CONTENT of the response?
  - Does test verify the UI DISPLAYS the dynamic content?
  - Would test FAIL if I returned hardcoded data?

□ Have I SEEN it work in the browser?
  - Not "tests pass" — actually opened browser
  - Not "should work" — actually saw the output
  - Can I screenshot the ACTUAL behavior?

□ Does my claim match reality?
  - "AI-driven" = Claude API is called and response is used
  - "Dynamic" = Data comes from variable source, not hardcoded
  - "From database" = Actual SQL/DB query executed
  - "Integration" = Multiple components actually connected
```

### Consequence of Violation

If I deliver something as "done" that is not actually implemented:

1. I have **LIED** to the user
2. User wastes time testing non-functional feature
3. User loses trust
4. This MUST be documented in `lesson learned.md`
5. I must explain WHY I lied (laziness? misunderstanding? rushing?)

---

### Async/Parallel Execution — СТРОГО ОБЯЗАТЕЛЬНО

1. **ВСЁ что может быть async — ДОЛЖНО быть async**
2. **Все операции с БД** — оптимизированы, с индексами, выполняются параллельно
3. **Используй Promise.all()** — везде где возможно параллельное выполнение
4. **Никаких синхронных операций** — если есть async альтернатива

### Git Workflow — СТРОГО ОБЯЗАТЕЛЬНО

```bash
# ТОЛЬКО после: тесты прошли + проверено 2 раза + всё работает
git add -A
git commit -m "feat/fix/refactor: краткое описание"
```

### Code Quality Rules

1. **Async/Await** — ВСЕ асинхронные операции через async/await
2. **Параллельное выполнение** — используй Promise.all() где возможно
3. **Никаких секретов в коде** — API ключи только через .env (backend)
4. **Тесты на каждую функцию** — минимум unit test
5. **TypeScript types** — предпочтительны JSDoc или .d.ts файлы
6. **База данных** — SQLite с индексами, async операции

### Database Optimization Rules

```javascript
// ✅ CORRECT - async with indexes
const db = new Database('data.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    id TEXT PRIMARY KEY,
    data TEXT,
    expires_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_expires ON cache(expires_at);
`);

// ✅ CORRECT - parallel queries
const [drugs, cache] = await Promise.all([
  db.getAllAsync('SELECT * FROM approved_drugs'),
  db.getAsync('SELECT * FROM followup_cache WHERE drug_class = ?', [drugClass])
]);

// ❌ WRONG - sequential queries
const drugs = await db.getAllAsync('SELECT * FROM approved_drugs');
const cache = await db.getAsync('SELECT * FROM followup_cache WHERE drug_class = ?', [drugClass]);
```

---

## Project Overview

**Name**: Clinical Trial Patient Matching System  
**Type**: Full-Stack Web Application (React + Express Backend)  
**Purpose**: Match patients with clinical trials using hybrid AI + rule-based matching  
**Tech Stack**: React 19, Node.js/Express, SQLite, Anthropic Claude API, Vitest  
**Version**: 5.0 (Full Backend Integration)

---

## Project Structure

```
clinical-trial-react-app/
├── .github/
│   └── copilot-instructions.md      # THIS FILE
├── server/                          # EXPRESS BACKEND
│   ├── index.js                     # Entry point
│   ├── db.js                        # SQLite setup + schema
│   ├── .env                         # ANTHROPIC_API_KEY, ADMIN_PASSWORD
│   ├── routes/
│   │   ├── match.js                 # /api/match
│   │   ├── followups.js             # /api/followups/generate
│   │   └── admin.js                 # /api/admin/*
│   ├── services/
│   │   ├── ClaudeClient.js          # Anthropic SDK wrapper
│   │   ├── FollowUpGenerator.js     # AI question generation
│   │   └── DrugCategoryResolver.js  # Drug → category mapping
│   ├── middleware/
│   │   └── rateLimiter.js           # Rate limiting
│   ├── data/
│   │   └── clinical-trials.db       # SQLite database
│   └── __tests__/                   # Backend tests
│       ├── routes/
│       ├── services/
│       └── middleware/
├── src/                             # REACT FRONTEND
│   ├── __tests__/                   # Frontend tests
│   │   ├── components/
│   │   ├── services/
│   │   └── utils/
│   ├── components/
│   │   ├── App.jsx
│   │   ├── Admin/
│   │   ├── Settings/
│   │   ├── Questionnaire/
│   │   └── Results/
│   ├── services/
│   │   ├── api/
│   │   │   ├── backendClient.js     # Calls Express backend
│   │   │   └── claudeClient.js      # Legacy (for reference)
│   │   └── matcher/
│   │       ├── ClinicalTrialMatcher.js
│   │       └── drugDatabase.js
│   ├── data/
│   │   └── improved_slot_filled_database.json
│   └── utils/
├── docs/
│   └── ARCHITECTURE_AND_MATCHING_GUIDE.md
├── package.json
├── vite.config.js
├── vitest.config.js
├── CHANGELOG.md
└── README.md
```

---

## Tech Stack (v5.0)

### Frontend
- **React 19** — latest version
- **Vite** — fast build
- **CSS Modules** or **Tailwind CSS**

### Backend
- **Node.js + Express** — REST API server
- **SQLite (better-sqlite3)** — persistent storage with async wrapper
- **Anthropic SDK** — Claude API (API key secured on server)
- **express-rate-limit** — rate limiting for admin routes

### Testing
- **Vitest** — fast test runner (Jest API compatible)
- **@testing-library/react** — component testing
- **supertest** — backend API testing
- **MSW** — API mocking for frontend

### Code Quality
- **ESLint** — linting
- **Prettier** — formatting
- **Husky + lint-staged** — pre-commit hooks

---

## Domain Rules

### Inclusion vs Exclusion Criteria

```javascript
// INCLUSION: patient MUST match
// criterion.EXCLUSION_STRENGTH === 'inclusion'
// matches === true → eligible
// matches === false → ineligible

// EXCLUSION: patient must NOT match
// criterion.EXCLUSION_STRENGTH === 'exclusion' (or missing)
// matches === true → ineligible
// matches === false → eligible
```

### Eligibility Formula

```
Patient is ELIGIBLE if:
  (Matches ALL inclusions) AND (Avoids ALL exclusions)
```

---

## Code Patterns

### Async Pattern — MANDATORY

```javascript
// ✅ CORRECT
async function matchPatient(response) {
  const results = await Promise.all([
    evaluateInclusionCriteria(response),
    evaluateExclusionCriteria(response)
  ]);
  return combineResults(results);
}

// ❌ WRONG
function matchPatient(response) {
  return new Promise((resolve) => {
    // callback hell...
  });
}
```

### Testing Pattern — MANDATORY

```javascript
// File: src/__tests__/services/ClinicalTrialMatcher.test.js

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClinicalTrialMatcher } from '../../services/matcher';

describe('ClinicalTrialMatcher', () => {
  let matcher;
  
  beforeEach(() => {
    matcher = new ClinicalTrialMatcher(mockDatabase);
  });
  
  describe('evaluateTrial', () => {
    it('should return eligible when patient matches all inclusions', async () => {
      const patient = { responses: { AGE: { age: 25 } } };
      const result = await matcher.evaluateTrial('NCT123', patient);
      
      expect(result.status).toBe('eligible');
    });
    
    it('should return ineligible when patient fails inclusion', async () => {
      const patient = { responses: { AGE: { age: 5 } } };
      const result = await matcher.evaluateTrial('NCT123', patient);
      
      expect(result.status).toBe('ineligible');
    });
  });
});
```

### Component Pattern

```jsx
// File: src/components/Results/TrialCard.jsx

import { memo } from 'react';
import PropTypes from 'prop-types';
import styles from './TrialCard.module.css';

const TrialCard = memo(function TrialCard({ trial, onSelect }) {
  return (
    <article 
      className={styles.card}
      onClick={() => onSelect(trial.nctId)}
      data-testid={`trial-card-${trial.nctId}`}
    >
      <h3>{trial.nctId}</h3>
      <span className={styles.confidence}>
        {(trial.confidence * 100).toFixed(0)}%
      </span>
    </article>
  );
});

TrialCard.propTypes = {
  trial: PropTypes.shape({
    nctId: PropTypes.string.isRequired,
    confidence: PropTypes.number.isRequired,
  }).isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default TrialCard;
```

---

## Testing Requirements

### Test Coverage Targets

- **Unit tests**: >80% coverage
- **Integration tests**: critical paths
- **E2E tests**: main user flows

### Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e
```

### Pre-commit Hook

```bash
# .husky/pre-commit
npm run lint
npm run test:ci
```

---

## Environment Variables

```bash
# .env.example
VITE_ANTHROPIC_API_KEY=your_api_key_here
VITE_DEFAULT_MODEL=claude-sonnet-4-5-20250929
VITE_ENABLE_CACHE=true
VITE_LOG_LEVEL=info
```

---

## Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:ci": "vitest run",
    "lint": "eslint src --ext .js,.jsx",
    "lint:fix": "eslint src --ext .js,.jsx --fix",
    "format": "prettier --write src",
    "prepare": "husky install"
  }
}
```

---

## Checklist for Every Change

- [ ] Test written for new functionality
- [ ] All tests pass (`npm test`)
- [ ] Code follows ESLint rules (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] Manually verified 2 times
- [ ] Commit made with clear message
- [ ] Documentation updated (if needed)
- [ ] CHANGELOG.md updated

---

## Reference (IMPORTANT)

The SINGLE canonical source for full system architecture is:

**docs/ARCHITECTURE_AND_MATCHING_GUIDE.md**

Other documentation files provide supporting or specialized details only.
When asked about overall architecture, always reference the canonical document.

---

**Version**: 5.0 (2026-01-20)  
**Status**: Backend Integration Complete ✅

### Lessons Learnt

After solving a non-trivial bug or learning something important:

1. Add entry to [lesson learned.md](./lesson learned.md)
2. Include: Problem → Cause → Solution → Lesson
3. This helps avoid repeating the same mistakes