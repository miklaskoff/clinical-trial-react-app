# Deployment Guide

> **Version**: 1.0.0  
> **Last Updated**: 2026-02-16  
> **Maintainer**: Clinical Trial Team

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Troubleshooting](#troubleshooting)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

---

## Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **npm**: v9+
- **SQLite3**: Bundled with better-sqlite3
- **Anthropic API Key**: For AI-powered matching

## Local Development

### 1. Clone and Install

```bash
git clone https://github.com/miklaskoff/clinical-trial-react-app.git
cd clinical-trial-react-app

# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..
```

### 2. Configure Environment

```bash
# Copy example env file
cp server/.env.example server/.env

# Edit with your API key
# ANTHROPIC_API_KEY=sk-ant-...
# ADMIN_PASSWORD=your-secure-password
```

### 3. Start Development Servers

```bash
# Option A: Use start script (recommended)
./start-dev.bat

# Option B: Manual start (two terminals)
# Terminal 1: npm run dev
# Terminal 2: cd server && npm run dev
```

**Ports:**
- Frontend (Vite): http://localhost:3000
- Backend (Express): http://localhost:3001

## Production Deployment

### Option A: Traditional Server

```bash
# Build frontend
npm run build

# Start production server
cd server
NODE_ENV=production npm start

# Serve static files from build/
```

### Option B: Docker (Recommended)

```dockerfile
# Dockerfile example - create in project root
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

WORKDIR /app/server
RUN npm ci --only=production

EXPOSE 3001
CMD ["node", "index.js"]
```

```bash
docker build -t clinical-trial-app .
docker run -p 3001:3001 --env-file server/.env clinical-trial-app
```

### Option C: Heroku

```bash
# heroku.yml in project root
heroku create clinical-trial-app
heroku config:set ANTHROPIC_API_KEY=sk-ant-...
git push heroku main
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | — | Anthropic Claude API key |
| `ADMIN_PASSWORD` | ✅ Yes | — | Admin panel password |
| `PORT` | No | 3001 | Backend server port |
| `NODE_ENV` | No | development | Environment mode |
| `LOG_LEVEL` | No | info | Logging verbosity |

## Database Setup

The app uses SQLite with automatic schema creation.

**Database Location:** `server/data/clinical-trials.db`

### Initialization

Database is auto-created on first server start. Schema includes:
- `approved_drugs` — Drug approval whitelist
- `followup_cache` — AI response cache
- `pending_terms` — Terms awaiting review
- `parsed_criteria` — Parsed trial criteria

### Backup

```bash
# Create backup before major changes
cp server/data/clinical-trials.db server/data/clinical-trials.db.backup
```

### Reset (Development Only)

```bash
# Delete database to reset
rm server/data/clinical-trials.db
# Restart server — schema will be recreated
```

## Troubleshooting

### Port Already in Use

```bash
# Find and kill process on port 3001
npx kill-port 3001

# Or on Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Database Locked

```bash
# Stop all Node processes
taskkill /F /IM node.exe

# Wait 2 seconds, then restart
npm run dev
```

### API Key Issues

1. Verify key format: `sk-ant-api03-...`
2. Check `.env` file location: `server/.env`
3. Restart server after changing `.env`

---

> **See Also:**  
> - [Admin Guide](admin_guide.md) — Admin panel usage  
> - [Testing Guide](testing_guide.md) — Running tests  
> - [Architecture Guide](ARCHITECTURE_AND_MATCHING_GUIDE.md) — System design
