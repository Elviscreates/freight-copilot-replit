@echo off
set "NPM=C:\Program Files\nodejs\npm.cmd"
if not exist "%NPM%" (
    echo ERROR: npm not found at %NPM%
    exit /b 1
)
echo Installing pnpm globally...
"%NPM%" install -g pnpm
if %errorlevel% neq 0 (
    echo ERROR: Failed to install pnpm
    exit /b %errorlevel%
)
echo.
pnpm --version