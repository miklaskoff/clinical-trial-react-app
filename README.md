# Clinical Trial Matching System

React application for matching patients with clinical trials using **hybrid AI + rule-based matching**.

[![Tests](https://img.shields.io/badge/tests-138%20passing-brightgreen)](#testing)
[![Version](https://img.shields.io/badge/version-4.0.0-blue)](#)
[![React](https://img.shields.io/badge/react-18.3.1-61dafb)](#tech-stack)

## ✨ Features

- **Hybrid Matching Engine** - Three-pass strategy: Exact → Rule-based → AI semantic
- **Claude API Integration** - Anthropic Claude for semantic analysis with caching
- **AI Response Caching** - LRU cache with TTL and localStorage persistence
- **138 Unit Tests** - Comprehensive test coverage with Vitest
- **E2E Tests** - Playwright integration for full flow testing
- **Confidence Breakdown** - Detailed explanation of match confidence per criterion
- **Modern Stack** - React 18, Vite 6, ESLint 9, Prettier
- **TDD Workflow** - Test-driven development enforced

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm 9+
- Anthropic API Key (for AI matching)

### Installation

```bash
# Clone/download the project
cd clinical-trial-react-app

# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev
```

Open browser at `http://localhost:3000`

### For Colleagues (Quick Setup)

```bash
git clone <repository-url>
cd clinical-trial-react-app
npm install
npm run dev
# Open http://localhost:3000
# Enter your Anthropic API key in settings
```

## 📂 Project Structure

```
clinical-trial-react-app/
├── src/
│   ├── __tests__/           # All tests (138)
│   │   ├── components/      # Component tests
│   │   ├── services/        # Service tests
│   │   └── utils/           # Utility tests
│   ├── components/          # React components
│   │   └── App.jsx          # Main app component
│   ├── services/            # Business logic
│   │   ├── api/             # Claude API client
│   │   ├── cache/           # AI response caching
│   │   └── matcher/         # Matching engine
│   ├── utils/               # Utility functions
│   ├── data/                # Database JSON
│   └── styles/              # CSS files
├── e2e/                     # Playwright E2E tests
├── docs/                    # Documentation
├── package.json
├── vite.config.js
├── vitest.config.js
├── playwright.config.js
└── eslint.config.js
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# CI mode (no watch)
npm run test:ci

# E2E tests (requires Playwright browsers)
npm run test:e2e:install   # Install browsers (once)
npm run test:e2e           # Run E2E tests
```

### Test Coverage

| Module | Tests |
|--------|-------|
| Utils (string, array, medical) | 52 |
| Services (matcher, drugs, results, cache, claude) | 72 |
| Components (App) | 14 |
| **Total** | **138** |

## 🔧 Scripts

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run preview      # Preview build
npm test             # Run tests (watch mode)
npm run test:ci      # Run tests (CI mode)
npm run test:e2e     # Run E2E tests
npm run lint         # Lint code
npm run format       # Format code
```

## 📋 How It Works

1. **Patient fills questionnaire** - 10 clusters (AGE, BMI, CMB, etc.)
2. **System evaluates each trial** - In parallel for performance
3. **Three-pass matching**:
   - **Pass 1**: Exact slot comparison (confidence: 1.0)
   - **Pass 2**: Rule-based heuristics (confidence: 0.7-0.9)
   - **Pass 3**: Claude AI semantic analysis (if enabled)
4. **Results categorized**: Eligible / Needs Review / Ineligible

## 🤖 AI Configuration

```javascript
// Enable AI matching with API key
const aiConfig = {
  apiKey: 'sk-ant-...',
  model: 'claude-sonnet-4-5-20250929',
  confidenceThresholds: {
    exclude: 0.8,  // Auto-exclude threshold
    review: 0.5,   // Manual review threshold
    ignore: 0.3    // Ignore below this
  }
};
```

## 📚 Documentation

- [Architecture Guide](docs/ARCHITECTURE_AND_MATCHING_GUIDE.md) - System design
- [Changelog](CHANGELOG.md) - Version history
- [Copilot Instructions](.github/copilot-instructions.md) - Development rules

## 🛠 Tech Stack

- **React 18.3.1** - UI library
- **Vite 6** - Build tool
- **Vitest 2** - Test runner
- **ESLint 9** - Linting
- **Prettier 3** - Formatting
- **Anthropic SDK** - Claude API

## 📄 License

Private project - All rights reserved.

---

**Version 4.0.0** | Updated 2026-01-12
