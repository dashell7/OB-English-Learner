# 🚀 GitHub Release 上传指南

## 📦 准备好的文件

**位置**: `release-files/` 文件夹

```
✅ main.js         (192.04 KB)
✅ manifest.json   (346 bytes)
✅ styles.css      (59 bytes)
```

---

## 🌐 快速上传步骤

### Step 1: 打开 Release 页面

点击或复制以下链接：

```
https://github.com/dashell7/OB-English-Learner/releases/new
```

或手动访问：
1. 进入你的仓库
2. 点击 **"Releases"** 标签
3. 点击 **"Draft a new release"**

---

### Step 2: 选择 Tag

在 **"Choose a tag"** 下拉框中：

```
选择: v1.12.0
```

✅ Tag 已推送，应该会自动显示

---

### Step 3: 填写标题

在 **"Release title"** 输入：

```
v1.12.0 - 优化默认设置和完整工作流
```

---

### Step 4: 填写描述

点击 **"Description"** 文本框，复制粘贴以下内容：

```markdown
## 🎉 OB English Learner v1.12.0

优化插件默认设置，提供完整的学习工作流文档。

---

## ✨ 主要更新

### 🔧 默认设置优化
- ✅ 所有 AI 功能默认开启（翻译、格式化、字幕优化）
- ✅ 统一文件夹结构（01-Videos, 02-Subtitles, 03-Vocabulary 等）
- ✅ TTS 使用 tts-1-hd + nova 音色，7天缓存
- ✅ 文件数据库默认启用（便于备份）
- ✅ AI 难度评级默认开启

### 📊 进度显示改进
- ✅ 精确的百分比显示（15%-85% 用于 AI 翻译）
- ✅ 实时计时器显示
- ✅ 批量处理优化（根据 AI 提供商动态调整）
- ✅ 每个批次完成都会更新进度

### 📚 文档完善
- ✅ 新增《完整工作流指南.md》（15,000 字）
- ✅ 新增《快速开始指南.md》（10,000 字）
- ✅ 新增《部署说明.md》（完整配置指南）
- ✅ 更新所有插件文档

### 🐛 Bug 修复
- ✅ 修复进度条显示不合理问题
- ✅ 优化 TTS 高亮显示
- ✅ 改进错误处理

---

## 📦 安装方法

### 方法 1: 手动安装（推荐）

1. 下载下方的 3 个文件：`main.js`、`manifest.json`、`styles.css`
2. 放到 `.obsidian/plugins/ob-english-learner/` 目录
3. 重启 Obsidian
4. 在设置中启用插件

### 方法 2: BRAT 安装

1. 安装 BRAT 插件
2. 添加仓库：`dashell7/OB-English-Learner`
3. 自动安装更新

---

## ⚙️ 首次配置

1. **配置 API Key**（必需）
   - Settings → OB English Learner → AI
   - 粘贴 DeepSeek API Key
   - 推荐：https://platform.deepseek.com/

2. **测试连接**
   - 点击 "Test Connection" 按钮
   - 看到 ✅ 即成功

3. **导入第一个视频**
   - 点击左侧 📺 图标
   - 粘贴 YouTube URL
   - 等待 AI 处理完成

---

## 📊 核心功能

- 🎬 **YouTube 视频导入**：自动获取字幕 + AI 翻译
- 📝 **智能分段**：AI 优化段落结构
- 🔊 **文本朗读**：TTS（支持多提供商）
- 🎙️ **语音识别**：STT（Whisper 质量）
- 📖 **划词翻译**：自动弹出释义
- 📚 **生词管理**：自动保存到生词本
- 🔄 **间隔复习**：Spaced Repetition 集成
- 🤖 **AI 辅助**：Copilot 深度学习

---

## 💰 使用成本

基于 DeepSeek API（推荐）：
- 每个 10 分钟视频：约 ¥0.002
- 月成本（正常使用）：¥1-5

极低成本，适合长期学习！

---

## 📖 文档

- [README.md](https://github.com/dashell7/OB-English-Learner#readme) - 完整使用指南
- [完整工作流指南](https://github.com/dashell7/OB-English-Learner) - 详细学习流程

---

## 🐛 已知问题

无重大问题。如遇到问题，请提交 Issue。

---

## 🙏 致谢

感谢以下插件提供的灵感：
- Aloud TTS
- Language Learner
- Voice2Text
- Media Extended

---

**Happy Learning!** 🚀📚✨
```

---

### Step 5: 上传文件

找到 **"Attach binaries by dropping them here or selecting them."**

#### 方式 A: 拖拽上传（推荐）

1. 打开 `release-files` 文件夹
2. 选中 3 个文件：
   - `main.js`
   - `manifest.json`
   - `styles.css`
3. 拖拽到 GitHub 的附件区域
4. 等待上传完成（看到 3 个文件名）

#### 方式 B: 点击选择

1. 点击 **"selecting them"** 链接
2. 浏览到 `release-files` 文件夹
3. 按住 Ctrl，依次选中 3 个文件
4. 点击 **"打开"**
5. 等待上传完成

---

### Step 6: 发布

1. 确认所有信息无误：
   - ✅ Tag: v1.12.0
   - ✅ Title: v1.12.0 - 优化默认设置和完整工作流
   - ✅ Description: 已填写
   - ✅ Files: 3 个文件已上传

2. 点击绿色的 **"Publish release"** 按钮

3. 完成！🎉

---

## ✅ 发布后验证

### 1. 检查 Release 页面

访问: https://github.com/dashell7/OB-English-Learner/releases

确认：
- ✅ v1.12.0 显示在列表中
- ✅ 3 个文件可以下载
- ✅ 描述显示正确

### 2. 测试下载

1. 点击 `main.js` 下载
2. 检查文件大小（约 192 KB）
3. 用文本编辑器打开，确认是 JS 代码

### 3. 测试安装

1. 下载 3 个文件
2. 放到测试 vault 的插件文件夹
3. 重启 Obsidian
4. 确认插件可以加载和启用

---

## 🔧 如果出错了

### 文件上传失败

- 检查文件大小（main.js 不能超过 100 MB）
- 检查网络连接
- 尝试刷新页面重新上传

### Tag 找不到

- 确认 tag 已推送：`git push origin v1.12.0`
- 刷新页面
- 手动输入 tag 名称

### 描述格式错误

- 确认使用 Markdown 格式
- 检查特殊字符是否正确转义
- 可以先保存为草稿，预览后再发布

---

## 📝 快速检查清单

发布前最后检查：

- [ ] 打开了正确的仓库
- [ ] 选择了 v1.12.0 tag
- [ ] 标题填写正确
- [ ] 描述内容完整
- [ ] 3 个文件都已上传
- [ ] 文件大小正常（main.js ~192KB）
- [ ] 准备好点击 "Publish release"

---

## 🎉 完成后

Release 发布后，用户可以：

1. **手动安装**:
   - 下载 3 个文件
   - 放到插件目录
   - 重启 Obsidian

2. **BRAT 安装**:
   - BRAT 会自动检测新版本
   - 自动下载并更新

3. **社区分享**:
   - 在 Obsidian 论坛分享
   - 在社交媒体宣传

---

**准备就绪！现在就去发布吧！** 🚀✨

**祝发布顺利！** 🎊
