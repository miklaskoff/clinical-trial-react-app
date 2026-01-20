# Clinical Trial Matching System

React + Express application for matching patients with clinical trials using **hybrid AI + rule-based matching**.

[![Tests](https://img.shields.io/badge/tests-382%20passing-brightgreen)](#testing)
[![Version](https://img.shields.io/badge/version-5.0.0-blue)](#)
[![React](https://img.shields.io/badge/react-19-61dafb)](#tech-stack)

## ✨ Features

- **Hybrid Matching Engine** - Three-pass strategy: Exact → Rule-based → AI semantic
- **Full Backend** - Express.js server with SQLite database (API key secured on server)
- **AI Follow-up Questions** - Dynamically generated based on drug class and condition type
- **382 Tests** - Frontend (328) + Backend (54) with Vitest
- **E2E Tests** - Playwright integration for full flow testing
- **Admin Panel** - Drug approval, pending reviews, statistics
- **Modern Stack** - React 19, Node.js/Express, Vite 6, SQLite
- **TDD Workflow** - Test-driven development enforced

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm 9+
- Anthropic API Key (for AI matching)

### Installation

```bash
# Clone the repository
git clone https://github.com/miklaskoff/clinical-trial-react-app.git
cd clinical-trial-react-app

# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..

# Start backend (Terminal 1)
cd server && node index.js

# Start frontend (Terminal 2)
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Для коллег (Быстрый старт)

1. Убедись что установлен Node.js 18+ (https://nodejs.org)
2. Выполни команды:

```bash
git clone https://github.com/miklaskoff/clinical-trial-react-app.git
cd clinical-trial-react-app
npm install
cd server && npm install && cd ..

# Терминал 1: Backend
cd server && node index.js

# Терминал 2: Frontend
npm run dev
```

3. Открой http://localhost:3000
4. В Settings введи Anthropic API key

## 📂 Project Structure

```
clinical-trial-react-app/
├── src/                     # React Frontend
│   ├── __tests__/           # Frontend tests (328)
│   ├── components/          # React components
│   ├── services/            # Business logic
│   │   ├── api/             # Backend client
│   │   ├── matcher/         # Matching engine
│   │   └── admin/           # Admin services
│   ├── utils/               # Utility functions
│   └── data/                # Trial database JSON
├── server/                  # Express Backend
│   ├── __tests__/           # Backend tests (54)
│   ├── routes/              # API endpoints
│   ├── services/            # ClaudeClient, FollowUpGenerator
│   ├── middleware/          # Rate limiter
│   └── data/                # SQLite database
├── e2e/                     # Playwright E2E tests
├── docs/                    # Documentation
└── .github/                 # Copilot instructions, lessons
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
| Frontend - Integration | 33 |
| Frontend - Services | 134 |
| Frontend - Utils | 52 |
| Frontend - Components | 15 |
| Backend - Routes | 28 |
| Backend - Services | 26 |
| **Total** | **382** |

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

- **React 19** - UI library
- **Node.js/Express** - Backend server
- **SQLite** - Database (better-sqlite3)
- **Vite 6** - Build tool
- **Vitest 2** - Test runner
- **Anthropic SDK** - Claude API
- **Playwright** - E2E testing

## 📄 License

Private project - All rights reserved.

---

**Version 5.0.0** | Updated 2026-01-20

### Изменения в v5.0.0
- ✅ Full Express backend с SQLite
- ✅ API key хранится на сервере (не в localStorage)
- ✅ AI-generated follow-up questions для treatments и conditions (раздельные потоки)
- ✅ 382 теста (328 frontend + 54 backend)
- ✅ Admin panel с аутентификацией
- ✅ Rate limiting для API
