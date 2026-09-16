@echo off
chcp 65001 > nul
echo ===================================================
echo       🍦 جارى تشغيل نظام دندنه لإدارة الفروع...
echo ===================================================
echo.

:: 1. Sync frontend files
xcopy /E /I /Y "c:\Users\PanDa\Desktop\دندنه\frontend\src\*" "C:\dandana-frontend\src\" > nul 2>&1

:: 2. Kill old port instances if hung (5000 & 5001)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5001 ^| findstr LISTENING') do taskkill /F /PID %%a > nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do taskkill /F /PID %%a > nul 2>&1

:: 3. Start Backend in background (Port 5001)
start "Dendene-Backend" /min cmd /c "cd /d c:\Users\PanDa\Desktop\دندنه\backend && node server.js"

:: 4. Start Frontend in background (Port 5000)
start "Dendene-Frontend" /min cmd /c "cd /d C:\dandana-frontend && npx vite --host 0.0.0.0 --port 5000"

timeout /t 3 > nul
echo.
echo ===================================================
echo   ✅ تم تشغيل النظام بنجاح!
echo.
echo   🔗 افتح الرابط: http://localhost:5000
echo ===================================================
start http://localhost:5000
exit
