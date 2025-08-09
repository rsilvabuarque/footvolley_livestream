# 🎬 Simplified OBS Replay System Setup Guide

## Overview
This guide explains the **simplified replay system** for the San Diego Footvolley Open livestream. The system has been refactored to work seamlessly with your existing OBS automation setup.

## 🎯 Your Current OBS Setup Integration

### What You Already Have:
- **Ctrl+R hotkey** saves the last 10 seconds as a replay file
- **Replay_Scene** automatically loads the latest saved replay
- **Auto-script** plays replay videos at 0.5x speed
- **Main_Camera** scene for live coverage

### What the Web Interface Adds:
- **Simple 2-button control** for referees
- **Automatic scene switching** between Main_Camera and Replay_Scene
- **20-second auto-return timer** to live coverage
- **Visual status indicators** on the overlay

## 🔄 Simplified Workflow

### Step-by-Step Process:
1. **Referee clicks "Start Replay"** 
   - Web interface automatically switches OBS to `Replay_Scene`
   - Countdown timer begins (20 seconds)
   - Overlay shows "REPLAY" status

2. **You manually press Ctrl+R** (when you see scene switch to Replay_Scene)
   - OBS saves last 10 seconds to replay buffer
   - Your existing auto-script loads and plays replay at 0.5x speed

3. **Automatic return to live**
   - After 20 seconds, system automatically switches back to `Main_Camera`
   - OR referee can click "Skip to Live" to return immediately

### Why Manual Ctrl+R?
Browser security prevents web interfaces from triggering keyboard shortcuts automatically. The manual Ctrl+R step integrates smoothly with your existing workflow.

## 🛠️ Setup Requirements

### OBS Scenes (You Already Have):
```
✅ Main_Camera    - Your live camera scene
✅ Replay_Scene   - Your replay playback scene
```

### Web Interface URLs:
```
Control Panel:  http://localhost:3000/control.html
Overlay:        http://localhost:3000/overlay.html
```

### OBS Browser Source Settings:
```
URL:      http://localhost:3000/overlay.html
Width:    1920
Height:   1080
FPS:      30
```

## 🎮 Control Panel Interface

### Two Simple Buttons:
1. **"🎬 Start Replay"**
   - Switches to Replay_Scene
   - Starts 20-second countdown
   - Shows replay status on overlay

2. **"⏭️ Skip to Live"**
   - Immediately returns to Main_Camera
   - Cancels countdown timer
   - Returns to live status

### Visual Feedback:
- **Green buttons** when system is ready
- **Button state changes** during replay
- **Timer countdown** shows remaining time
- **Status display** shows current mode

## 📋 Pre-Tournament Checklist

### Server Setup:
- [ ] Start web server: `node server.js`
- [ ] Server shows "🚀 System ready!" message
- [ ] No error messages in console

### OBS Setup:
- [ ] Add overlay browser source with correct URL
- [ ] Verify Main_Camera scene exists and works
- [ ] Verify Replay_Scene scene exists and works
- [ ] Test Ctrl+R hotkey saves replays correctly
- [ ] Confirm auto-script loads replays at 0.5x speed

### Interface Testing:
- [ ] Open control panel: `http://localhost:3000/control.html`
- [ ] Click "Start Replay" - should switch to Replay_Scene
- [ ] Press Ctrl+R - should save and load replay
- [ ] Wait 20 seconds - should auto-return to Main_Camera
- [ ] Test "Skip to Live" button works immediately

## 🎯 Tournament Day Operations

### Referee Training:
- **One action:** Click "Start Replay" when great play happens
- **System handles:** Scene switching and timing automatically
- **Backup option:** "Skip to Live" if replay needs to end early

### Operator Actions:
- **Watch for scene switch** to Replay_Scene
- **Press Ctrl+R** to save and load replay
- **System handles** auto-return after 20 seconds

### Visual Indicators:
- **Overlay shows "REPLAY"** when in replay mode
- **Countdown timer** displays remaining time
- **Smooth transitions** between scenes

## 🔧 Technical Details

### Button Functions:
```javascript
triggerSimpleReplay() - Switches to Replay_Scene, starts timer
skipReplayToLive()    - Immediately returns to Main_Camera
```

### WebSocket Events:
```javascript
'trigger-replay' - Initiates replay sequence
'skip-replay'    - Skips to live coverage
```

### Scene Management:
- **Automatic switching** between Main_Camera and Replay_Scene
- **No transition scenes** - direct scene changes
- **20-second timer** with automatic return

## 🚨 Troubleshooting

### Common Issues:
| Problem | Solution |
|---------|----------|
| Replay doesn't start | Press Ctrl+R after clicking "Start Replay" |
| Wrong scene displayed | Check scene names match exactly: `Main_Camera`, `Replay_Scene` |
| No countdown timer | Verify overlay browser source is working |
| Replay doesn't auto-return | Check timer, use "Skip to Live" as backup |
| Buttons not working | Refresh control panel page |

### System Status Check:
- **Green buttons** = System ready
- **Timer visible** = Replay mode active
- **Scene switching** = OBS communication working
- **Console logs** = Check for error messages

## 🎥 Advantages of Simplified System

### For Referees:
- **Two buttons only** - Simple decision making
- **Visual feedback** - Clear status indicators
- **Automatic timing** - No manual timer management
- **Mistake-proof** - Auto-return prevents being stuck in replay

### For Operators:
- **Familiar workflow** - Uses your existing Ctrl+R process
- **Reliable automation** - Leverages your proven auto-script
- **Minimal changes** - Works with current OBS setup
- **Professional result** - Smooth transitions and timing

### For Tournament:
- **Consistent quality** - Standardized replay experience
- **Quick implementation** - No major setup changes needed
- **Reliable operation** - Simple system = fewer failure points
- **Professional appearance** - Branded overlay with clean transitions

## 🚀 Future Enhancements (Optional)

### Potential Upgrades:
- **OBS WebSocket integration** - Fully automated Ctrl+R triggering
- **Variable replay duration** - Adjustable replay length controls
- **Multiple replay buffers** - Support for different replay types
- **Advanced timing controls** - Custom auto-return durations

### Current System Benefits:
- **No additional software** required
- **Works with existing setup** seamlessly
- **Proven reliability** using your current automation
- **Simple maintenance** and troubleshooting

## 📞 Support Notes

The simplified system is designed to enhance rather than replace your existing OBS workflow. It provides professional referee controls while maintaining the reliability of your proven Ctrl+R automation. The manual step requirement actually improves reliability by ensuring human oversight of the replay process.

**Key Success Factor:** The system works best when the operator and referee coordinate timing - referee clicks "Start Replay" and operator watches for the scene change to trigger Ctrl+R.
