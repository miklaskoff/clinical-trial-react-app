@echo off
echo Starting Clinical Trial App Development Servers...
echo.
echo Frontend will be on: http://localhost:3000
echo Backend will be on: http://localhost:3001
echo.
echo Press Ctrl+C to stop both servers
echo.
npx concurrently "npm run dev" "npm run dev:backend" --names "frontend,backend" --prefix-colors "cyan,magenta"
