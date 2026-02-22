# Backup Catalog

Centralized tracking of all system backups for the Clinical Trial Patient Matching System.

**Backup Directory**: `c:\Users\lasko\Downloads\clinical-trial-backups\`

---

## Quick Commands

### Database-Only Backup
```powershell
function Backup-ClinicalTrialDB {
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $src = "c:\Users\lasko\Downloads\clinical-trial-react-app\server\data\clinical-trials.db"
    $dst = "c:\Users\lasko\Downloads\clinical-trial-backups\clinical-trials.db.$timestamp"
    
    if (!(Test-Path "c:\Users\lasko\Downloads\clinical-trial-backups")) {
        New-Item -ItemType Directory -Path "c:\Users\lasko\Downloads\clinical-trial-backups" -Force
    }
    
    if (Test-Path $src) {
        Copy-Item $src $dst
        Write-Host "✅ Backup created: $dst"
    } else {
        Write-Host "⚠️ Database not found: $src"
    }
}

Backup-ClinicalTrialDB
```

### Full Project Backup
```powershell
function Backup-Project {
    param([string]$Description = "manual")
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $safeName = $Description -replace '[^a-zA-Z0-9_-]', '_'
    $backupDir = "c:\Users\lasko\Downloads\clinical-trial-backups\${safeName}_$timestamp"
    New-Item -ItemType Directory -Path $backupDir -Force
    
    # Core data files
    Copy-Item -Path "c:\Users\lasko\Downloads\clinical-trial-react-app\server\data\*" -Destination $backupDir -Recurse
    Copy-Item -Path "c:\Users\lasko\Downloads\clinical-trial-react-app\server\.env" -Destination $backupDir -ErrorAction SilentlyContinue
    
    # Slot-filled database (critical for matching)
    Copy-Item -Path "c:\Users\lasko\Downloads\clinical-trial-react-app\src\data\improved_slot_filled_database.json" -Destination $backupDir -ErrorAction SilentlyContinue
    
    # Create README
    @"
Backup: $safeName
Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Description: $Description

Contents:
- clinical-trials.db (SQLite database)
- .env (environment variables)
- improved_slot_filled_database.json (criteria database)
"@ | Out-File "$backupDir\README.txt"
    
    Write-Host "✅ Full backup created: $backupDir"
}

# Usage:
Backup-Project -Description "PRE_CLUSTER_RENAME"
```

---

## Backup Inventory

| ID | Date | Name | Description | Type | Restore Tested |
|----|------|------|-------------|------|----------------|
| 1 | 2026-02-03 16:23 | `clinical-trials.db.20260203-162348` | DB only | DB | ❌ |
| 2 | 2026-02-03 16:33 | `clinical-trials.db.20260203-163306` | DB only | DB | ❌ |
| 3 | 2026-02-03 19:05 | `WORKING_20260203-190517/` | Parser parseLimit fix, cluster detection from filename | Full | ❌ |
| 4 | 2026-02-16 00:19 | `PRE_CLUSTER_RENAME_20260216-001905/` | Before cluster refactor: CPD→DD, NPV→DIT, FLR removed | Full | ❌ |

---

## Backup Details

### Backup #1: clinical-trials.db.20260203-162348

- **Created**: 2026-02-03 16:23:48
- **Location**: `c:\Users\lasko\Downloads\clinical-trial-backups\clinical-trials.db.20260203-162348`
- **Type**: Database only
- **Contents**: SQLite database snapshot
- **Version**: Pre-5.2.1 (before parser polling fix)
- **Restore**:
  ```powershell
  # Stop servers first!
  taskkill /F /IM node.exe 2>$null
  Copy-Item "c:\Users\lasko\Downloads\clinical-trial-backups\clinical-trials.db.20260203-162348" `
             "c:\Users\lasko\Downloads\clinical-trial-react-app\server\data\clinical-trials.db" -Force
  ```

### Backup #2: clinical-trials.db.20260203-163306

- **Created**: 2026-02-03 16:33:06
- **Location**: `c:\Users\lasko\Downloads\clinical-trial-backups\clinical-trials.db.20260203-163306`
- **Type**: Database only
- **Contents**: SQLite database snapshot
- **Version**: Pre-5.2.1
- **Restore**: Same as Backup #1, use this filename

### Backup #3: WORKING_20260203-190517

- **Created**: 2026-02-03 19:05:17
- **Location**: `c:\Users\lasko\Downloads\clinical-trial-backups\WORKING_20260203-190517\`
- **Type**: Full project backup
- **Contents**:
  - `clinical-trials.db` — SQLite database
  - `README.txt` — "WORKING VERSION - Parser parseLimit fix, cluster detection from filename"
- **Version**: 5.2.x working state with parser fixes
- **Restore**:
  ```powershell
  # Stop servers first!
  taskkill /F /IM node.exe 2>$null
  Copy-Item "c:\Users\lasko\Downloads\clinical-trial-backups\WORKING_20260203-190517\clinical-trials.db" `
             "c:\Users\lasko\Downloads\clinical-trial-react-app\server\data\clinical-trials.db" -Force
  ```

### Backup #4: PRE_CLUSTER_RENAME_20260216-001905

- **Created**: 2026-02-16 00:19:05
- **Location**: `c:\Users\lasko\Downloads\clinical-trial-backups\PRE_CLUSTER_RENAME_20260216-001905\`
- **Type**: Full project backup
- **Contents**:
  - `clinical-trials.db` — SQLite database (pre-refactor)
  - `improved_slot_filled_database.json` — Criteria with old cluster names (CPD, NPV, FLR)
  - `README.txt` — Backup description
- **Version**: 5.2.x (before v5.3.0 cluster refactoring)
- **Why**: Safety backup before major cluster renaming:
  - CPD (Current Psoriasis Duration) → DD (Disease Duration)
  - NPV (Non-Plaque Variant) → DIT (Disease Type)
  - FLR (Flare) → Removed entirely
  - PSORIASIS_VARIANT → DISEASE_VARIANT
- **Restore**:
  ```powershell
  # Stop servers first!
  taskkill /F /IM node.exe 2>$null
  
  # Restore database
  Copy-Item "c:\Users\lasko\Downloads\clinical-trial-backups\PRE_CLUSTER_RENAME_20260216-001905\clinical-trials.db" `
             "c:\Users\lasko\Downloads\clinical-trial-react-app\server\data\clinical-trials.db" -Force
  
  # Restore slot-filled database (IMPORTANT: contains old cluster names!)
  Copy-Item "c:\Users\lasko\Downloads\clinical-trial-backups\PRE_CLUSTER_RENAME_20260216-001905\improved_slot_filled_database.json" `
             "c:\Users\lasko\Downloads\clinical-trial-react-app\src\data\improved_slot_filled_database.json" -Force
  
  # WARNING: After restoring, code expects NEW cluster names (DD, DIT)
  # but database will have OLD names (CPD, NPV, FLR)
  # You must also revert code changes or fix the mismatch!
  ```

---

## Version Correlation

| Backup | CHANGELOG Version | Key Changes |
|--------|-------------------|-------------|
| #1, #2 | Pre-5.2.1 | Before parser polling race condition fix |
| #3 | 5.2.x | Parser parseLimit fix, cluster detection from filename |
| #4 | Pre-5.3.0 | Before cluster refactor: CPD→DD, NPV→DIT, FLR removed |

---

## Restore Procedures

### ⚠️ CRITICAL: Before ANY Restore

```powershell
# 1. STOP ALL SERVERS
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 2

# 2. Verify ports are free
Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue
# Should return EMPTY

# 3. ONLY THEN proceed with restore
```

### Restore Database Only

```powershell
$backupFile = "c:\Users\lasko\Downloads\clinical-trial-backups\clinical-trials.db.TIMESTAMP"
$targetFile = "c:\Users\lasko\Downloads\clinical-trial-react-app\server\data\clinical-trials.db"

# Stop servers
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 2

# Restore
Copy-Item $backupFile $targetFile -Force
Write-Host "✅ Database restored from: $backupFile"
```

### Restore Full Project Backup

```powershell
$backupDir = "c:\Users\lasko\Downloads\clinical-trial-backups\BACKUP_NAME\"
$projectDir = "c:\Users\lasko\Downloads\clinical-trial-react-app\"

# Stop servers
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 2

# Restore database
Copy-Item "$backupDir\clinical-trials.db" "$projectDir\server\data\clinical-trials.db" -Force

# Restore .env if exists
if (Test-Path "$backupDir\.env") {
    Copy-Item "$backupDir\.env" "$projectDir\server\.env" -Force
}

# Restore slot-filled database if exists
if (Test-Path "$backupDir\improved_slot_filled_database.json") {
    Copy-Item "$backupDir\improved_slot_filled_database.json" "$projectDir\src\data\improved_slot_filled_database.json" -Force
}

Write-Host "✅ Full restore completed from: $backupDir"
```

---

## Adding New Backups

When creating a backup, add an entry to this catalog:

```markdown
### Backup #N: NAME_TIMESTAMP

- **Created**: YYYY-MM-DD HH:MM:SS
- **Location**: `c:\Users\lasko\Downloads\clinical-trial-backups\NAME_TIMESTAMP\`
- **Type**: DB / Full
- **Contents**: [list files]
- **Version**: [CHANGELOG version]
- **Why**: [reason for backup]
- **Restore**: [specific commands if different from standard]
```

---

**Last Updated**: 2026-02-16
