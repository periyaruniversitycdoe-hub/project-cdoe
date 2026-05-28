@echo off
:: PhD Management System — Start All Backends (Windows)

echo.
echo ============================================================
echo   PhD Management System — Starting All Backend Servers
echo ============================================================
echo.

start "Student Backend (5000)"    cmd /k "cd /d %~dp0..\student\backend    && npm start"
timeout /t 2 /nobreak >nul

start "Admin Backend (5001)"      cmd /k "cd /d %~dp0..\admin\backend      && npm start"
timeout /t 2 /nobreak >nul

start "Supervisor Backend (5002)" cmd /k "cd /d %~dp0..\supervisor\backend && npm start"
timeout /t 2 /nobreak >nul

start "Center Backend (5003)"     cmd /k "cd /d %~dp0..\center\backend     && npm start"

echo.
echo All backends started in separate windows.
echo   Student    : http://localhost:5000
echo   Admin      : http://localhost:5001
echo   Supervisor : http://localhost:5002
echo   Center     : http://localhost:5003
echo.
