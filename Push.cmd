@echo off
cd /d D:\code\claude
echo.
echo === Pushing to GitLab ===
git add .
git status --short
echo.
set /p MSG="Commit message (or press Enter for timestamp): "
if "%MSG%"=="" set MSG=Update %DATE% %TIME%
git commit -m "%MSG%"
git push
echo.
echo === Done ===
pause