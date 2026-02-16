# Admin Guide

> **Version**: 1.0.0  
> **Last Updated**: 2026-02-16  
> **Maintainer**: Clinical Trial Team

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

- [Overview](#overview)
- [Accessing Admin Panel](#accessing-admin-panel)
- [API Key Management](#api-key-management)
- [Drug Approval System](#drug-approval-system)
- [Pending Terms Review](#pending-terms-review)
- [Cache Management](#cache-management)
- [Parser Management](#parser-management)
- [Rate Limiting](#rate-limiting)
- [Security Best Practices](#security-best-practices)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

---

## Overview

The Admin Panel provides administrative functions for managing:
- API keys and configuration
- Drug approval whitelist
- Pending terms needing review
- AI response cache
- Parser operations

**Access URL:** http://localhost:3000/admin (when servers running)

## Accessing Admin Panel

### Authentication

The admin panel uses password-based authentication.

1. Navigate to Admin section in the app
2. Enter admin password (set in `server/.env` as `ADMIN_PASSWORD`)
3. Session persists until browser close

### Setting Admin Password

```bash
# In server/.env
ADMIN_PASSWORD=your-secure-password-here
```

**Security Requirements:**
- Minimum 8 characters
- Mix of letters, numbers, symbols
- Never commit to git

## API Key Management

### Setting Anthropic API Key

1. Go to Admin → Settings
2. Enter API key in secure field
3. Click "Save"
4. Key is stored encrypted in backend

**Key Format:** `sk-ant-api03-...`

**Verify Key Works:**
```bash
# Test endpoint
curl http://localhost:3001/api/config/verify-key
```

### Key Storage

- ✅ Stored in backend only (server/.env or secure config)
- ✅ Never exposed to frontend
- ❌ Never in localStorage
- ❌ Never in git

## Drug Approval System

### Purpose

Controls which drugs can generate AI follow-up questions without manual review.

### Workflow

```
New Drug Mentioned → Check if Approved → 
  ├─ Yes → Generate AI questions automatically
  └─ No → Add to Pending Terms for review
```

### Managing Approved Drugs

**View Approved Drugs:**
- Admin → Drug Review Dashboard
- Shows all approved drugs with categories

**Add New Drug:**
1. Admin → Drug Review Dashboard
2. Click "Add Drug"
3. Enter drug name and category
4. Submit for approval

**Remove Drug:**
1. Find drug in list
2. Click "Remove"
3. Confirm deletion

### Drug Categories

| Category | Examples |
|----------|----------|
| `TNF_INHIBITOR` | adalimumab, infliximab, etanercept |
| `IL_INHIBITOR` | secukinumab, ixekizumab, ustekinumab |
| `JAK_INHIBITOR` | tofacitinib, baricitinib |
| `CSDMARD` | methotrexate, sulfasalazine |
| `CORTICOSTEROID` | prednisone, hydrocortisone |

## Pending Terms Review

### Purpose

When the system encounters unknown drugs or medical terms, they're queued for admin review.

### Workflow

1. System encounters unknown term
2. Term added to pending queue
3. Admin reviews in dashboard
4. Admin approves (adds to whitelist) or rejects

### Managing Pending Terms

**View Pending:**
- Admin → Pending Terms Review
- Shows terms awaiting decision

**Approve Term:**
1. Review term context
2. Assign appropriate category
3. Click "Approve"
4. Term added to approved list

**Reject Term:**
1. Review term
2. Click "Reject" if not relevant
3. Term removed from queue

## Cache Management

### Purpose

AI responses are cached to reduce API costs and improve response time.

### Cache Settings

**TTL (Time-to-Live):** Default 24 hours

```javascript
// In server configuration
CACHE_TTL_HOURS=24
```

### Clearing Cache

**Clear All:**
```bash
npm run cache:clear
# Or via Admin UI
```

**Clear Specific:**
- Admin → Cache Management
- Select entries to clear
- Confirm deletion

### Cache Statistics

- Admin → Cache Management shows:
  - Total cached entries
  - Cache hit rate
  - Storage used
  - Oldest/newest entries

## Parser Management

### Purpose

The Parser processes raw trial criteria into structured slot-filled format.

### Parser UI

- Admin → Parser Page
- Upload criteria files
- Configure parsing options
- Monitor progress

### Parser Options

| Option | Description |
|--------|-------------|
| `parseLimit` | Max criteria to parse per session |
| `cluster` | Target cluster (AGE, BMI, etc.) |
| `dryRun` | Preview without saving |

### Running Parser

1. Select cluster or file
2. Set parse limit (recommended: 10-50)
3. Click "Start Parsing"
4. Monitor progress in real-time
5. Review results before confirming

## Rate Limiting

### Purpose

Protects API from abuse and controls costs.

### Default Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/match` | 100 | 15 min |
| `/api/followups` | 50 | 15 min |
| `/api/admin/*` | 20 | 15 min |
| `/api/parser/*` | 10 | 15 min |

### Adjusting Limits

```javascript
// In server/middleware/rateLimiter.js
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // requests per window
});
```

## Security Best Practices

### Do's ✅

- Use strong admin password
- Rotate API keys periodically
- Monitor unusual activity
- Keep dependencies updated
- Backup database regularly

### Don'ts ❌

- Never share admin password
- Never commit secrets to git
- Never expose admin endpoints publicly without auth
- Never disable rate limiting in production

### Security Checklist

- [ ] Admin password set and secure
- [ ] API key configured in backend only
- [ ] Rate limiting enabled
- [ ] HTTPS in production
- [ ] Regular backups scheduled

---

> **See Also:**  
> - [Deployment Guide](deployment_guide.md) — Server setup  
> - [Testing Guide](testing_guide.md) — Testing procedures  
> - [Architecture Guide](ARCHITECTURE_AND_MATCHING_GUIDE.md) — System design
