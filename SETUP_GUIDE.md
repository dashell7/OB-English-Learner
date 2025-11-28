# 🧙 OB English Learner - 新手引导

## 🎉 欢迎使用 OB English Learner！

这个强大的插件帮助你从 YouTube 视频中学习语言，并提供语音转文字、AI 翻译等功能。

---

## 🚀 快速开始

### 方式一：自动引导（首次安装）

首次安装插件后，Setup Wizard（设置向导）会自动弹出，引导你完成配置。

### 方式二：手动打开引导

随时可以重新打开设置向导：

1. 按 `Ctrl/Cmd + P` 打开命令面板
2. 搜索 "Setup Wizard"
3. 选择 "🧙 Open Setup Wizard"

---

## 📋 设置向导 5 步流程

### Step 1: 欢迎页面 👋
- 了解插件的核心功能
- 4 大特性介绍

### Step 2: AI 配置 🤖
**配置 AI 服务用于翻译和格式化**

#### 推荐选项：
- **Provider**: DeepSeek（性价比最高）
- **API Key**: 需要从对应平台获取

#### 其他选项：
- OpenAI（质量高，费用较高）
- Gemini（Google 出品）

#### 如何获取 API Key：
1. **DeepSeek**: 访问 https://platform.deepseek.com
2. **OpenAI**: 访问 https://platform.openai.com
3. **Gemini**: 访问 https://aistudio.google.com

### Step 3: 音频配置 🎙️
**启用语音功能**

- **Voice-to-Text（语音转文字）**
  - 录音并自动转为文字
  - 支持多种语言
  
- **Text-to-Speech（文本转语音）**
  - 朗读选中的文本
  - 支持导出音频文件

### Step 4: 文件夹配置 📁
**设置文件保存位置**

- **Video Notes Folder**: 视频笔记保存位置
  - 默认：`Languages/Videos`
  
- **Audio Recordings Folder**: 录音文件保存位置
  - 默认：`recordings`

### Step 5: 完成 ✅
**查看快速使用技巧**

---

## 🎯 快速使用技巧

### 导入 YouTube 视频
```
1. Ctrl/Cmd + P → 搜索 "YouTube"
2. 输入视频 URL
3. 等待处理完成
4. 自动生成笔记
```

### 语音转文字
```
1. 点击侧边栏麦克风图标
2. 开始录音
3. 停止录音
4. 自动转为文字插入笔记
```

### AI 翻译
```
1. 选中需要翻译的文本
2. 右键菜单
3. 选择 "Translate to Chinese"
```

### 文本转语音
```
1. 选中文本
2. 右键菜单
3. 选择 "Speak Selection"
```

---

## 📋 预设配置模板

点击设置面板的 `📋 Presets` 按钮，选择适合的场景：

### 🎓 Language Learner（语言学习者）
- ✅ AI 翻译
- ✅ AI 格式化
- ✅ 语音转文字
- ✅ 文本转语音

### 📝 Content Creator（内容创作者）
- ✅ AI 格式化
- ✅ 语音转文字
- ❌ AI 翻译

### 🎙️ Podcast Note-Taker（播客笔记）
- ✅ AI 格式化
- ✅ 语音转文字
- ✅ 音频保存

### 🚀 Minimal Setup（最小配置）
- ❌ 所有 AI 功能关闭
- 仅基础导入功能

---

## 🔍 搜索功能

在设置页面顶部使用搜索框：

```
🔍 Search settings... / 搜索设置
```

**示例搜索**：
- `api` → 找到所有 API 相关设置
- `folder` → 找到所有文件夹配置
- `voice` → 找到所有语音相关设置

---

## 🎨 设置页面结构

```
📝 Content 内容
  ⚙️ General Settings
  🎥 Video & Assets

🤖 AI 智能
  🤖 AI Features
  ⚙️ Provider Configuration
  🧪 Testing

🎙️ Audio 音频
  🎙️ Voice to Text (STT)
  🔊 Text to Speech (TTS)

⚙️ Advanced 高级
  📝 Note Template
  🔐 Account Management
```

---

## ❓ 常见问题

### Q: API Key 从哪里获取？
A: 
- DeepSeek: https://platform.deepseek.com
- OpenAI: https://platform.openai.com
- Gemini: https://aistudio.google.com

### Q: 语音转文字不工作？
A:
1. 检查是否配置了 STT Provider
2. 检查是否输入了 API Key
3. 查看状态指示器（应为绿色"Ready"）

### Q: 如何修改配置？
A:
1. 进入 Obsidian 设置
2. 找到 OB English Learner
3. 在对应的 Tab 中修改

### Q: 想重新运行引导？
A:
- 按 `Ctrl/Cmd + P`
- 搜索 "Setup Wizard"
- 重新配置

---

## 🆘 需要帮助？

1. **查看设置状态指示器**
   - 🟢 Ready - 配置正确
   - 🟠 Warning - 配置不完整
   - ⚪ Not Set - 未配置

2. **使用测试功能**
   - AI Tab → Test Connection
   - Audio Tab → Test STT Connection

3. **重置为默认**
   - Template Tab → Reset Template

---

## 🎉 开始使用！

现在你已经准备好了：

1. ✅ 完成基本配置
2. ✅ 了解核心功能
3. ✅ 知道如何使用

开始导入你的第一个 YouTube 视频吧！

---

**提示**: 所有配置都可以随时在设置页面修改，不用担心配置错误！
