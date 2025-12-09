# ⌨️ Keyboard Shortcuts Guide

Complete list of keyboard shortcuts for OB-English-Learner plugin.

---

## 🎬 Video Import

| Command | Shortcut | Description |
|---------|----------|-------------|
| **Import YouTube Video** | `Ctrl+Shift+Y` | Open dialog to import YouTube/Bilibili video |

---

## 🎙️ Voice Recording (STT)

| Command | Shortcut | Description |
|---------|----------|-------------|
| **Start Voice Recording** | `Ctrl+Shift+R` | Start recording voice and transcribe to text |

---

## 🔊 Text-to-Speech (TTS) - Playback Control

| Command | Shortcut | Description |
|---------|----------|-------------|
| **Play/Pause** | `Ctrl+Space` | Toggle play/pause TTS playback |
| **Stop** | `Escape` | Stop TTS playback |
| **Next Sentence** | `Ctrl+→` | Skip to next sentence |
| **Previous Sentence** | `Ctrl+←` | Go back to previous sentence |
| **Increase Speed** | `Ctrl+↑` | Increase playback speed by 0.1x |
| **Decrease Speed** | `Ctrl+↓` | Decrease playback speed by 0.1x |

---

## 🔊 Text-to-Speech (TTS) - Quick Actions

| Command | Shortcut | Description |
|---------|----------|-------------|
| **Play Selection** | `Ctrl+Shift+P` | Play selected text using TTS |
| **Export Selection to Audio** | `Ctrl+Shift+E` | Export selected text as audio file |

---

## 📝 Custom Commands

> **Note:** Custom commands appear in the right-click context menu under **"English Learner"**
> 
> You can assign custom hotkeys to individual commands via:
> Settings → Hotkeys → Search for your command name

### Available Custom Commands (Default)
- 口语纠正专家
- Explain Idioms
- Fix Grammar
- Simplify
- Practice Questions
- Summarize
- Translate to Chinese

---

## 🎯 How to Customize Shortcuts

1. Open **Settings** → **Hotkeys**
2. Search for command name (e.g., "Aloud: Play selection")
3. Click the **+** icon to add or modify hotkey
4. Press your desired key combination
5. Click anywhere to save

---

## 💡 Tips

### Modifiers Key Reference
- `Ctrl` = Windows/Linux Control key
- `Cmd` = Mac Command key (⌘)
- `Shift` = Shift key
- `Alt` = Alt/Option key

### TTS Speed Control
- Speed range: 0.5x - 2.5x
- Increment: 0.1x per press
- Default: 1.0x

### Voice Recording
- Press `Ctrl+Shift+R` to start
- Recording modal appears in bottom-left
- Press **Stop** button or close modal to finish
- Transcription appears at cursor position

### Audio Export
- Export creates `.mp3` files in `03-Resources/aloud/`
- Filename format: `prefix-hash.mp3`
- Files are embedded as `![[filename.mp3]]`

---

## ⚡ Power User Shortcuts

### Rapid TTS Workflow
1. Select text
2. `Ctrl+Shift+P` - Start playing
3. `Ctrl+→` / `Ctrl+←` - Navigate sentences
4. `Ctrl+↑` / `Ctrl+↓` - Adjust speed
5. `Escape` - Stop

### Voice Input Workflow
1. `Ctrl+Shift+R` - Start recording
2. Speak your text
3. Click **Stop** in modal
4. Text appears at cursor

### Video Learning Workflow
1. `Ctrl+Shift+Y` - Import video
2. Enter YouTube/Bilibili URL
3. Wait for automatic processing
4. Note is created with transcript

---

## 🔧 Troubleshooting

### Shortcut Not Working?
1. Check for conflicts: Settings → Hotkeys
2. Make sure plugin is enabled
3. Reload Obsidian if needed

### Want Different Shortcuts?
All shortcuts can be customized in:
**Settings → Hotkeys → Search "OB English" or "Aloud"**

---

**Last Updated:** 2025-12-09
**Plugin Version:** 1.12.0
