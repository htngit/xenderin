@echo off
echo Checking if Node.js is installed...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed on your system.
    echo Please install Node.js from https://nodejs.org/ before running this application.
    echo.
    echo After installing Node.js, please restart your command prompt or terminal,
    echo then run this script again.
    pause
    exit /b 1
)

echo Node.js is installed. Checking if npm is available...
npm --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo npm is not available. Please check your Node.js installation.
    pause
    exit /b 1
)

echo Installing or updating dependencies...
npm install

if %ERRORLEVEL% NEQ 0 (
    echo Failed to install dependencies
    pause
    exit /b %ERRORLEVEL%
)

echo Starting Electron development server...
npm run electron:dev

echo.
echo If the application window doesn't appear, please check the console for any error messages.
pause