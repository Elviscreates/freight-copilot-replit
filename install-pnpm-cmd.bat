@echo off
setlocal
call "C:\Program Files\nodejs\..\..\..\WINDOWS\system32\..." 2>nul
set "NODE_PATH=C:\Program Files\nodejs"
set "PATH=%NODE_PATH%;%PATH%"
echo Installing pnpm...
npm install -g pnpm
if %errorlevel% neq 0 (
    echo Failed to install pnpm
    exit /b %errorlevel%
)
pnpm --version