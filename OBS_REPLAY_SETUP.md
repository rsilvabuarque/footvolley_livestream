# 🎬 OBS Replay System Setup Guide

## Overview
The San Diego Footvolley Open overlay now includes a comprehensive replay system that integrates with OBS Studio for professional instant replays during live streaming.

## 🎯 How It Works

### Replay Workflow
1. **Trigger Replay** → Shows transition scene with Bonita Cove background + OPEN logo
2. **Manual OBS Control** → You switch to your replay source using OBS hotkeys
3. **Auto Return** → System automatically returns to live camera after set duration
4. **Skip Option** → Manual skip button to return to live immediately

## 🛠️ OBS Studio Setup

### Required Scenes

Create these scenes in OBS Studio:

#### 1. `Main_Camera` (Your live feed)
- **Sources:**
  - Camera/Video Capture Device
  - Browser Source: `http://localhost:3000/overlay.html`
  - Any other live elements (audio, etc.)

#### 2. `Replay_Transition` (Transition scene)
- **Sources:**
  - Image Source: `Bonita_cove_transition.jpg` (full screen)
  - Image Source: `OPEN_SDFTV_grey_logo.png` (centered, scaled to fit)
  - Browser Source: `http://localhost:3000/overlay.html` (for controls)

#### 3. `Replay_Scene` (Your replay source)
- **Sources:**
  - Your replay source (OBS Replay Buffer, external replay device, etc.)
  - Browser Source: `http://localhost:3000/overlay.html` (optional, for overlay)

### Recommended OBS Settings

#### Replay Buffer Setup
1. Go to **Settings → Output**
2. Enable **Replay Buffer**
3. Set **Maximum Replay Time**: 30-60 seconds
4. Set **Replay Buffer Hotkey** in **Settings → Hotkeys**

#### Scene Transition Hotkeys
1. Go to **Settings → Hotkeys**
2. Set hotkeys for quick scene switching:
   - `F1` → Main_Camera
   - `F2` → Replay_Transition  
   - `F3` → Replay_Scene

## 🎮 Control Panel Usage

### Access Control Panel
Navigate to: `http://localhost:3000/control.html`

### Replay Controls Section

#### Trigger Replay
1. Select replay duration (10-30 seconds)
2. Click **"🎬 Trigger Replay"**
3. System shows transition scene automatically
4. **You manually switch to replay scene in OBS**
5. System auto-returns to live after duration

#### Skip to Live
- Click **"⏭️ Skip to Live"** to immediately return to Main_Camera
- Useful if replay is shorter than expected

## 🔄 Step-by-Step Replay Process

### During Live Match

1. **Point Scored** → Great play happens
2. **Press Hotkey** → Save to OBS Replay Buffer
3. **Click "Trigger Replay"** → In control panel
4. **Transition Appears** → Bonita Cove + OPEN logo
5. **Switch to Replay** → Use OBS hotkey to show replay
6. **Auto Return** → System returns to live after duration

### Quick Workflow Example
```
Point scored → F5 (save replay) → Click "Trigger Replay" → F3 (show replay) → Wait/Skip
```

## ⌨️ Keyboard Shortcuts

### In Overlay Window
- `R` → Trigger replay (15 seconds)
- `S` → Skip to live
- `Esc` → Force return to live

### Recommended OBS Hotkeys
- `F1` → Main_Camera scene
- `F2` → Replay_Transition scene  
- `F3` → Replay_Scene scene
- `F5` → Save Replay Buffer
- `F6` → Save Replay Buffer to File

## 🎨 Visual Elements

### Transition Scene
- **Background:** Bonita Cove beach image (full screen)
- **Logo:** OPEN SDFTV grey logo (centered, scaled)
- **Duration:** 3 seconds default
- **Purpose:** Professional transition between live and replay

### Replay Controls
- **Position:** Bottom center of screen during replay
- **Buttons:** Start Replay, Skip to Live
- **Auto-hide:** When not in replay mode

## 🔧 Technical Configuration

### Files Used
- `Bonita_cove_transition.jpg` → Transition background
- `OPEN_SDFTV_grey_logo.png` → Transition logo overlay
- Browser Source → `http://localhost:3000/overlay.html`

### Network Events
- `triggerReplay` → Starts replay sequence
- `obs-change-scene` → Scene switching communication
- Real-time WebSocket communication between control panel and overlay

## 📱 Mobile Control

The control panel is mobile-responsive, so you can:
- Use a tablet as a referee control panel
- Trigger replays from any device on the network
- Multiple referees can connect simultaneously

## 🚀 Pro Tips

### Smooth Workflow
1. **Pre-configure** all OBS scenes before match
2. **Test hotkeys** to ensure smooth transitions
3. **Practice** the replay workflow during warmups
4. **Use tablet** for control panel if computer is far away

### Best Practices
- Save replay buffer **immediately** after great plays
- Use **shorter durations** (10-15s) for quick points
- Use **longer durations** (20-30s) for rally highlights
- **Skip manually** if replay is boring or too short

### Troubleshooting
- If overlay doesn't update → Refresh browser source in OBS
- If controls don't appear → Check network connection
- If scenes don't switch → Verify scene names match exactly

## 🎥 Alternative Replay Sources

### If you don't have OBS Replay Buffer:
1. **External Replay Device** (like ATEM Mini)
2. **Secondary Camera** with manual replay
3. **Screen Recording Software** with hotkey save
4. **Video Mixer** with built-in replay

### Integration Options:
- Connect any replay source to `Replay_Scene`
- Use transition for professional appearance
- Manual timing control through overlay system

## 📞 Support

For technical issues:
1. Check browser console for errors (`F12`)
2. Verify all file paths are correct
3. Test network connectivity
4. Restart Node.js server if needed

This system gives you professional-grade replay control while maintaining the tournament branding and visual consistency!
