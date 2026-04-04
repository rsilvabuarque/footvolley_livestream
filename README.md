# Footvolley Livestream System 🏐

A complete solution for livestreaming footvolley tournaments with professional overlays, real-time score updates, and referee control interface.

## 🎯 Features

- **🎮 Easy Referee Control** - Large, simple buttons for non-tech-savvy referees
- **📺 Professional Overlay** - Transparent graphics for OBS Studio
- **📱 Mobile-Friendly** - Control from phone, tablet, or laptop
- **🏆 Live Rankings** - Google Sheets integration for tournament standings
- **🔄 Replay Management** - Queue and display replays during matches
- **⚡ Real-Time Updates** - Instant synchronization between control and overlay
- **🖥️ GoPro Compatible** - Works with GoPro Webcam Utility

## 🚀 Quick Start (Clone to Overlay)

Follow these exact steps from a clean machine:

### 1. Clone the repository
```bash
git clone https://github.com/rsilvabuarque/footvolley_livestream.git
cd footvolley_livestream
```

### 2. Install Node.js dependencies
Use Node.js 18+.

```bash
npm install
```

### 3. Optional: run setup script (installs helper files/checks)
Linux/macOS:

```bash
chmod +x setup.sh
./setup.sh
```

Windows:

```bat
setup.bat
```

### 4. Start the web app
```bash
npm start
```

### 5. Open the app pages
- Referee control page: http://localhost:3000/control.html
- OBS overlay page: http://localhost:3000/overlay.html

### 6. Add the overlay in OBS Studio
1. Open OBS Studio
2. Add **Video Capture Device** and select your camera (GoPro Webcam if used)
3. Add **Browser Source** with:
   - URL: http://localhost:3000/overlay.html
   - Width: 1920
   - Height: 1080
   - Enable "Shutdown source when not visible"

### 7. Start operating
- Use the control page to update scores and match data in real time
- Keep the overlay URL in OBS for stream output

## 🏗️ System Architecture

```
GoPro Hero 9 → GoPro Webcam Utility → OBS Studio → Live Stream
                                        ↑
                                   Browser Overlay
                                        ↑
                              Node.js Server + Socket.IO
                                        ↑
                               Referee Control Interface
                                   (Phone/Laptop)
```

## 📱 Referee Interface

The referee control panel is designed for ease of use during matches:

### Main Controls
- **Large Score Buttons** - +1/-1 for each team
- **Team Names** - Easy text input
- **Player Names** - Optional individual player display
- **Set Management** - Track best-of-3 sets
- **Quick Reset** - Reset scores or entire match

### Live Features
- **🔄 Replay Queue** - Add replays during play, show during breaks
- **🏆 Rankings Display** - Show tournament standings (10 seconds)
- **⌨️ Keyboard Shortcuts** - Fast control during intense moments
  - `1` / `2` = Add point to team
  - `R` = Show replay
  - `T` = Toggle rankings
  - `ESC` = Reset scores

## 🎨 Overlay Design

Professional footvolley-themed overlay featuring:
- **Gold accents** - Premium tournament look
- **Clear score display** - Large, readable numbers
- **Set tracking** - Visual set progression
- **Tournament context** - Round and match information
- **Animated elements** - Smooth transitions and effects

## 🏆 Google Sheets Integration

### Setup (Optional)
1. Create [Google Cloud Project](https://console.cloud.google.com/)
2. Enable Google Sheets API
3. Create service account credentials
4. Download `credentials.json`
5. Update `.env` file:
```bash
GOOGLE_CREDENTIALS_PATH=./credentials.json
GOOGLE_SHEET_ID=your_sheet_id_here
```

### Sheet Format
Create a sheet named "Rankings" with columns:
| Team Name | Wins | Points | Additional Info |
|-----------|------|--------|----------------|
| Beach Legends | 3 | 9 | |
| Sand Warriors | 2 | 6 | |

## 🔧 Hardware Setup

### Required Equipment
- **GoPro Hero 9** (your camera)
- **Laptop** (Windows/Mac/Linux)
- **Power bank** (for extended recording)
- **Phone/tablet** (referee control)

### GoPro Webcam Setup
1. Download [GoPro Webcam Utility](https://gopro.com/en/us/shop/softwareandapp/gopro-webcam/desktop)
2. Connect GoPro via USB
3. Launch GoPro Webcam Utility
4. Select GoPro as video source in OBS

### Audio Options
- **Option 1**: Use GoPro built-in microphone
- **Option 2**: External microphone → audio interface → laptop
- **Option 3**: Wireless lavalier system

## 📦 Deployment Options

### Option 1: Local Development
```bash
npm start
```

### Option 2: Windows Executable
```bash
npm run build-exe
```
Creates `footvolley-livestream.exe` for easy distribution.

### Option 3: Cloud Deployment
Deploy to platforms like:
- Heroku
- DigitalOcean
- AWS
- Vercel

## 🛠️ Customization

### Styling
Edit `public/overlay.html` CSS for:
- Colors and branding
- Logo placement
- Font changes
- Animation adjustments

### Functionality
Modify `server.js` for:
- Different scoring systems
- Additional data fields
- Custom tournament formats
- API integrations

## 📖 Usage Guide

### For Referees
1. **Before Match**:
   - Enter team names
   - Set tournament info
   - Test replay function

2. **During Match**:
   - Use +1/-1 buttons for scores
   - Queue interesting replays
   - Monitor set progression

3. **Between Sets**:
   - Show queued replays
   - Display tournament rankings
   - Reset for next set

### For Streamers
1. **Setup**:
   - Position GoPro for best angle
   - Test overlay visibility
   - Check audio levels
   - Start background recording

2. **During Tournament**:
   - Monitor stream quality
   - Coordinate with referee
   - Manage replay timing
   - Update tournament info

## 🔍 Troubleshooting

### Common Issues

**"Connection failed"**
- Check if server is running (`npm start`)
- Verify port 3000 is available
- Try refreshing browser

**"GoPro not detected"**
- Install GoPro Webcam Utility
- Check USB connection
- Restart OBS Studio

**"Overlay not showing"**
- Verify Browser Source URL
- Check overlay dimensions (1920x1080)
- Ensure transparent background

**"Rankings not loading"**
- Google Sheets setup is optional
- Check credentials.json path
- Verify sheet permissions

### Performance Tips
- Close unnecessary browser tabs
- Use wired internet connection
- Lower OBS resolution if needed
- Monitor CPU usage

## 🤝 Contributing

This system is designed for the footvolley community. Contributions welcome:

1. Fork the repository
2. Create feature branch
3. Test thoroughly
4. Submit pull request

### Ideas for Enhancement
- Multi-language support
- Player statistics tracking
- Social media integration
- Mobile app version
- Video replay integration

## 📄 License

MIT License - Feel free to use for your tournaments!

## 📞 Support

For technical support:
1. Check the detailed comments in code files
2. Review console logs for error messages
3. Test with placeholder data first
4. Create GitHub issue with details

---

**Ready to elevate your footvolley tournament streaming! 🏐🎥**
