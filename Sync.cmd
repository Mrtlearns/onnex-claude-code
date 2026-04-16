@echo off
setlocal enabledelayedexpansion
cd /d D:\code\claude

echo.
echo === Claude Workspace Sync ===
echo.

echo Checking remote...
git fetch origin 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Cannot reach GitLab. Check network.
    goto :end
)

REM How many commits remote has that local doesn't
for /f %%i in ('git rev-list HEAD..origin/master --count 2^>nul') do set REMOTE_AHEAD=%%i
REM How many commits local has that remote doesn't
for /f %%i in ('git rev-list origin/master..HEAD --count 2^>nul') do set LOCAL_AHEAD=%%i
REM Any uncommitted local changes?
git diff-index --quiet HEAD -- 2>nul
set DIRTY=%ERRORLEVEL%

if "%REMOTE_AHEAD%"=="" set REMOTE_AHEAD=0
if "%LOCAL_AHEAD%"=="" set LOCAL_AHEAD=0

echo   Remote ahead  : %REMOTE_AHEAD% commit(s)
echo   Local ahead   : %LOCAL_AHEAD% commit(s)
echo   Local changes : %DIRTY% (0=none)
echo.

REM --- Already in sync, nothing to do ---
if %REMOTE_AHEAD%==0 if %LOCAL_AHEAD%==0 if %DIRTY%==0 (
    echo [OK] Already up to date. Nothing to do.
    goto :end
)

REM --- Remote only has new commits, local is clean -> just pull ---
if %REMOTE_AHEAD% GTR 0 if %LOCAL_AHEAD%==0 if %DIRTY%==0 (
    echo [PULL] Remote has %REMOTE_AHEAD% new commit(s^). Pulling...
    git pull
    goto :end
)

REM --- Local has uncommitted changes -> stage and commit first ---
if %DIRTY% GTR 0 (
    echo [PUSH] Local changes detected:
    git status --short
    echo.
    set /p MSG="Commit message (Enter for timestamp): "
    if "!MSG!"=="" set MSG=Update %DATE% %TIME%
    git add .
    git commit -m "!MSG!"
)

REM --- Remote also moved on -> pull (merge) before pushing ---
if %REMOTE_AHEAD% GTR 0 (
    echo.
    echo [MERGE] Remote also has %REMOTE_AHEAD% new commit(s^). Merging...
    git pull
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] Merge conflict - resolve manually then run Push.cmd
        goto :end
    )
)

echo.
echo [PUSH] Pushing to GitLab...
git push

:end
echo.
echo === Done ===
pause