@echo off
cd /d D:\code\claude
echo.
echo === Syncing with GitLab ===
echo Pulling latest first...
git pull
echo.
git status --short
echo.
set /p MSG="Commit message (or press Enter for timestamp): "
if "%MSG%"=="" set MSG=Update %DATE% %TIME%
git add .
git commit -m "%MSG%"
git push
echo.
echo === Done ===
pause