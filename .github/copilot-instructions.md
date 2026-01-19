# Copilot Instructions — Clinical Trial Matching System

## ⚠️ MANDATORY DEVELOPMENT RULES — КРИТИЧЕСКИ ВАЖНО

### TDD (Test-Driven Development) — СТРОГО ОБЯЗАТЕЛЬНО

1. **ПЕРЕД каждым изменением** — СНАЧАЛА напиши тест
2. **После каждого изменения** — запусти ВСЕ тесты (`npm test`)
3. **Тесты не прошли?** — ❌ НЕ КОММИТЬ. Исправь код до прохождения
4. **Тесты прошли?** — Проверь результат **ДВАЖДЫ**, потом коммить
5. **Нельзя заканчивать работу** — пока ВСЕ тесты не пройдены
6. **Каждое изменение = набор тестов** — добавляй в соответствующую тестовую группу

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

**Version**: 5.0 (2026-01-19)  
**Status**: Backend Integration in Progress 🔄

