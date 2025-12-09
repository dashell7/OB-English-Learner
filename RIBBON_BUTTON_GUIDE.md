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

**Ribbon 按钮现在支持绑定你的自定义命令（Custom Commands）！**

### 默认的自定义命令

| 命令名称 | 图标 | 说明 |
|---------|------|------|
| **口语纠正专家** | ⚡ | AI 纠正口语表达 |
| **Summarize** | ⚡ | 总结文本 |
| **Fix Grammar** | ⚡ | 修正语法错误 |
| **Simplify** | ⚡ | 简化文本 |
| **Practice Questions** | ⚡ | 生成练习题 |
| **Explain Idioms** | ⚡ | 解释习语 |
| **Translate to Chinese** | ⚡ | 翻译成中文 |

> 💡 **所有自定义命令都会显示在下拉列表中！** 你可以选择任何一个命令绑定到 Ribbon 按钮。

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

### 示例 1：绑定"Translate to Chinese"（翻译成中文）
**适合场景：** 频繁翻译英文文本

1. 选择 "Translate to Chinese"
2. 重新加载 Obsidian
3. 选中要翻译的英文
4. 点击 ⚡ 按钮
5. AI 翻译自动插入

### 示例 2：绑定"口语纠正专家"
**适合场景：** 练习英语口语表达

1. 选择 "口语纠正专家"
2. 重新加载 Obsidian
3. 选中你的英文表达
4. 点击 ⚡ 按钮
5. 获取专业纠正建议

### 示例 3：绑定"Summarize"（总结）
**适合场景：** 快速总结长文本

1. 选择 "Summarize"
2. 重新加载 Obsidian
3. 选中长文本
4. 点击 ⚡ 按钮
5. 获取简洁摘要

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
- **语言学习者**: Translate to Chinese（快速翻译）
- **口语练习者**: 口语纠正专家（纠正表达）
- **阅读学习者**: Explain Idioms（解释习语）
- **写作提升者**: Fix Grammar（语法纠正）
- **内容总结者**: Summarize（快速总结）

---

## ⚡ 常见问题

### Q: 修改命令后没有效果？
**A:** 需要重新加载 Obsidian：
- Windows/Linux: `Ctrl + R`
- Mac: `Cmd + R`
- 或手动：Settings → Reload without saving

### Q: 可以添加更多命令吗？
**A:** 可以！所有你的自定义命令（Custom Commands）都会自动显示在下拉列表中。你可以：
1. 在 Settings → Commands 标签页添加新命令
2. 点击 "Generate Default" 生成默认命令
3. 或者在 `03-Resources/copilot-custom-prompts` 文件夹中添加 `.md` 文件

### Q: 按钮图标可以自定义吗？
**A:** 所有自定义命令使用统一的 ⚡ 闪电图标，简洁且易识别

### Q: 如何创建自己的命令？
**A:** 非常简单！
1. 进入 Settings → Commands 标签页
2. 点击 "+ Add Cmd" 按钮
3. 输入命令名称和提示词
4. 保存后会自动出现在 Ribbon 下拉列表中

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
