@echo off
start /B node server/index.js
timeout /T 3 /NOBREAK >nul
start "" "http://localhost:3001/auth.html"
echo.
echo Server started on http://localhost:3001
echo Auth page opened in browser.
echo Press any key to stop the server...
pause >nul
taskkill /F /IM node.exe /T >nul 2>&1
