# OB English Learner v1.12.0

## 🎉 Features

### 🔊 TTS (Text-to-Speech)
- �?100% 对齐 Aloud 插件�?UI 和功�?
- �?完美的文本高亮（紫色背景 + 紫色文字�?
- �?无缝播放（预加载机制，句子间无停顿）
- �?自动滚动（智能跟随当前播放位置）
- �?5 组按钮布局（Play | Previous/Pause/Next | Eye/Speed | Status | Close�?
- �?动�?Pause/Resume 按钮（图标自动切换）
- �?实时进度条（底部蓝色细线�?
- �?音频可视化器�? 条跳动的竖条�?
- �?本地缓存（IndexedDB，减�?API 调用�?

### ⌨️ 键盘快捷�?
- \Ctrl+Space\: 播放/暂停
- \Ctrl+→\: 下一�?
- \Ctrl+←\: 上一�?
- \Ctrl+↑\: 加�?
- \Ctrl+↓\: 减�?
- \Esc\: 停止

### 🎙�?语音识别
- YouTube 字幕自动获取
- 音频转文�?
- SRT 字幕生成

### 🔧 TTS 提供商支�?
- OpenAI TTS
- Azure TTS（完整的 Region + Voice 自动加载�?
- ElevenLabs

### 📤 导出功能
- 导出为音频文�?
- 粘贴文本为音�?
- Aloud 风格的文件名生成

## 📦 Installation

1. 下载 \ob-english-learner-1.12.0.zip\
2. 解压�?Obsidian vault �?\.obsidian/plugins/ob-english-learner/\ 目录
3. 重启 Obsidian
4. 在设置中启用插件
5. 配置 TTS API Key

## 🎯 Usage

### 基础播放
1. 选中文本
2. �?\Ctrl+Space\ 或点击工具栏�?Play 按钮
3. 享受完美�?TTS 体验�?

### 自动滚动
- 点击工具栏的眼睛图标切换自动滚动
- 默认开启，播放时自动跟随当前句�?

### 速度调整
- 点击工具栏的速度按钮循环速度
- 或使�?\Ctrl+�?↓\ 快捷�?

## 🐛 Bug Fixes

- �?修复高亮不显示问题（CSS 优先级）
- �?修复自动滚动跳到最前面问题（延迟确认机制）
- �?修复 Pause/Resume 图标不切换问�?
- �?修复播放时有停顿问题（预加载机制�?

## 📝 Notes

- 需要配�?TTS API Key（OpenAI/Azure/ElevenLabs�?
- 首次播放需要从 API 获取音频（稍慢）
- 第二次播放使用缓存（很快�?
- 完全对齐 Aloud 插件的体�?

## 🙏 Credits

Inspired by [Aloud TTS](https://github.com/adrianlyjak/obsidian-aloud-tts)

---

**Enjoy your perfect TTS experience!** 🎉�?
