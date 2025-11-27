# 更新日志

## [1.0.2] - 2025-11-27

### ✨ 新功能

#### 独立目录支持
- **功能**: 视频笔记、字幕文件、封面图片可分别设置独立保存目录
- **设置项**:
  - `Video Notes Folder` - 视频笔记（.md）保存目录
  - `Subtitles Folder` - 字幕文件（.srt）保存目录
  - `Thumbnails Folder` - 封面图片（.jpg）保存目录
- **优点**:
  - 文件分类更清晰
  - 易于批量管理
  - 目录结构更扁平
  - 配置更灵活

### 🔧 改进

- 简化文件夹结构（从嵌套式改为扁平式）
- 优化文件路径生成逻辑
- 改进链接生成（使用绝对路径）
- 更新设置界面说明文字
- **封面下载降级策略**：自动尝试多个分辨率（maxresdefault → sddefault → hqdefault → mqdefault → default）
- **修复封面格式**：移除 wikilink 括号，使用正确的路径格式
- **详细调试日志**：添加完整的下载过程日志

### 📝 文档更新

- 新增 `FOLDER-STRUCTURE-UPDATE.md` - 文件夹结构更新说明
- 包含迁移指南和配置示例

### 🔄 兼容性

- ✅ 向后兼容旧版本
- ✅ 新导入自动使用新结构
- ✅ 旧文件保持不变

---

## [1.0.1] - 2025-11-27

### 🐛 Bug 修复

#### YAML 解析错误修复
- **问题**: 视频标题包含冒号（如 "WebGL 2: Programs"）导致 YAML 解析失败
- **修复**: 在 `generator.ts` 中添加 `escapeYAMLString()` 方法
- **影响**: 所有包含特殊字符的标题现在都能正确处理

#### Language Learner 插件兼容性修复
- **问题**: `langr-audio` 字段在 frontmatter 内且为空，导致插件报错
- **修复**: 
  - 将 `langr-audio` 移到 frontmatter 外部
  - 确保字段有正确的值（视频 URL）
  - 修正 `langr` 字段为固定值 `xxx`
- **影响**: Language Learner 插件现在可以正常识别和处理文章

### 📝 文档更新

- 新增 `YAML-ERROR-FIX.md` - 详细的错误修复说明
- 新增 `TEMPLATE-REFERENCE.md` - 完整的模板参考文档
- 新增 `BUILD.md` - 构建和开发指南
- 新增 `CHANGELOG.md` - 版本更新日志

### 🔧 技术改进

- 添加 YAML 特殊字符自动转义
- 改进模板变量替换逻辑
- 优化错误处理和日志输出

### 📦 文件变更

**修改的文件**:
- `src/generator.ts` - 添加 `escapeYAMLString()` 方法
- `data.json` - 修正默认模板格式
- `main.js` - 重新编译

**新增的文件**:
- `BUILD.md` - 构建说明
- `CHANGELOG.md` - 更新日志
- `TEMPLATE-REFERENCE.md` - 模板参考
- `YAML-ERROR-FIX.md` - 错误修复说明

---

## [1.0.0] - 2025-11-26

### ✨ 初始版本

#### 核心功能

- ✅ YouTube 视频导入
- ✅ Bilibili 视频导入
- ✅ 自动获取字幕（英文/中文）
- ✅ 生成 SRT 字幕文件
- ✅ 下载视频封面
- ✅ 创建 Markdown 笔记

#### AI 功能

- ✅ AI 翻译（英→中）
- ✅ AI 智能断句和标点
- ✅ AI 文本格式化
- ✅ 支持多个 AI 提供商：
  - DeepSeek
  - OpenAI
  - Google Gemini
  - SiliconFlow
  - VideoCaptioner
  - 自定义 OpenAI 兼容 API

#### 用户界面

- ✅ Mac 风格设置界面
- ✅ 双语标签（中英文）
- ✅ 文件夹路径自动补全
- ✅ 模板编辑器
- ✅ Frontmatter 属性管理
- ✅ AI 连接测试

#### 集成功能

- ✅ Language Learner 插件集成
- ✅ Bases 知识库初始化
- ✅ 自定义模板支持
- ✅ 进度提示

#### 技术特性

- ✅ TypeScript 开发
- ✅ esbuild 快速构建
- ✅ 模块化架构
- ✅ 完善的错误处理
- ✅ 详细的日志输出

---

## 版本说明

### 版本号规则

遵循语义化版本 (Semantic Versioning):
- **主版本号**: 不兼容的 API 修改
- **次版本号**: 向下兼容的功能性新增
- **修订号**: 向下兼容的问题修正

### 发布流程

1. 修改代码
2. 更新 CHANGELOG.md
3. 更新 manifest.json 中的版本号
4. 运行 `npm run build`
5. 创建 release.zip
6. 提交到 Git
7. 创建 GitHub Release

### 兼容性

- **Obsidian**: >= 0.15.0
- **Node.js**: >= 16.x
- **TypeScript**: 4.7.4

### 已知问题

无

### 计划功能

- [ ] 支持更多视频平台
- [ ] 批量导入视频
- [ ] 字幕编辑功能
- [ ] 视频播放器集成
- [ ] 导出功能增强
- [ ] 多语言界面

---

## 贡献者

感谢所有为这个项目做出贡献的人！

## 反馈

如果您发现任何问题或有功能建议，请：
1. 在 GitHub 上创建 Issue
2. 提供详细的错误信息和复现步骤
3. 附上相关的日志输出

## 支持

- 📧 Email: [your-email]
- 💬 Discord: [your-discord]
- 🐛 Issues: [GitHub Issues]
