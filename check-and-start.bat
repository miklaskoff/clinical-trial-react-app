@echo off
:: Auto-start script that checks and starts missing servers
:: Run this instead of individual npm run dev commands

echo ========================================
echo Clinical Trial App - Server Check
echo ========================================
echo.

:: Check if frontend is running (port 3000)
netstat -an | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Frontend already running on port 3000
) else (
    echo [!!] Frontend not running - starting...
    start "Frontend" cmd /c "cd /d %~dp0 && npm run dev"
    timeout /t 2 >nul
)

:: Check if backend is running (port 3001)
netstat -an | findstr ":3001 " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Backend already running on port 3001
) else (
    echo [!!] Backend not running - starting...
    start "Backend" cmd /c "cd /d %~dp0\server && npm start"
    timeout /t 2 >nul
)

echo.
echo ========================================
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:3001
echo Parser:   http://localhost:3000/parser
echo ========================================
echo.
echo Press any key to open the app in browser...
pause >nul
start http://localhost:3000/parser
