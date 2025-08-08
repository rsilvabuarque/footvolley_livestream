@echo off
REM FOOTVOLLEY LIVESTREAM SETUP SCRIPT FOR WINDOWS
REM This batch file sets up everything you need for the footvolley livestream system

echo.
echo 🏐 FOOTVOLLEY LIVESTREAM SETUP
echo ================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js first:
    echo    Visit: https://nodejs.org/en/download/
    echo    Download and run the Windows installer
    pause
    exit /b 1
)

echo ✅ Node.js found
node --version

REM Install dependencies
echo.
echo 📦 Installing dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully

REM Create environment file if it doesn't exist
if not exist .env (
    echo.
    echo 📄 Creating environment configuration...
    copy .env.example .env >nul
    echo ✅ Environment file created (.env)
    echo    💡 You can edit .env to add Google Sheets integration later
) else (
    echo ✅ Environment file already exists
)

REM Create necessary directories
if not exist logs mkdir logs
if not exist credentials mkdir credentials

echo.
echo 🎯 SETUP COMPLETE!
echo ==================
echo.
echo 📋 NEXT STEPS:
echo.
echo 1. 🚀 START THE SYSTEM:
echo    npm start
echo.
echo 2. 📱 REFEREE CONTROL:
echo    Open: http://localhost:3000/control.html
echo    (Opens automatically when you start the system)
echo.
echo 3. 📺 OBS OVERLAY:
echo    Add Browser Source in OBS Studio
echo    URL: http://localhost:3000/overlay.html
echo    Width: 1920, Height: 1080
echo.
echo 4. 📷 GOPRO SETUP:
echo    - Download GoPro Webcam Utility from GoPro website
echo    - Connect GoPro via USB
echo    - Set GoPro as webcam in OBS
echo    - Add overlay as Browser Source on top
echo.
echo 🔧 OPTIONAL FEATURES:
echo.
echo 🏆 GOOGLE SHEETS RANKINGS:
echo    1. Create Google Cloud project
echo    2. Enable Google Sheets API
echo    3. Create service account
echo    4. Download credentials.json
echo    5. Edit .env file with your sheet ID
echo.
echo 💼 WINDOWS EXECUTABLE:
echo    npm run build-exe
echo    (Creates footvolley-livestream.exe)
echo.
echo 📖 REFEREE QUICK GUIDE:
echo    - Large buttons for easy clicking during matches
echo    - Keyboard shortcuts: 1/2 = add points, R = replay, T = rankings
echo    - Everything updates live on the overlay
echo    - Mobile-friendly for tablet/phone control
echo.
echo 🆘 NEED HELP?
echo    - All files are heavily commented
echo    - Check the server console for status messages
echo    - Overlay works even without Google Sheets
echo.
echo 🎉 Ready to stream your footvolley tournament!
echo.
pause
