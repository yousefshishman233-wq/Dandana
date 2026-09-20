@echo off
chcp 65001 > nul
echo ===================================================
echo       🍦 جارى تشغيل نظام دندنه لإدارة الفروع...
echo ===================================================
echo.

:: 1. Start Backend in background (Port 5001)
start "Dendene-Backend" /min cmd /c "cd /d %~dp0backend && set PORT=5001&& node server.js"

:: 2. Start Frontend in background (Port 5000)
start "Dendene-Frontend" /min cmd /c "cd /d %~dp0frontend && .\node_modules\.bin\vite.cmd --host 0.0.0.0 --port 5000"

timeout /t 3 > nul
echo.
echo ===================================================
echo   ✅ تم تشغيل النظام بنجاح!
echo.
echo   🔗 افتح الرابط: http://localhost:5000
echo ===================================================
start http://localhost:5000
exit
