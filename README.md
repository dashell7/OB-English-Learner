# OB English Learner

[English](#english) | [中文](#中文)

---

## English

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

---

## 中文

一个为英语学习者设计的 Obsidian 插件，支持自动获取视频字幕、AI 翻译和智能格式化。

## ✨ 功能特性

### 🎥 视频导入
- **一键导入**：点击侧边栏图标快速粘贴 YouTube 视频链接
- **自动获取字幕**：无需手动下载，自动获取视频转录文本
- **双语字幕**：生成原文和译文的 SRT 字幕文件

### 🤖 AI 智能处理
- **多平台支持**：可选择 DeepSeek、OpenAI 或 Google Gemini 进行翻译
- **智能文本格式化**：自动添加标点符号和段落分隔
- **自定义提示词**：根据偏好微调翻译和格式化行为

### 📝 笔记生成
- **自定义模板**：使用灵活的属性系统设计专属笔记模板
- **组织化结构**：自动创建文件夹并管理相关资源
- **更新模式**：修改并重新生成笔记而不丢失手动编辑内容

### 🎨 用户体验
- **双语界面**：设置项同时显示中英文标签
- **自动保存提醒**：所有设置更改自动保存并显示清晰的通知
- **文件夹自动补全**：智能路径建议，方便快速导航
- **连接测试**：验证 AI API 连接并提供详细错误信息

## 📦 安装方法

### 从 GitHub Releases 安装（推荐）
1. 从 [最新版本](https://github.com/yourusername/ob-english-learner/releases) 下载 `main.js`、`manifest.json` 和 `styles.css`
2. 创建文件夹 `你的库/.obsidian/plugins/ob-english-learner/`
3. 将下载的文件复制到该文件夹
4. 重启 Obsidian 并在 设置 → 第三方插件 中启用插件

### 手动构建
```bash
# 克隆仓库
git clone https://github.com/yourusername/ob-english-learner.git
cd ob-english-learner

# 安装依赖
npm install

# 构建插件
npm run build

# 开发模式（自动重新构建）
npm run dev
```

## 🚀 快速开始

### 1. 配置 AI 服务商
1. 打开 设置 → OB English Learner → AI 设置
2. 选择您喜欢的 AI 服务商（DeepSeek、OpenAI 或 Gemini）
3. 输入您的 API 密钥
4. 测试连接以验证配置

### 2. 设置保存位置
1. 前往视频设置
2. 配置视频笔记和资源的保存文件夹
3. 使用文件夹建议器快速选择路径

### 3. 导入第一个视频
1. 点击左侧边栏的视频图标
2. 粘贴 YouTube 或 Bilibili 视频链接
3. 等待处理（获取字幕 → 翻译 → 生成笔记）
4. 在配置的文件夹中查看生成的双语笔记

## ⚙️ 配置说明

### AI 服务商

| 服务商 | 支持的模型 | 说明 |
|--------|-----------|------|
| **DeepSeek** | deepseek-chat, deepseek-reasoner | 快速且性价比高 |
| **OpenAI** | GPT-4, GPT-3.5 | 高质量翻译 |
| **Google Gemini** | gemini-2.0-flash-exp, gemini-1.5-pro 等 | 多种模型选择 |

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

### v1.0.0（首次发布）
- ✅ YouTube 和 Bilibili 视频导入
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
- 在 GitHub 上 [提交问题](https://github.com/yourusername/ob-english-learner/issues)
- 查看现有问题以寻找解决方案

---

用 ❤️ 为语言学习者打造
