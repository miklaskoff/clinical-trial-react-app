#!/usr/bin/env pwsh
# Run parser in isolated process

Set-Location "c:\Users\lasko\Downloads\clinical-trial-react-app\server"

Write-Host "Starting parser..."
node parse-full-cluster.js

Write-Host "`nParser finished. Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
