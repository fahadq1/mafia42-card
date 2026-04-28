@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" ".\node_modules\next\dist\bin\next" build
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)
echo.
echo Build finished. Open out\index.html
pause
