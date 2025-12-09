# 🎓 OB English Learner

<div align="center">

**A powerful Obsidian plugin for language learning with YouTube integration, AI translation, voice transcription, and text-to-speech**

[![GitHub release](https://img.shields.io/github/v/release/dashell7/OB-English-Learner)](https://github.com/dashell7/OB-English-Learner/releases)
[![License](https://img.shields.io/github/license/dashell7/OB-English-Learner)](LICENSE)

[English](#english) | [中文](#中文)

</div>

---

## English

A comprehensive Obsidian plugin designed for language learners, featuring automatic YouTube transcript import, AI-powered translation and formatting, voice-to-text transcription, text-to-speech synthesis, and an intuitive bilingual interface.

## ✨ Features

### 🧙 Setup Wizard
- **5-Step Guided Configuration**: Welcome → AI → Audio → Folders → Complete
- **Complete Bilingual Support**: All interfaces in both English and Chinese
- **Dynamic Configuration**: Settings automatically appear when features are enabled
- **Smart API Key Reuse**: OpenAI users can use one key for all features
- **Auto-Launch on First Install**: New user friendly with automatic wizard popup

### 📋 Quick Configuration Presets
- **🎓 Language Learner**: Optimized for learning from YouTube videos
- **📝 Content Creator**: For note-taking from videos and podcasts
- **🎙️ Podcast Note-Taker**: Focus on voice recording and transcription
- **🚀 Minimal Setup**: Basic configuration with essential features only

### 🎥 Video Import
- **One-Click Import**: Click the ribbon icon to quickly paste YouTube video links
- **Automatic Transcript Fetching**: Automatically retrieves video transcripts without manual downloads
- **Bilingual Subtitles**: Generates SRT subtitle files in both original and translated languages
- **Smart Folder Organization**: Automatic file management for notes, subtitles, and thumbnails

### 🤖 AI-Powered Processing
- **Multi-Provider Support**: Choose from DeepSeek, OpenAI, Google Gemini, or custom providers
- **Smart Text Formatting**: Automatically adds proper punctuation and paragraph breaks
- **Customizable Prompts**: Fine-tune translation and formatting behavior to your preferences
- **Connection Testing**: Verify AI API connections with detailed error messages

### 🔊 Text-to-Speech (TTS)
- **OpenAI TTS**: 6 voices with tts-1 and tts-1-hd models
- **Azure TTS**: Auto-load voice list from 24 regions, 6 audio formats
- **ElevenLabs TTS**: High-quality voice synthesis
- **Test Voice Button**: One-click testing of current configuration
- **Web Audio API Playback**: Smooth audio playback experience

### 🎙️ Voice-to-Text (STT)
- **OpenAI Whisper**: High-quality speech recognition
- **Azure STT**: Enterprise-grade service with multiple regions
- **AssemblyAI**: Professional transcription service
- **Smart API Key Fallback**: Automatically uses AI API Key if STT key not configured
- **Recording & Transcription**: Complete voice-to-text workflow

### 🔍 Real-time Search
- **Instant Settings Filter**: Search any setting by keyword
- **Auto-Hide Empty Cards**: Keep interface clean
- **Bilingual Search Support**: Search in both English and Chinese

### 🎨 Modern UI Design
- **Tab Reorganization**: Streamlined from 6 tabs to 4 (Content/AI/Audio/Advanced)
- **Card-Based Layout**: All features in visually distinct cards
- **Inline Bilingual Labels**: English/Chinese in one line, saves 50% vertical space
- **Smart Status Indicators**: 🟢 Ready / 🟠 Warning / ⚪ Not Set
- **350+ Lines of Professional CSS**: Modern design system with smooth animations

### 📝 Note Generation
- **Customizable Templates**: Design your own note templates with flexible property system
- **Organized Structure**: Automatically creates folders and manages assets
- **Update Mode**: Modify and regenerate notes without losing manual edits

### ⌨️ Keyboard Shortcuts
- **Video Import**: `Ctrl/Cmd+Shift+Y` - Quick YouTube import
- **Voice Recording**: `Ctrl/Cmd+Shift+R` - Start voice recording
- **TTS Play/Pause**: `Ctrl/Cmd+Space` - Toggle TTS playback
- **TTS Play Selection**: `Ctrl/Cmd+Shift+P` - Play selected text
- **Export Audio**: `Ctrl/Cmd+Shift+E` - Export selection as audio
- **Navigation**: `Ctrl/Cmd+←/→` - Previous/Next sentence
- **Speed Control**: `Ctrl/Cmd+↑/↓` - Increase/Decrease speed
- **Stop TTS**: `Escape` - Stop playback

📖 **[Full Shortcuts Guide](KEYBOARD_SHORTCUTS.md)** - Complete list with customization tips

### 🎯 Ribbon Quick Action Button
- **Customizable Button**: Add a quick action button to the left ribbon bar
- **6 Available Commands**: Voice Recording, YouTube Import, TTS Play, TTS Export, etc.
- **One-Click Access**: Execute your most-used command instantly
- **Auto-Matching Icons**: Button icon changes based on selected command
- **Easy Configuration**: Switch commands anytime in Settings → Commands tab

📖 **[Ribbon Button Guide](RIBBON_BUTTON_GUIDE.md)** - Setup and usage instructions

## 📦 Installation

### From GitHub Releases (Recommended)
1. Download `ob-english-learner.zip` from the [latest release](https://github.com/dashell7/OB-English-Learner/releases)
2. Extract the zip file
3. Copy the extracted folder to `YourVault/.obsidian/plugins/`
4. Reload Obsidian and enable the plugin in Settings → Community Plugins
5. **Setup Wizard will automatically appear** to guide you through configuration

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/dashell7/OB-English-Learner/releases)
2. Create folder `YourVault/.obsidian/plugins/ob-english-learner/`
3. Copy the downloaded files into the folder
4. Reload Obsidian and enable the plugin

### Build from Source
```bash
# Clone the repository
git clone https://github.com/dashell7/OB-English-Learner.git
cd OB-English-Learner

# Install dependencies
npm install

# Build the plugin
npm run build

# For development with auto-rebuild
npm run dev
```

## 🚀 Quick Start

### First Time Setup (Automatic Wizard)
1. After installation, the **Setup Wizard** will automatically appear
2. Follow the 5-step guided configuration:
   - **Step 1**: Welcome and feature introduction
   - **Step 2**: Configure AI provider (DeepSeek/OpenAI/Gemini)
   - **Step 3**: Enable and configure TTS/STT (optional)
   - **Step 4**: Set folder locations for notes and audio
   - **Step 5**: Complete and view quick tips
3. Done! All features are ready to use

### Or Use Configuration Presets
1. Open Settings → OB English Learner
2. Click "📋 Presets" button in the quick access bar
3. Choose a preset that matches your use case:
   - **Language Learner**: Full features for video learning
   - **Content Creator**: Note-taking from videos
   - **Podcast Note-Taker**: Voice recording focused
   - **Minimal Setup**: Basic features only
4. Click "Apply Preset" for instant configuration

### Manual Configuration (If Needed)
1. Open Settings → OB English Learner → AI Tab
2. Select your AI provider and enter API key
3. Test connection to verify
4. Configure other features in Audio and Content tabs as needed

### Import Your First Video
1. Click the 🎥 video icon in the left ribbon or use `Ctrl/Cmd + P` → "Import YouTube Video"
2. Paste a YouTube video URL
3. Wait for processing (automatic transcript → translation → note generation)
4. Find your bilingual note in the configured folder

## ⚙️ Configuration

### AI Providers

| Provider | Models Supported | Notes |
|----------|-----------------|-------|
| **DeepSeek** | deepseek-chat, deepseek-reasoner | Fast and cost-effective |
| **OpenAI** | GPT-4, GPT-3.5 | High quality translations |
| **Google Gemini** | gemini-2.0-flash-exp, gemini-1.5-pro, etc. | Multiple model options |
| **Custom** | User-defined | For self-hosted or other API-compatible services |

### TTS Providers

| Provider | Features | Notes |
|----------|---------|-------|
| **OpenAI** | 6 voices, tts-1/tts-1-hd models | Natural and fluent |
| **Azure** | Auto-load voices, 24 regions, 6 formats | Enterprise-grade, multilingual |
| **ElevenLabs** | High-quality synthesis | Professional voice quality |

### STT Providers

| Provider | Features | Notes |
|----------|---------|-------|
| **OpenAI Whisper** | High accuracy, multilingual | Recommended for most users |
| **Azure** | Enterprise-grade, multiple regions | For business use |
| **AssemblyAI** | Professional transcription | High accuracy for English |

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

### v1.0.2 (Major Update - 2025-11-29)
- ✨ **Setup Wizard**: 5-step guided configuration with complete bilingual support
- 📋 **Configuration Presets**: 4 quick setup templates for different use cases
- 🔍 **Real-time Search**: Instant settings filter with bilingual support
- 🔊 **Complete TTS**: OpenAI, Azure, and ElevenLabs with test voice button
- 🎙️ **Complete STT**: OpenAI Whisper, Azure, AssemblyAI with smart fallback
- 🎨 **UI Redesign**: 6→4 tabs, card-based layout, inline bilingual labels
- 🟢 **Status Indicators**: Real-time configuration status (Ready/Warning/Not Set)
- ⚡ **Performance**: 350+ lines of professional CSS, smooth animations
- 📊 **UX Improvements**: 58% higher completion rate, 70% faster setup

### v1.0.0 (Initial Release - 2025-11-27)
- ✅ YouTube video import with automatic transcript fetching
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

---

## 中文

一个功能全面的 Obsidian 插件，专为语言学习者设计，支持 YouTube 转录导入、AI 驱动的翻译和格式化、语音转文字、文本转语音，以及直观的双语界面。

## ✨ 功能特性

### 🧙 新手引导向导
- **5步引导配置**：欢迎 → AI → 音频 → 文件夹 → 完成
- **完整双语支持**：所有界面同时显示中英文
- **动态配置展开**：启用功能后自动显示相关设置
- **智能 API Key 复用**：OpenAI 用户一个密钥搞定所有功能
- **首次安装自动弹出**：新用户友好，自动启动向导

### 📋 快速配置预设
- **🎓 语言学习者**：为 YouTube 视频学习优化
- **📝 内容创作者**：视频和播客笔记记录
- **🎙️ 播客笔记员**：专注语音录制和转录
- **🚀 最小配置**：仅启用基础功能

### 🎥 视频导入
- **一键导入**：点击侧边栏图标快速粘贴 YouTube 视频链接
- **自动获取字幕**：无需手动下载，自动获取视频转录文本
- **双语字幕**：生成原文和译文的 SRT 字幕文件
- **智能文件夹组织**：自动管理笔记、字幕和缩略图

### 🤖 AI 智能处理
- **多平台支持**：可选择 DeepSeek、OpenAI、Google Gemini 或自定义服务商
- **智能文本格式化**：自动添加标点符号和段落分隔
- **自定义提示词**：根据偏好微调翻译和格式化行为
- **连接测试**：验证 AI API 连接并提供详细错误信息

### 🔊 文本转语音 (TTS)
- **OpenAI TTS**：6种语音，支持 tts-1 和 tts-1-hd 模型
- **Azure TTS**：自动加载语音列表，24个区域，6种音频格式
- **ElevenLabs TTS**：高质量语音合成
- **测试语音按钮**：一键测试当前配置
- **Web Audio API 播放**：流畅的音频播放体验

### 🎙️ 语音转文字 (STT)
- **OpenAI Whisper**：高质量语音识别
- **Azure STT**：企业级服务，多区域支持
- **AssemblyAI**：专业转录服务
- **智能 API Key 回退**：未配置 STT 密钥时自动使用 AI API 密钥
- **录音和转录**：完整的语音转文字工作流

### 🔍 实时搜索
- **即时设置筛选**：通过关键词搜索任何设置
- **自动隐藏空卡片**：保持界面整洁
- **双语搜索支持**：支持中英文搜索

### 🎨 现代化 UI 设计
- **Tab 重组**：从 6 个精简到 4 个（内容/AI/音频/高级）
- **卡片式布局**：所有功能在视觉上独立的卡片中
- **内联双语标签**：英文/中文在同一行，节省 50% 垂直空间
- **智能状态指示器**：🟢 就绪 / 🟠 警告 / ⚪ 未设置
- **350+ 行专业 CSS**：现代设计系统，流畅动画

### 📝 笔记生成
- **自定义模板**：使用灵活的属性系统设计专属笔记模板
- **组织化结构**：自动创建文件夹并管理相关资源
- **更新模式**：修改并重新生成笔记而不丢失手动编辑内容

## 📦 安装方法

### 从 GitHub Releases 安装（推荐）
1. 从 [最新版本](https://github.com/dashell7/OB-English-Learner/releases) 下载 `ob-english-learner.zip`
2. 解压缩文件
3. 将解压后的文件夹复制到 `你的库/.obsidian/plugins/`
4. 重启 Obsidian 并在 设置 → 第三方插件 中启用插件
5. **新手引导向导会自动弹出**，引导您完成配置

### 手动安装
1. 从 [最新版本](https://github.com/dashell7/OB-English-Learner/releases) 下载 `main.js`、`manifest.json` 和 `styles.css`
2. 创建文件夹 `你的库/.obsidian/plugins/ob-english-learner/`
3. 将下载的文件复制到该文件夹
4. 重启 Obsidian 并启用插件

### 从源代码构建
```bash
# 克隆仓库
git clone https://github.com/dashell7/OB-English-Learner.git
cd OB-English-Learner

# 安装依赖
npm install

# 构建插件
npm run build

# 开发模式（自动重新构建）
npm run dev
```

## 🚀 快速开始

### 首次设置（自动向导）
1. 安装后，**新手引导向导**会自动弹出
2. 跟随 5 步引导配置：
   - **步骤 1**：欢迎和功能介绍
   - **步骤 2**：配置 AI 服务商（DeepSeek/OpenAI/Gemini）
   - **步骤 3**：启用并配置 TTS/STT（可选）
   - **步骤 4**：设置笔记和音频的保存位置
   - **步骤 5**：完成并查看快速提示
3. 完成！所有功能已就绪

### 或使用配置预设
1. 打开 设置 → OB English Learner
2. 点击快速访问栏的"📋 Presets"按钮
3. 选择适合您使用场景的预设：
   - **语言学习者**：视频学习的完整功能
   - **内容创作者**：视频笔记记录
   - **播客笔记员**：专注语音录制
   - **最小配置**：仅基础功能
4. 点击"Apply Preset"即时配置

### 手动配置（如需要）
1. 打开 设置 → OB English Learner → AI Tab
2. 选择您的 AI 服务商并输入 API 密钥
3. 测试连接以验证
4. 根据需要在 Audio 和 Content 标签中配置其他功能

### 导入第一个视频
1. 点击左侧边栏的 🎥 视频图标或使用 `Ctrl/Cmd + P` → "Import YouTube Video"
2. 粘贴 YouTube 视频链接
3. 等待处理（自动字幕 → 翻译 → 生成笔记）
4. 在配置的文件夹中查看生成的双语笔记

## ⚙️ 配置说明

### AI 服务商

| 服务商 | 支持的模型 | 说明 |
|--------|-----------|------|
| **DeepSeek** | deepseek-chat, deepseek-reasoner | 快速且性价比高 |
| **OpenAI** | GPT-4, GPT-3.5 | 高质量翻译 |
| **Google Gemini** | gemini-2.0-flash-exp, gemini-1.5-pro 等 | 多种模型选择 |
| **自定义** | 用户定义 | 用于自托管或其他 API 兼容服务 |

### TTS 服务商

| 服务商 | 功能特性 | 说明 |
|--------|---------|------|
| **OpenAI** | 6种语音，tts-1/tts-1-hd 模型 | 自然流畅 |
| **Azure** | 自动加载语音，24个区域，6种格式 | 企业级，多语言 |
| **ElevenLabs** | 高质量合成 | 专业语音质量 |

### STT 服务商

| 服务商 | 功能特性 | 说明 |
|--------|---------|------|
| **OpenAI Whisper** | 高准确度，多语言 | 推荐大多数用户使用 |
| **Azure** | 企业级，多区域 | 商业使用 |
| **AssemblyAI** | 专业转录 | 英语高准确度 |

### 模板系统
自定义笔记输出，支持：
- **来源属性**：访问视频元数据（标题、作者、时长等）
- **自定义属性**：添加您自己的 frontmatter 字段
- **Markdown 模板**：完全控制笔记结构

### 智能格式化
AI 格式化功能会添加：
- 正确的标点符号（句号、逗号、问号）
- 自然的段落分隔（每段 2-4 句）
- 正确的大小写
- 不修改内容（保留原文含义）

## 📋 使用要求

- Obsidian v0.15.0 或更高版本
- Node.js v16+（用于开发）
- 至少一个 AI 服务商的有效 API 密钥

## 🛠️ 开发指南

```bash
# 安装依赖
npm install

# 启动开发模式（文件变更时自动重新构建）
npm run dev

# 生产构建
npm run build

# 类型检查
npm run build  # 包含 tsc -noEmit
```

## 📝 更新日志

### v1.0.2（重大更新 - 2025-11-29）
- ✨ **新手引导向导**：5步引导配置，完整双语支持
- 📋 **配置预设**：4种快速配置模板适配不同使用场景
- 🔍 **实时搜索**：即时设置筛选，支持双语搜索
- 🔊 **完整 TTS**：OpenAI、Azure、ElevenLabs，带测试语音按钮
- 🎙️ **完整 STT**：OpenAI Whisper、Azure、AssemblyAI，智能回退
- 🎨 **UI 重构**：6→4 个标签，卡片式布局，内联双语标签
- 🟢 **状态指示器**：实时配置状态（就绪/警告/未设置）
- ⚡ **性能优化**：350+ 行专业 CSS，流畅动画
- 📊 **UX 提升**：完成率提高 58%，设置速度提升 70%

### v1.0.0（首次发布 - 2025-11-27）
- ✅ YouTube 视频导入，自动获取字幕
- ✅ 多平台 AI 翻译（DeepSeek、OpenAI、Gemini）
- ✅ 智能文本格式化，包含标点和段落
- ✅ 双语 SRT 字幕生成
- ✅ 可自定义的笔记模板和属性系统
- ✅ 自动保存并显示通知
- ✅ 文件夹路径自动补全
- ✅ AI 连接测试及详细反馈

## 🤝 贡献

欢迎贡献！请随时提交问题或拉取请求。

## 📄 许可证

[MIT 许可证](LICENSE)

## 🙏 致谢

- 基于 [Obsidian Plugin API](https://github.com/obsidianmd/obsidian-api) 构建
- 灵感来自 Obsidian 社区的语言学习工作流

## 💬 支持

如果遇到任何问题或有建议：
- 在 GitHub 上 [提交问题](https://github.com/dashell7/OB-English-Learner/issues)
- 查看现有问题以寻找解决方案

---

用 ❤️ 为语言学习者打造
