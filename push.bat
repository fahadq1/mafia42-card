@echo off
setlocal
cd /d "%~dp0"

echo ==============================
echo Building site...
echo ==============================
"C:\Program Files\nodejs\node.exe" ".\node_modules\next\dist\bin\next" build
if errorlevel 1 (
  echo.
  echo Build failed. Push stopped.
  pause
  exit /b 1
)

echo.
echo ==============================
echo Staging changes...
echo ==============================
"C:\Program Files\Git\cmd\git.exe" add .
if errorlevel 1 (
  echo.
  echo git add failed.
  pause
  exit /b 1
)

set /p COMMIT_MSG=Enter commit message: 
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Update site

echo.
echo ==============================
echo Committing changes...
echo ==============================
"C:\Program Files\Git\cmd\git.exe" commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo.
  echo No commit created. This can happen if there are no changes.
  pause
  exit /b 1
)

echo.
echo ==============================
echo Pushing to GitHub...
echo ==============================
"C:\Program Files\Git\cmd\git.exe" push
if errorlevel 1 (
  echo.
  echo Push failed.
  pause
  exit /b 1
)

echo.
echo Done. GitHub will now rebuild and publish the site.
pause
