# Testing Guide

> **Version**: 1.0.0  
> **Last Updated**: 2026-02-16  
> **Maintainer**: Clinical Trial Team

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

- [Overview](#overview)
- [Test Stack](#test-stack)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [Coverage Reports](#coverage-reports)
- [E2E Testing](#e2e-testing)
- [TDD Workflow](#tdd-workflow)
- [Common Patterns](#common-patterns)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

---

## Overview

The project uses a comprehensive testing strategy:
- **382+ tests** across frontend and backend
- **Unit tests** for individual functions
- **Integration tests** for component interactions
- **E2E tests** for full user flows

## Test Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Unit/Integration test runner (Jest-compatible) |
| **@testing-library/react** | React component testing |
| **supertest** | Express API testing |
| **MSW** | API mocking for frontend |
| **Playwright** | E2E browser testing |

## Running Tests

### All Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run with UI
npm run test:ui
```

### Specific Tests

```bash
# Run single file
npm test -- src/__tests__/services/ClinicalTrialMatcher.test.js

# Run tests matching pattern
npm test -- --grep "matching"

# Run frontend tests only
npm test -- src/

# Run backend tests only
npm test -- server/
```

### Coverage

```bash
# Generate coverage report
npm run test:coverage

# Coverage output: coverage/lcov-report/index.html
```

## Test Structure

```
project/
├── src/
│   └── __tests__/
│       ├── components/        # React component tests
│       │   ├── App.test.jsx
│       │   └── Questionnaire.test.jsx
│       ├── services/          # Frontend service tests
│       │   ├── ClinicalTrialMatcher.test.js
│       │   └── backendClient.test.js
│       └── utils/             # Utility function tests
│
├── server/
│   └── __tests__/
│       ├── routes/            # API endpoint tests
│       │   ├── match.test.js
│       │   └── parser.test.js
│       ├── services/          # Backend service tests
│       │   ├── ClaudeClient.test.js
│       │   └── FollowUpGenerator.test.js
│       └── db.test.js         # Database tests
│
└── e2e/
    ├── app.spec.js            # Main app E2E
    └── parser.spec.js         # Parser E2E
```

## Writing Tests

### Unit Test Template

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { functionToTest } from '../../path/to/module';

describe('functionToTest', () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  it('should do X when given Y', () => {
    // Arrange
    const input = { /* test data */ };
    
    // Act
    const result = functionToTest(input);
    
    // Assert
    expect(result).toBe(expectedValue);
  });

  it('should handle edge case Z', () => {
    // Test edge cases
  });
});
```

### React Component Test Template

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from '../../components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    
    render(<MyComponent onSubmit={onSubmit} />);
    
    await user.click(screen.getByRole('button', { name: /submit/i }));
    
    expect(onSubmit).toHaveBeenCalledWith(/* expected args */);
  });
});
```

### API Test Template

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../index';

describe('POST /api/match', () => {
  it('returns matches for valid patient data', async () => {
    const response = await request(app)
      .post('/api/match')
      .send({
        responses: {
          AGE: { age: 45 }
        }
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('matches');
  });

  it('returns 400 for invalid data', async () => {
    const response = await request(app)
      .post('/api/match')
      .send({});

    expect(response.status).toBe(400);
  });
});
```

## Coverage Reports

### Target Coverage

| Category | Target | Current |
|----------|--------|---------|
| Statements | 80% | ✅ |
| Branches | 75% | ✅ |
| Functions | 80% | ✅ |
| Lines | 80% | ✅ |

### Viewing Reports

```bash
# Generate HTML report
npm run test:coverage

# Open in browser
start coverage/lcov-report/index.html
```

### Coverage in CI

Coverage is automatically checked in CI pipeline. PRs below threshold are blocked.

## E2E Testing

### Setup

```bash
# Install Playwright browsers
npx playwright install
```

### Running E2E

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI
npx playwright test --ui

# Run specific test
npx playwright test e2e/app.spec.js
```

### E2E Test Example

```javascript
// e2e/app.spec.js
import { test, expect } from '@playwright/test';

test('user can complete questionnaire', async ({ page }) => {
  await page.goto('/');
  
  // Fill age
  await page.fill('[data-testid="age-input"]', '45');
  
  // Submit
  await page.click('button[type="submit"]');
  
  // Verify results
  await expect(page.locator('.results')).toBeVisible();
});
```

## TDD Workflow

**MANDATORY: Tests FIRST, then code**

### Workflow

```
1. Write failing test
2. Run test (should FAIL)
3. Write minimal code to pass
4. Run test (should PASS)
5. Refactor if needed
6. Repeat
```

### Example

```javascript
// Step 1: Write failing test
it('should calculate BMI from height and weight', () => {
  const result = calculateBMI(180, 75);  // 180cm, 75kg
  expect(result).toBeCloseTo(23.15, 1);
});

// Step 2: Run test → FAILS (function doesn't exist)

// Step 3: Write code
function calculateBMI(heightCm, weightKg) {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

// Step 4: Run test → PASSES
```

## Common Patterns

### Mocking API Calls

```javascript
import { vi } from 'vitest';

// Mock fetch
vi.spyOn(global, 'fetch').mockResolvedValue({
  ok: true,
  json: async () => ({ data: 'mocked' })
});
```

### Testing Async Functions

```javascript
it('should fetch data asynchronously', async () => {
  const result = await fetchData();
  expect(result).toBeDefined();
});
```

### Testing Error Handling

```javascript
it('should throw on invalid input', () => {
  expect(() => processData(null)).toThrow('Invalid input');
});

it('should reject promise on error', async () => {
  await expect(fetchData('bad-url')).rejects.toThrow();
});
```

### Snapshot Testing

```javascript
it('matches snapshot', () => {
  const { container } = render(<MyComponent />);
  expect(container).toMatchSnapshot();
});
```

---

> **See Also:**  
> - [Architecture Guide](ARCHITECTURE_AND_MATCHING_GUIDE.md) — System design  
> - [Deployment Guide](deployment_guide.md) — Running in production  
> - [copilot-instructions.md](../.github/copilot-instructions.md) — TDD rules
