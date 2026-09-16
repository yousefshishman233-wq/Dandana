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
echo  [1/2] تشغيل الـ Backend على Port 5000...
start "Dandana - Backend :5000" cmd /k "cd /d C:\Users\PanDa\Desktop\دندنه\backend && node server.js"

timeout /t 2 /nobreak > nul

echo  [2/2] تشغيل الـ Frontend على Port 3000...
start "Dandana - Frontend :3000" cmd /k "cd /d C:\dandana-frontend && .\node_modules\.bin\vite.cmd --port 3000"

timeout /t 3 /nobreak > nul

echo.
echo  ==========================================
echo   التطبيق شغال!
echo  ==========================================
echo.
echo   الرابط:  http://localhost:3000
echo.
echo   بيانات الدخول:
echo   المدير  : admin       / admin123
echo   كاشير 1 : cashier1    / cashier123
echo   كاشير 2 : cashier2    / cashier456
echo   موظف 1  : emp1        / emp123
echo   موظف 2  : emp2        / emp456
echo   موظف 3  : emp3        / emp789
echo.
echo  ==========================================
echo   ملاحظة: لو عدّلت ملفات الـ frontend
echo   شغّل: sync-frontend.ps1 للمزامنة
echo  ==========================================
echo.
start "" "http://localhost:3000"
pause
