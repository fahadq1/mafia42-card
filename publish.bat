@echo off
cd /d "%~dp0"

echo ==============================
echo Building site for publishing...
echo ==============================
"C:\Program Files\nodejs\node.exe" ".\node_modules\next\dist\bin\next" build
if errorlevel 1 (
  echo.
  echo Build failed. Publishing stopped.
  pause
  exit /b 1
)

echo.
echo ==============================
echo Build succeeded.
echo ==============================
echo.
echo Next GitHub steps:
echo 1. git init
echo 2. git add .
echo 3. git commit -m "Initial publish"
echo 4. git branch -M main
echo 5. git remote add origin YOUR_GITHUB_REPO_URL
echo 6. git push -u origin main
echo.
echo After push:
echo - Open your GitHub repository
echo - Go to Settings ^> Pages
echo - Set Source to GitHub Actions
echo.
echo The workflow in .github\workflows\deploy-pages.yml will handle deployment.
echo.
pause
