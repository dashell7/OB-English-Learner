# OB English Learner

An Obsidian plugin for English learning with automatic video transcript fetching, AI-powered translation, and smart formatting.

## ✨ Features

### 🎥 Video Import
- **One-Click Import**: Click the ribbon icon to quickly paste YouTube or Bilibili video links
- **Automatic Transcript Fetching**: Automatically retrieves video transcripts without manual downloads
- **Bilingual Subtitles**: Generates SRT subtitle files in both original and translated languages

### 🤖 AI-Powered Processing
- **Multi-Provider Support**: Choose from DeepSeek, OpenAI, or Google Gemini for translation
- **Smart Text Formatting**: Automatically adds proper punctuation and paragraph breaks
- **Customizable Prompts**: Fine-tune translation and formatting behavior to your preferences

### 📝 Note Generation
- **Customizable Templates**: Design your own note templates with flexible property system
- **Organized Structure**: Automatically creates folders and manages assets
- **Update Mode**: Modify and regenerate notes without losing manual edits

### 🎨 User Experience
- **Bilingual Interface**: Settings displayed in both Chinese and English
- **Auto-Save with Feedback**: All settings changes are automatically saved with clear notifications
- **Folder Auto-Complete**: Smart folder path suggestions for easy navigation
- **Connection Testing**: Verify AI API connections with detailed error messages

## 📦 Installation

### From GitHub Releases (Recommended)
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/yourusername/ob-english-learner/releases)
2. Create folder `VaultFolder/.obsidian/plugins/ob-english-learner/`
3. Copy the downloaded files into the folder
4. Reload Obsidian and enable the plugin in Settings → Community Plugins

### Manual Build
```bash
# Clone the repository
git clone https://github.com/yourusername/ob-english-learner.git
cd ob-english-learner

# Install dependencies
npm install

# Build the plugin
npm run build

# For development with auto-rebuild
npm run dev
```

## 🚀 Quick Start

### 1. Configure AI Provider
1. Open Settings → OB English Learner → AI Settings
2. Select your preferred AI provider (DeepSeek, OpenAI, or Gemini)
3. Enter your API key
4. Test the connection to verify setup

### 2. Set Storage Locations
1. Go to Video Settings
2. Configure folders for video notes and assets
3. Use the folder suggester for easy path selection

### 3. Import Your First Video
1. Click the video icon in the left ribbon
2. Paste a YouTube or Bilibili video URL
3. Wait for processing (transcript fetching → translation → note generation)
4. Find your bilingual note in the configured folder

## ⚙️ Configuration

### AI Providers

| Provider | Models Supported | Notes |
|----------|-----------------|-------|
| **DeepSeek** | deepseek-chat, deepseek-reasoner | Fast and cost-effective |
| **OpenAI** | GPT-4, GPT-3.5 | High quality translations |
| **Google Gemini** | gemini-2.0-flash-exp, gemini-1.5-pro, etc. | Multiple model options |

### Template System
Customize your note output with properties:
- **Source Properties**: Access video metadata (title, author, duration, etc.)
- **Custom Properties**: Add your own frontmatter fields
- **Markdown Template**: Full control over note structure

### Smart Formatting
The AI formatting feature adds:
- Proper punctuation (periods, commas, question marks)
- Natural paragraph breaks (2-4 sentences per paragraph)
- Correct capitalization
- No content modification (preserves original meaning)

## 📋 Requirements

- Obsidian v0.15.0 or higher
- Node.js v16+ (for development)
- Valid API key for at least one AI provider

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start development mode (auto-rebuild on changes)
npm run dev

# Build for production
npm run build

# Type checking
npm run build  # includes tsc -noEmit
```

## 📝 Changelog

### v1.0.0 (Initial Release)
- ✅ YouTube and Bilibili video import
- ✅ Multi-provider AI translation (DeepSeek, OpenAI, Gemini)
- ✅ Smart text formatting with punctuation and paragraphing
- ✅ Bilingual SRT subtitle generation
- ✅ Customizable note templates with property system
- ✅ Auto-save with notifications
- ✅ Folder path auto-completion
- ✅ AI connection testing with detailed feedback

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📄 License

[MIT License](LICENSE)

## 🙏 Acknowledgments

- Built with [Obsidian Plugin API](https://github.com/obsidianmd/obsidian-api)
- Inspired by language learning workflows in Obsidian community

## 💬 Support

If you encounter any issues or have suggestions:
- Open an [issue on GitHub](https://github.com/yourusername/ob-english-learner/issues)
- Check existing issues for solutions

---

Made with ❤️ for language learners
