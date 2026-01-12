# Copilot Instructions — Clinical Trial Matching System

## ⚠️ MANDATORY DEVELOPMENT RULES

### TDD (Test-Driven Development) — ОБЯЗАТЕЛЬНО

1. **Перед каждым изменением** — напиши тест
2. **После каждого изменения** — запусти ВСЕ тесты
3. **Тесты не прошли?** — НЕ КОММИТЬ. Исправь код
4. **Тесты прошли?** — Проверь результат ДВАЖДЫ, потом коммить

### Git Workflow — ОБЯЗАТЕЛЬНО

```bash
# Каждое УСПЕШНОЕ изменение (тесты прошли, проверено 2 раза):
git add -A
git commit -m "feat/fix/refactor: краткое описание"
```

### Code Quality Rules

1. **Async/Await** — ВСЕ асинхронные операции через async/await
2. **Параллельное выполнение** — используй Promise.all() где возможно
3. **Никаких секретов в коде** — API ключи только через .env
4. **Тесты на каждую функцию** — минимум unit test
5. **TypeScript types** — предпочтительны JSDoc или .d.ts файлы

---

## Project Overview

**Name**: Clinical Trial Patient Matching System  
**Type**: React Web Application  
**Purpose**: Match patients with clinical trials using hybrid AI + rule-based matching  
**Tech Stack**: React 19, Node.js, Anthropic Claude API, Vitest/Testing Library  
**Version**: 4.0 (Full Refactor)

---

## Project Structure

```
clinical-trial-react-app/
├── .github/
│   └── copilot-instructions.md      # THIS FILE
├── public/
│   └── index.html
├── src/
│   ├── __tests__/                   # All tests
│   │   ├── components/              # Component tests
│   │   ├── services/                # Service tests
│   │   └── utils/                   # Utility tests
│   ├── components/                  # React components
│   │   ├── App.jsx
│   │   ├── Settings/
│   │   ├── Questionnaire/
│   │   ├── Results/
│   │   └── common/                  # Reusable
│   ├── services/                    # Business logic
│   │   ├── matcher/                 # Matching logic
│   │   │   ├── ClinicalTrialMatcher.js
│   │   │   ├── EnhancedAIMatchingEngine.js
│   │   │   └── index.js
│   │   └── api/                     # API clients
│   │       └── claudeClient.js
│   ├── hooks/                       # Custom React hooks
│   ├── utils/                       # Utilities
│   ├── types/                       # TypeScript types / JSDoc
│   ├── data/                        # JSON data
│   │   └── trials-database.json
│   ├── styles/                      # CSS
│   └── index.jsx                    # Entry point
├── docs/
│   └── ARCHITECTURE_AND_MATCHING_GUIDE.md  # CANONICAL DOC
├── .env.example                     # Env variables template
├── .gitignore
├── package.json
├── vite.config.js                   # Vite config
├── vitest.config.js                 # Vitest config
├── CHANGELOG.md
└── README.md
```

---

## Tech Stack (v4.0)

### Frontend
- **React 19** — latest version
- **Vite** — fast build (replaces CRA)
- **CSS Modules** or **Tailwind CSS**

### Testing
- **Vitest** — fast test runner (Jest API compatible)
- **@testing-library/react** — component testing
- **@testing-library/user-event** — user interaction simulation
- **MSW** — API mocking

### Backend/Services
- **Node.js** (ES Modules)
- **Anthropic SDK** — official Claude API SDK

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

**Version**: 4.0 (2026-01-12)  
**Status**: Refactoring in Progress 🔄

