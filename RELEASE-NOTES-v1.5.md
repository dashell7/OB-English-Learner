# OB English Learner v1.5 Release Notes

## 🎉 发布信息

- **版本号**: v1.5
- **发布日期**: 2025-12-17
- **作者**: obsidian学英语
- **仓库**: https://github.com/dashell7/OB-English-Learner

---

## ✨ 新功能与改进

### 1. UI优化
- ✅ **修复select下拉框文字截断问题**
  - 增加行高至1.6，确保descender完整显示
  - 优化padding，字母'g'、'p'、'y'等不再被截断
  - 调整min-width至400px，文本完整可见

### 2. 用户体验提升
- ✅ **yt-dlp检测功能增强**
  - 添加检测成功提示："✅ 检测成功！yt-dlp 已安装 (版本: x.x.x)"
  - 添加检测失败提示："❌ 检测失败：未找到 yt-dlp，请先安装"
  - 提示持续显示5秒，用户体验更友好

### 3. 代码清理
- ✅ **删除40+个开发临时文件**
  - UI设计文档 (8个)
  - Bilibili开发文档 (16个)
  - 版本报告 (3个)
  - 问题修复报告 (6个)
  - 测试工具脚本 (4个)
  - 备份和旧版本 (3个)

### 4. 项目结构优化
- ✅ **简化目录结构**
  - 从 ~90个文件 减少至 49个文件 (减少44%)
  - 保留所有核心功能和必要文档
  - 提升可维护性和可读性

### 5. 元数据更新
- ✅ 更新作者信息为"obsidian学英语"
- ✅ 更新authorUrl为实际GitHub仓库地址

---

## 📦 安装方法

### 方法1：自动安装（推荐）
1. 在Obsidian中打开设置
2. 进入"第三方插件" → "浏览"
3. 搜索"OB English Learner"
4. 点击"安装"

### 方法2：手动安装
1. 从[Releases页面](https://github.com/dashell7/OB-English-Learner/releases)下载 `ob-english-learner-1.5.zip`
2. 解压到 `<你的库>/.obsidian/plugins/` 目录
3. 重启Obsidian
4. 在设置中启用"OB English Learner"插件

---

## 📋 系统要求

- **Obsidian**: >= 0.15.0
- **操作系统**: Windows / macOS / Linux
- **可选依赖**: yt-dlp (用于视频字幕下载)

---

## 📚 核心功能

### 视频学习
- YouTube视频字幕自动下载
- Bilibili视频字幕提取
- SRT字幕文件生成
- 自动下载封面图

### AI辅助
- AI翻译（英文→中文）
- 智能笔记格式化
- 自定义AI命令
- 库内问答系统

### 音频功能
- 语音转文字 (STT)
- 文字转语音 (TTS)
- 支持多种TTS提供商（OpenAI、Azure、ElevenLabs）
- TTS音频缓存

### 模板系统
- 自定义笔记模板
- YAML属性管理
- 文件命名模板

---

## 🔧 配置说明

### 首次使用
1. 配置AI API密钥
2. 选择默认语言
3. 设置文件夹路径
4. （可选）安装yt-dlp

### 推荐配置
- **AI提供商**: DeepSeek / OpenAI / SiliconFlow
- **TTS提供商**: OpenAI / Azure
- **默认语言**: 英语 (English)

---

## 🐛 已知问题

- manifest.json中文字符可能导致PowerShell解析警告（不影响使用）
- 部分中文文档路径在PowerShell中显示为乱码（不影响功能）

---

## 🆕 相比v1.4.x的主要变化

1. **UI修复**: 解决了select下拉框文字截断问题
2. **代码清理**: 删除大量开发临时文件，代码更整洁
3. **用户体验**: 添加yt-dlp检测结果提示
4. **项目信息**: 更新作者和仓库链接

---

## 📄 文件清单

Release包包含以下文件：
- `main.js` (230.78 KB) - 插件主文件
- `manifest.json` (0.36 KB) - 插件清单
- `styles.css` (0.03 KB) - 样式文件
- `README.md` (8.38 KB) - 项目说明
- `CHANGELOG.md` (5.67 KB) - 更新日志

**总大小**: 71.85 KB

---

## 🙏 致谢

感谢所有使用和支持OB English Learner的用户！

---

## 📞 联系方式

- **GitHub**: https://github.com/dashell7/OB-English-Learner
- **Issues**: https://github.com/dashell7/OB-English-Learner/issues

---

## 📝 版权信息

MIT License  
Copyright (c) 2025 obsidian学英语
