@echo off
:: PhD Management System — Install All Dependencies (Windows)

echo.
echo ============================================================
echo   PhD Management System — Installing All Dependencies
echo ============================================================
echo.

echo [1/8] Student Backend...
cd /d %~dp0..\student\backend && npm install

echo [2/8] Student Frontend...
cd /d %~dp0..\student\frontend && npm install

echo [3/8] Admin Backend...
cd /d %~dp0..\admin\backend && npm install

echo [4/8] Admin Frontend...
cd /d %~dp0..\admin\frontend && npm install

echo [5/8] Supervisor Backend...
cd /d %~dp0..\supervisor\backend && npm install

echo [6/8] Supervisor Frontend...
cd /d %~dp0..\supervisor\frontend && npm install

echo [7/8] Center Backend...
cd /d %~dp0..\center\backend && npm install

echo [8/8] Center Frontend...
cd /d %~dp0..\center\frontend && npm install

echo.
echo All dependencies installed successfully!
echo Run scripts\start-all.bat to start all backends.
echo Run scripts\start-frontends.bat to start all frontends.
echo.
pause
