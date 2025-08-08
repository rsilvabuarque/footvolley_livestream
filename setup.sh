#!/bin/bash

# FOOTVOLLEY LIVESTREAM SETUP SCRIPT
# This script sets up everything you need for the footvolley livestream system

echo "🏐 FOOTVOLLEY LIVESTREAM SETUP"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first:"
    echo "   Visit: https://nodejs.org/en/download/"
    echo "   Or use: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash-"
    echo "           sudo apt-get install -y nodejs"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📄 Creating environment configuration..."
    cp .env.example .env
    echo "✅ Environment file created (.env)"
    echo "   💡 You can edit .env to add Google Sheets integration later"
else
    echo "✅ Environment file already exists"
fi

# Create necessary directories
mkdir -p logs
mkdir -p credentials

echo ""
echo "🎯 SETUP COMPLETE!"
echo "=================="
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. 🚀 START THE SYSTEM:"
echo "   npm start"
echo ""
echo "2. 📱 REFEREE CONTROL:"
echo "   Open: http://localhost:3000/control.html"
echo "   (Opens automatically when you start the system)"
echo ""
echo "3. 📺 OBS OVERLAY:"
echo "   Add Browser Source in OBS Studio"
echo "   URL: http://localhost:3000/overlay.html"
echo "   Width: 1920, Height: 1080"
echo ""
echo "4. 📷 GOPRO SETUP:"
echo "   - Install GoPro Webcam Utility"
echo "   - Set GoPro as webcam in OBS"
echo "   - Add overlay as Browser Source on top"
echo ""
echo "🔧 OPTIONAL FEATURES:"
echo ""
echo "🏆 GOOGLE SHEETS RANKINGS:"
echo "   1. Create Google Cloud project"
echo "   2. Enable Google Sheets API"
echo "   3. Create service account"
echo "   4. Download credentials.json"
echo "   5. Edit .env file with your sheet ID"
echo ""
echo "💼 WINDOWS EXECUTABLE:"
echo "   npm run build-exe"
echo "   (Creates footvolley-livestream.exe)"
echo ""
echo "📖 REFEREE QUICK GUIDE:"
echo "   - Large buttons for easy clicking during matches"
echo "   - Keyboard shortcuts: 1/2 = add points, R = replay, T = rankings"
echo "   - Everything updates live on the overlay"
echo "   - Mobile-friendly for tablet/phone control"
echo ""
echo "🆘 NEED HELP?"
echo "   - All files are heavily commented"
echo "   - Check the server console for status messages"
echo "   - Overlay works even without Google Sheets"
echo ""
echo "🎉 Ready to stream your footvolley tournament!"
