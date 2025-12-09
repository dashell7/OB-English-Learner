# 🎯 Ribbon Quick Action Button Guide

自定义左侧工具栏快捷按钮功能指南

---

## ✨ 功能概述

Ribbon Quick Action Button 允许你在 Obsidian 左侧工具栏添加一个可自定义的快捷按钮，点击后可以直接执行你最常用的命令。

### 特性
- ✅ 一键执行常用命令
- ✅ 可在设置中自由切换绑定的命令
- ✅ 支持 6 个预定义命令
- ✅ 图标自动匹配命令类型
- ✅ 鼠标悬停显示命令名称

---

## 📋 可用命令列表

| 命令 ID | 命令名称 | 图标 | 说明 |
|---------|---------|------|------|
| `import-youtube-video` | Import YouTube Video | 🎥 | 导入 YouTube/Bilibili 视频 |
| `start-voice-recording` | Start Voice Recording | 🎙️ | 开始语音录音（默认） |
| `tts-play-selection` | TTS: Play Selection | ▶️ | 朗读选中的文本 |
| `tts-play-pause` | TTS: Play/Pause | ⏯️ | 播放/暂停 TTS |
| `tts-export-selection` | TTS: Export to Audio | 🎵 | 导出选中文本为音频 |
| `initialize-knowledge-base` | Initialize Knowledge Base | 🗄️ | 初始化知识库 |

---

## ⚙️ 配置步骤

### 1. 打开设置
```
Settings → OB English Learner → Commands 标签页
```

### 2. 找到 "Quick Action Button" 卡片
在 Commands 标签页中，你会看到一个 **"🎯 Quick Action Button"** 卡片

### 3. 选择要绑定的命令
- 点击下拉菜单
- 从列表中选择你最常用的命令
- 设置会自动保存

### 4. 重新加载 Obsidian
```
Ctrl/Cmd + R  或  Settings → Reload without saving
```

### 5. 查看新按钮
在左侧 Ribbon 工具栏中，你会看到新的快捷按钮，图标会根据你选择的命令自动变化

---

## 🎨 使用示例

### 示例 1：绑定"开始录音"
**适合场景：** 经常需要录音转文字

1. 选择 "Start Voice Recording"
2. 重新加载 Obsidian
3. 点击 🎙️ 按钮
4. 开始录音

### 示例 2：绑定"朗读选中文本"
**适合场景：** 频繁使用 TTS 功能

1. 选择 "TTS: Play Selection"
2. 重新加载 Obsidian
3. 选中文本
4. 点击 ▶️ 按钮
5. 听取朗读

### 示例 3：绑定"导入视频"
**适合场景：** 大量导入 YouTube 视频

1. 选择 "Import YouTube Video"
2. 重新加载 Obsidian
3. 点击 🎥 按钮
4. 粘贴 URL

---

## 💡 使用技巧

### 快速切换命令
1. 根据当前工作流程切换命令
2. 例如：学习时绑定 TTS，录音时绑定录音功能

### 与键盘快捷键配合
- Ribbon 按钮：鼠标操作
- 键盘快捷键：键盘操作
- 两者配合使用效率更高

### 推荐配置
- **语言学习者**: TTS: Play Selection
- **内容创作者**: Import YouTube Video  
- **播客记录者**: Start Voice Recording
- **知识管理者**: Initialize Knowledge Base

---

## ⚡ 常见问题

### Q: 修改命令后没有效果？
**A:** 需要重新加载 Obsidian：
- Windows/Linux: `Ctrl + R`
- Mac: `Cmd + R`
- 或手动：Settings → Reload without saving

### Q: 可以添加更多命令吗？
**A:** 目前支持 6 个预定义命令。如需添加更多，可以：
1. 在 GitHub 提交 Issue
2. 或自行修改代码中的 `getAvailableCommands()` 方法

### Q: 按钮图标可以自定义吗？
**A:** 图标根据命令类型自动匹配，暂不支持手动自定义

### Q: 能添加自定义命令（Custom Commands）吗？
**A:** 当前版本仅支持插件预定义的命令。Custom Commands 需要通过右键菜单访问。

---

## 🔧 技术细节

### 实现原理
1. 用户在设置中选择命令 ID
2. 插件在 `onload()` 时读取配置
3. 调用 `addRibbonIcon()` 添加按钮
4. 按钮点击时执行 `app.commands.executeCommandById()`

### 配置存储
```json
{
  "ribbonCommandId": "start-voice-recording"
}
```

### 代码位置
- 设置定义: `src/types.ts` → `LinguaSyncSettings.ribbonCommandId`
- 命令列表: `main.ts` → `getAvailableCommands()`
- 按钮创建: `main.ts` → `addCustomRibbonButton()`
- UI 配置: `main.ts` → `renderCommands()`

---

## 📝 更新日志

### v1.12.0 (2025-12-09)
- ✨ 新增 Ribbon Quick Action Button 功能
- ✅ 支持 6 个预定义命令
- 🎨 图标自动匹配命令类型
- 📖 完整的配置界面和文档

---

## 💬 反馈与建议

如果你有任何问题或建议，欢迎：
- 📧 提交 GitHub Issue
- 💬 在社区讨论
- ⭐ Star 本项目

---

**享受更高效的 Obsidian 工作流！** 🚀
