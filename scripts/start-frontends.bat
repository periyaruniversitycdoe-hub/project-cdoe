@echo off
:: PhD Management System — Start All Frontends (Windows)

echo.
echo ============================================================
echo   PhD Management System — Starting All Frontend Dev Servers
echo ============================================================
echo.

start "Student Frontend (5173)"    cmd /k "cd /d %~dp0..\student\frontend    && npm run dev"
timeout /t 2 /nobreak >nul

start "Admin Frontend (5174)"      cmd /k "cd /d %~dp0..\admin\frontend      && npm run dev"
timeout /t 2 /nobreak >nul

start "Supervisor Frontend (5175)" cmd /k "cd /d %~dp0..\supervisor\frontend && npm run dev"
timeout /t 2 /nobreak >nul

start "Center Frontend (5176)"     cmd /k "cd /d %~dp0..\center\frontend     && npm run dev"

echo.
echo All frontends started in separate windows.
echo   Student    : http://localhost:5173
echo   Admin      : http://localhost:5174
echo   Supervisor : http://localhost:5175
echo   Center     : http://localhost:5176
echo.
