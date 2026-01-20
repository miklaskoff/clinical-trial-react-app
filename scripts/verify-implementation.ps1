# Implementation Contract Verification Script
# Run this BEFORE every commit

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  IMPLEMENTATION CONTRACT VERIFICATION" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$ErrorCount = 0

# 1. All tests pass
Write-Host "▶ Running all tests..." -ForegroundColor Yellow
$TestResult = npm test -- --run 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ TESTS FAILED - Cannot proceed" -ForegroundColor Red
    Write-Host $TestResult
    $ErrorCount++
} else {
    Write-Host "✅ All tests passed" -ForegroundColor Green
}

# 2. Check for direct Anthropic API calls in frontend
Write-Host ""
Write-Host "▶ Checking for direct Anthropic API calls in frontend..." -ForegroundColor Yellow
$AnthropicCalls = Select-String -Path "src\**\*.js", "src\**\*.jsx" -Pattern "api\.anthropic\.com" -ErrorAction SilentlyContinue | Where-Object { $_.Path -notmatch "test|node_modules" }
if ($AnthropicCalls) {
    Write-Host "❌ FOUND DIRECT ANTHROPIC CALLS IN FRONTEND:" -ForegroundColor Red
    $AnthropicCalls | ForEach-Object { Write-Host $_.Line -ForegroundColor Red }
    $ErrorCount++
} else {
    Write-Host "✅ No direct Anthropic calls in frontend" -ForegroundColor Green
}

# 3. Check for API keys in localStorage
Write-Host ""
Write-Host "▶ Checking for localStorage API key storage..." -ForegroundColor Yellow
$LocalStorageKeys = Select-String -Path "src\**\*.js", "src\**\*.jsx" -Pattern "localStorage\.(setItem|getItem).*api.*key" -ErrorAction SilentlyContinue | Where-Object { $_.Path -notmatch "test|node_modules" }
if ($LocalStorageKeys) {
    Write-Host "⚠️  FOUND LOCALSTORAGE API KEY REFERENCES:" -ForegroundColor Yellow
    $LocalStorageKeys | ForEach-Object { Write-Host "  $($_.Path):$($_.LineNumber) - $($_.Line.Trim())" }
    Write-Host "  (Review to ensure these are reads for migration, not writes)" -ForegroundColor Yellow
} else {
    Write-Host "✅ No localStorage API key storage found" -ForegroundColor Green
}

# 4. Check backend is available (optional - may not be running)
Write-Host ""
Write-Host "▶ Checking backend availability..." -ForegroundColor Yellow
try {
    $BackendHealth = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backend not running (start with: npm run server)" -ForegroundColor Yellow
}

# 5. Run integration tests specifically
Write-Host ""
Write-Host "▶ Running integration tests..." -ForegroundColor Yellow
$IntegrationResult = npx vitest run src/__tests__/integration --reporter=dot 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ INTEGRATION TESTS FAILED" -ForegroundColor Red
    $ErrorCount++
} else {
    Write-Host "✅ Integration tests passed" -ForegroundColor Green
}

# 6. Check required files exist
Write-Host ""
Write-Host "▶ Checking required files..." -ForegroundColor Yellow
$RequiredFiles = @(
    "server/index.js",
    "server/db.js",
    "server/routes/config.js",
    "src/services/api/backendClient.js",
    "src/components/Admin/DrugReviewDashboard.jsx"
)
$MissingFiles = @()
foreach ($file in $RequiredFiles) {
    if (-not (Test-Path $file)) {
        $MissingFiles += $file
    }
}
if ($MissingFiles.Count -gt 0) {
    Write-Host "❌ MISSING REQUIRED FILES:" -ForegroundColor Red
    $MissingFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    $ErrorCount++
} else {
    Write-Host "✅ All required files exist" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
if ($ErrorCount -eq 0) {
    Write-Host "  ✅ ALL VERIFICATIONS PASSED - SAFE TO COMMIT" -ForegroundColor Green
} else {
    Write-Host "  ❌ $ErrorCount VERIFICATION(S) FAILED - DO NOT COMMIT" -ForegroundColor Red
}
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan

exit $ErrorCount
