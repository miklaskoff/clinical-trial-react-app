@echo off
chcp 65001 >nul
echo ========================================
echo Starting Clinical Trial App Servers
echo ========================================

:: Kill any existing node processes
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

:: Start backend in separate CMD window
echo Starting Backend on port 3001...
start "Backend Server (3001)" cmd /k "cd /d %~dp0server && node index.js"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend in separate CMD window  
echo Starting Frontend on port 3000...
start "Frontend Server (3000)" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ========================================
echo Both servers started in separate windows!
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:3001
echo.
echo DO NOT CLOSE THE CMD WINDOWS!
echo ========================================
echo.
pause
