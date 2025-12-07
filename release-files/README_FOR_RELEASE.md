# 📦 GitHub Release 文件说明

**版本**: v1.12.0  
**准备时间**: 2025-12-07 23:34

---

## 📄 Release 文件清单

此文件夹包含 3 个必需的 GitHub Release 文件：

### 1. main.js
- **大小**: 192.04 KB (196,557 bytes)
- **说明**: 编译后的插件主代码
- **必需**: ✅ 是

### 2. manifest.json
- **大小**: 346 bytes
- **说明**: 插件元数据配置文件
- **版本**: 1.12.0
- **必需**: ✅ 是

### 3. styles.css
- **大小**: 59 bytes
- **说明**: 样式文件（插件样式已嵌入 main.js）
- **必需**: ✅ 是（Obsidian 建议提供）

---

## 📤 上传到 GitHub Release

### 步骤 1: 创建 Release

1. 访问: https://github.com/dashell7/OB-English-Learner/releases/new
2. 选择 tag: `v1.12.0`
3. 填写标题: `v1.12.0 - 优化默认设置和完整工作流`

### 步骤 2: 上传文件

**方法 A: 分别上传（推荐）**

拖拽以下 3 个文件到 "Attach binaries" 区域：
- `main.js`
- `manifest.json`
- `styles.css`

**方法 B: 上传 ZIP**

也可以上传 `ob-english-learner-1.12.0.zip`（包含这 3 个文件）

### 步骤 3: 发布

点击 **"Publish release"** 按钮

---

## ✅ 文件验证

### 验证 main.js

```bash
# 检查文件大小（应该约 192 KB）
ls -lh main.js

# 检查是否是有效的 JS 文件
head -n 5 main.js
```

### 验证 manifest.json

```bash
# 查看内容
cat manifest.json

# 验证 JSON 格式
python -m json.tool manifest.json
```

### 验证 styles.css

```bash
# 查看内容
cat styles.css
```

---

## 📋 Release 检查清单

上传前确认：

- [x] `main.js` 存在且大小正确
- [x] `manifest.json` 存在且版本号为 1.12.0
- [x] `styles.css` 存在（即使为空）
- [x] 所有文件来自最新编译
- [x] Git tag v1.12.0 已推送
- [ ] 文件已上传到 GitHub Release
- [ ] Release 已发布

---

## 🔗 相关链接

- **仓库**: https://github.com/dashell7/OB-English-Learner
- **Releases**: https://github.com/dashell7/OB-English-Learner/releases
- **Tag**: https://github.com/dashell7/OB-English-Learner/releases/tag/v1.12.0

---

## 📝 用户安装方式

### 方式 1: 手动安装

1. 从 Release 下载 3 个文件：`main.js`、`manifest.json`、`styles.css`
2. 放到 `.obsidian/plugins/ob-english-learner/` 目录
3. 重启 Obsidian
4. 在设置中启用插件

### 方式 2: 下载 ZIP

1. 下载 `ob-english-learner-1.12.0.zip`
2. 解压到 `.obsidian/plugins/ob-english-learner/` 目录
3. 重启 Obsidian
4. 在设置中启用插件

### 方式 3: BRAT 安装

1. 安装 BRAT 插件
2. 添加仓库: `dashell7/OB-English-Learner`
3. BRAT 会自动下载这 3 个文件

---

## 🎯 重要说明

### 为什么需要这 3 个文件？

1. **main.js**: 
   - 必需文件
   - 包含所有插件逻辑
   - Obsidian 加载插件时会执行此文件

2. **manifest.json**:
   - 必需文件
   - 告诉 Obsidian 插件的版本、名称、作者等信息
   - Obsidian 用此文件识别插件

3. **styles.css**:
   - 可选但建议提供
   - 本插件的样式已嵌入 main.js
   - 提供空文件以符合 Obsidian 规范

### 文件大小说明

- **main.js (192 KB)**: 较大是因为包含了：
  - TypeScript 编译后的代码
  - 所有依赖库（bundled）
  - CSS 样式（embedded）
  - 这是正常大小，无需担心

- **manifest.json (346 bytes)**: 仅包含元数据，非常小

- **styles.css (59 bytes)**: 仅包含注释，表明样式在 main.js 中

---

## 🔄 更新说明

如果需要更新 Release：

1. 修改代码
2. 更新 `manifest.json` 版本号
3. 重新编译: `npm run build`
4. 重新打包这 3 个文件
5. 创建新的 Git tag
6. 创建新的 GitHub Release

---

## 📞 需要帮助？

如果上传或安装遇到问题：

1. 检查文件完整性（3 个文件都要上传）
2. 检查 manifest.json 版本号是否正确
3. 确认 Git tag 已推送
4. 查看 GitHub Release 文档

---

**准备完成！可以上传到 GitHub Release 了。** 🚀

**文件位置**: `c:\Users\dashell-f\Documents\obsidian learner\.obsidian\plugins\ob-english-learner\release-files\`
