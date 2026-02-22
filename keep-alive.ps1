# KEEP-ALIVE SCRIPT - Monitors and auto-restarts servers
# Run this once and it will NEVER let servers die

$projectRoot = "c:\Users\lasko\Downloads\clinical-trial-react-app"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SERVER KEEP-ALIVE MONITOR STARTED" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop monitoring" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Start-FrontendServer {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Starting Frontend (port 3000)..." -ForegroundColor Yellow
    $proc = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $projectRoot -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 3
    return $proc
}

function Start-BackendServer {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Starting Backend (port 3001)..." -ForegroundColor Yellow
    $proc = Start-Process -FilePath "npm" -ArgumentList "run", "dev:backend" -WorkingDirectory $projectRoot -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 3
    return $proc
}

function Test-PortListening {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return ($null -ne $conn)
}

# Initial check and start
$frontendRunning = Test-PortListening -Port 3000
$backendRunning = Test-PortListening -Port 3001

if (-not $frontendRunning) { Start-FrontendServer }
if (-not $backendRunning) { Start-BackendServer }

Write-Host ""
Write-Host "Monitoring every 5 seconds..." -ForegroundColor Gray
Write-Host ""

# Main monitoring loop - runs FOREVER
while ($true) {
    $frontendRunning = Test-PortListening -Port 3000
    $backendRunning = Test-PortListening -Port 3001
    
    $status = "[$(Get-Date -Format 'HH:mm:ss')] "
    
    if ($frontendRunning -and $backendRunning) {
        $status += "Frontend: " + [char]0x2705 + " | Backend: " + [char]0x2705
        Write-Host $status -ForegroundColor Green
    } else {
        if (-not $frontendRunning) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Frontend DEAD! Restarting..." -ForegroundColor Red
            Start-FrontendServer
        }
        if (-not $backendRunning) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Backend DEAD! Restarting..." -ForegroundColor Red
            Start-BackendServer
        }
    }
    
    Start-Sleep -Seconds 5
}
