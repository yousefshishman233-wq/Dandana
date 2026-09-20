@echo off
chcp 65001 > nul
echo.
echo  ██████╗  █████╗ ███╗   ██╗██████╗  █████╗ ███╗   ██╗ █████╗
echo  ██╔══██╗██╔══██╗████╗  ██║██╔══██╗██╔══██╗████╗  ██║██╔══██╗
echo  ██║  ██║███████║██╔██╗ ██║██║  ██║███████║██╔██╗ ██║███████║
echo  ██║  ██║██╔══██║██║╚██╗██║██║  ██║██╔══██║██║╚██╗██║██╔══██║
echo  ██████╔╝██║  ██║██║ ╚████║██████╔╝██║  ██║██║ ╚████║██║  ██║
echo  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝
echo.
echo  ==========================================
echo   نظام إدارة محل الآيس كريم
echo  ==========================================
echo.
echo  [1/2] تشغيل الـ Backend على Port 5001...
start "Dandana - Backend :5001" cmd /k "cd /d %~dp0backend && set PORT=5001&& node server.js"

timeout /t 2 /nobreak > nul

echo  [2/2] تشغيل الـ Frontend على Port 5000...
start "Dandana - Frontend :5000" cmd /k "cd /d %~dp0frontend && .\node_modules\.bin\vite.cmd --host 0.0.0.0 --port 5000"

timeout /t 3 /nobreak > nul

echo.
echo  ==========================================
echo   التطبيق شغال!
echo  ==========================================
echo.
echo   الرابط:  http://localhost:5000
echo.
echo   بيانات الدخول: استخدم الحسابات الموجودة في قاعدة البيانات.
echo   في بيئة التطوير فقط، يمكن إنشاء المدير عبر DEFAULT_ADMIN_PASSWORD.
echo.
echo  ==========================================
echo   ملاحظة: لو عدّلت ملفات الـ frontend
echo   شغّل: sync-frontend.ps1 للمزامنة
echo  ==========================================
echo.
start "" "http://localhost:5000"
pause
