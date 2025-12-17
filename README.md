# OB English Learner

<div align="center">

![Version](https://img.shields.io/badge/version-1.4.0-blue)
![Obsidian](https://img.shields.io/badge/Obsidian-0.15.0+-purple)
![License](https://img.shields.io/badge/license-MIT-green)

**A powerful language learning assistant for Obsidian**

[English](#english) | [中文](#中文)

</div>

---

## English

### 🎯 Overview

OB English Learner is a comprehensive language learning plugin for Obsidian that helps you create bilingual notes from YouTube and Bilibili videos with AI-powered translation, voice recording, and text-to-speech capabilities.

### ✨ Features

#### 📺 Video Transcript Import
- **YouTube & Bilibili Support** - Automatic subtitle fetching using yt-dlp
- **AI Translation** - Translate subtitles with DeepSeek, Gemini, OpenAI, or Azure
- **Smart Formatting** - AI-powered text segmentation and punctuation
- **SRT Generation** - Export subtitles as SRT files
- **Bilingual Notes** - Side-by-side English and Chinese text

#### 🎙️ Voice to Text
- **Real-time Recording** - Floating, draggable recording modal
- **Multi-provider STT** - OpenAI Whisper, Azure, AssemblyAI
- **Format Support** - WAV, WebM, MP3 with FFmpeg conversion
- **Auto-transcription** - Automatic transcription after recording

#### 🔊 Text to Speech (Aloud Clone)
- **Multi-provider TTS** - OpenAI, Azure, ElevenLabs, Custom
- **Floating Player** - Modern playback controls with progress tracking
- **Sentence Navigation** - Play, pause, skip forward/backward by sentence
- **Local Caching** - IndexedDB cache to save API costs
- **Audio Export** - Export text to MP3 files

#### ⚡ Custom AI Commands
- **Command Manager** - Create custom AI commands (Copilot-style)
- **Template Variables** - Use {{selection}}, {{title}}, and more
- **Quick Access** - Ribbon buttons and command palette integration

#### 🗄️ Bases Integration
- **Auto-insertion** - Video notes automatically added to Bases database
- **Field Mapping** - Title, URL, and metadata auto-populated

### 🚀 Quick Start

#### 1. Install yt-dlp (Required for YouTube features)

**Windows:**
```bash
winget install yt-dlp
```

**macOS:**
```bash
brew install yt-dlp
```

**Linux / Universal:**
```bash
pip install yt-dlp
```

Verify installation:
```bash
yt-dlp --version
```

#### 2. Configure API Keys (Optional)

- **AI Translation**: DeepSeek recommended (~¥1/10k words)
- **Voice Features**: OpenAI for STT/TTS
- **Azure/ElevenLabs**: Alternative providers

#### 3. Import Your First Video

1. Click the video icon 📺 in the ribbon
2. Paste a YouTube or Bilibili URL
3. Wait for automatic processing:
   - Subtitle fetching
   - AI translation (if configured)
   - Bilingual note generation
   - SRT file creation

### 📖 Documentation

- [First-time Setup Guide](首次使用必读.md) - Quick start guide (Chinese)
- [Version History](CHANGELOG.md) - Detailed changelog
- [Technical Deep Dive](插件深度检查报告.md) - Architecture overview (Chinese)

### ⚙️ Settings

Navigate through 5 organized tabs:

- **📝 Content & Config** - General settings and video configuration
- **🤖 AI** - Translation and formatting settings
- **🎙️ Audio** - Voice recording and TTS configuration
- **⚡ Commands** - Custom AI command management
- **⚙️ Advanced** - Template and account settings

### 🎨 Features Highlight

#### Smart First-time Setup
- Auto-detects yt-dlp installation
- Step-by-step installation wizard
- "Don't show again" option
- Manual access from settings

#### Modern UI
- Vertical tab layout (English above, Chinese below)
- Underline highlighting (Language Learner style)
- Status badges for API configuration
- Theme-adaptive design

### 🛠️ Development

```bash
# Install dependencies
npm install

# Development build (watch mode)
npm run dev

# Production build
npm run build
```

### 📦 Release Files

Required files for installation:
- `main.js` - Compiled plugin code
- `manifest.json` - Plugin metadata
- `styles.css` - Custom styles

### 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

### 📄 License

MIT License - see LICENSE file for details

### 🙏 Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube subtitle fetching
- [Aloud](https://github.com/adrianlyjak/obsidian-aloud-tts) - TTS inspiration
- Obsidian community for support and feedback

---

## 中文

### 🎯 概述

OB English Learner 是一个功能强大的 Obsidian 语言学习插件，帮助你从 YouTube 和 B站视频创建双语笔记，提供 AI 翻译、语音录制和文本转语音等功能。

### ✨ 核心功能

#### 📺 视频字幕导入
- **YouTube & B站支持** - 使用 yt-dlp 自动获取字幕
- **AI 智能翻译** - DeepSeek、Gemini、OpenAI、Azure 翻译
- **智能格式化** - AI 自动分段和标点
- **SRT 导出** - 生成字幕文件
- **双语笔记** - 中英对照文本

#### 🎙️ 语音转文字
- **实时录音** - 浮动、可拖拽录音窗口
- **多提供商** - OpenAI Whisper、Azure、AssemblyAI
- **格式支持** - WAV、WebM、MP3，FFmpeg 自动转换
- **自动转录** - 录音结束自动转写

#### 🔊 文本转语音（完整复刻 Aloud）
- **多提供商** - OpenAI、Azure、ElevenLabs、自定义
- **浮动播放器** - 现代化播放控制和进度跟踪
- **逐句导航** - 播放、暂停、前进/后退（按句子）
- **本地缓存** - IndexedDB 缓存节省成本
- **音频导出** - 导出文本为 MP3 文件

#### ⚡ 自定义 AI 命令
- **命令管理器** - 创建自定义 AI 命令（Copilot 风格）
- **模板变量** - 支持 {{selection}}、{{title}} 等
- **快速访问** - Ribbon 按钮和命令面板集成

#### 🗄️ Bases 数据库集成
- **自动插入** - 视频笔记自动加入 Bases
- **字段映射** - 标题、链接、元数据自动填充

### 🚀 快速开始

#### 1. 安装 yt-dlp（YouTube 功能必需）

**Windows 用户：**
```bash
winget install yt-dlp
```

**macOS 用户：**
```bash
brew install yt-dlp
```

**Linux / 通用方式：**
```bash
pip install yt-dlp
```

验证安装：
```bash
yt-dlp --version
```

#### 2. 配置 API Keys（可选）

- **AI 翻译**：推荐 DeepSeek（约 ¥1/万字）
- **语音功能**：OpenAI 的 STT/TTS
- **Azure/ElevenLabs**：备选提供商

#### 3. 导入第一个视频

1. 点击 Ribbon 栏的视频图标 📺
2. 粘贴 YouTube 或 B站视频链接
3. 等待自动处理：
   - 获取字幕
   - AI 翻译（如已配置）
   - 生成双语笔记
   - 创建 SRT 文件

### 📖 文档

- [首次使用必读](首次使用必读.md) - 快速上手指南
- [版本历史](CHANGELOG.md) - 详细更新日志
- [深度检查报告](插件深度检查报告.md) - 技术架构说明

### ⚙️ 设置

5 个分类清晰的标签页：

- **📝 Content & Config** - 通用设置和视频配置
- **🤖 AI** - 翻译和格式化设置
- **🎙️ Audio** - 语音录制和 TTS 配置
- **⚡ Commands** - 自定义 AI 命令管理
- **⚙️ Advanced** - 模板和账户设置

### 🎨 功能亮点

#### 智能首次设置
- 自动检测 yt-dlp 安装
- 分步骤安装向导
- "不再提示"选项
- 设置中可手动访问

#### 现代化界面
- 垂直标签布局（英文在上，中文在下）
- 下划线高亮（Language Learner 风格）
- API 配置状态徽章
- 主题自适应设计

### 🛠️ 开发

```bash
# 安装依赖
npm install

# 开发构建（监听模式）
npm run dev

# 生产构建
npm run build
```

### 📦 发布文件

安装所需文件：
- `main.js` - 编译后的插件代码
- `manifest.json` - 插件元数据
- `styles.css` - 自定义样式

### 🤝 贡献

欢迎贡献！请随时提交 issues 和 pull requests。

### 📄 许可证

MIT 许可证 - 详见 LICENSE 文件

### 🙏 致谢

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube 字幕获取
- [Aloud](https://github.com/adrianlyjak/obsidian-aloud-tts) - TTS 灵感来源
- Obsidian 社区的支持和反馈

---

<div align="center">

**Made with ❤️ for language learners**

[Report Bug](https://github.com/yourusername/ob-english-learner/issues) · [Request Feature](https://github.com/yourusername/ob-english-learner/issues)

</div>
