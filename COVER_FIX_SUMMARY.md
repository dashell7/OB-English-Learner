# Cover 问题修复总结

## 🐛 问题描述

用户生成的笔记中，cover 属性显示为：
```yaml
cover: [["VideoName.jpg"]]
```

**应该显示为**：
```yaml
cover: [[How To Order Coffee In English.jpg]]
```

## 🔍 问题分析

### 问题 1：占位符未替换
- 显示：`"VideoName.jpg"`
- 应该：`"How To Order Coffee In English.jpg"`
- **原因**：可能使用了旧版本的模板，其中包含硬编码的占位符

### 问题 2：格式包含引号
- 显示：`[["xxx"]]`
- 应该：`[[xxx]]`
- **原因**：模板中 cover 属性有引号：`cover: "{{cover}}"`

## ✅ 解决方案

### 步骤 1：检查并更新模板

1. **打开设置**
   ```
   Settings → LinguaSync → Note Template
   ```

2. **查找 cover 行**
   可能看到类似这样的内容：
   ```yaml
   cover: "[[VideoName.jpg]]"
   ```
   或
   ```yaml
   cover: "{{cover}}"
   ```

3. **修改为正确格式**
   ```yaml
   cover: {{cover}}
   ```

### 步骤 2：完整的正确模板

```yaml
---
title: "{{title}}"
langr: {{title}}
date: {{date}}
cefr: B2
cover: {{cover}}
channel: "{{channel}}"
url: {{url}}
duration: {{duration}}
type: video-note
status: inbox
tags:
  - english/video
---

langr-audio: {{url}}
langr-origin: {{channel}} - YouTube

^^^article

{{transcript}}

^^^words

^^^notes
```

### 步骤 3：重置为默认模板（推荐）

如果您不确定如何修改，最简单的方法是重置：

1. 进入 Settings → LinguaSync → Note Template
2. 删除文本框中的所有内容
3. 点击保存
4. 重启 Obsidian
5. 插件会自动使用新的默认模板

或者手动复制上面的"正确模板"粘贴到设置中。

### 步骤 4：重新导入视频

1. 删除有问题的旧笔记
2. 重新导入视频
3. 检查生成的笔记

## 🎯 预期结果

**正确的 Frontmatter**：
```yaml
---
title: "How To Order Coffee In English"
langr: How To Order Coffee In English
date: 2025-11-24
cefr: B2
cover: [[How To Order Coffee In English.jpg]]
channel: "English Academy"
url: https://youtu.be/xxx
duration: 15m 30s
type: video-note
status: inbox
tags:
  - english/video
---
```

**文件结构**：
```
Languages/Videos/
├── How To Order Coffee In English.md
└── How To Order Coffee In English/
    ├── How To Order Coffee In English.jpg  ← 封面图片
    └── Subtitles/
        ├── How To Order Coffee In English - EN.srt
        └── How To Order Coffee In English - ZH.srt
```

## 🔧 技术说明

### Cover 路径生成逻辑

```typescript
// 1. 生成文件名（清理标题）
const fileName = this.sanitizeFileName(metadata.title);
// 例如："How To Order Coffee In English"

// 2. 下载缩略图
const imageFileName = `${fileName}.jpg`;
// 例如："How To Order Coffee In English.jpg"

// 3. 构建 wikilink
const coverLink = `[[${imageFileName}]]`;
// 例如："[[How To Order Coffee In English.jpg]]"

// 4. 替换模板变量
template.replace(/{{cover}}/g, coverLink);
// 结果：cover: [[How To Order Coffee In English.jpg]]
```

### 常见错误模板

**❌ 错误 1：硬编码占位符**
```yaml
cover: "[[VideoName.jpg]]"  # 不会被替换！
```

**❌ 错误 2：变量有引号**
```yaml
cover: "{{cover}}"  # 会生成 "[[xxx]]"
```

**❌ 错误 3：路径不对**
```yaml
cover: "[[Videos/{{title}}.jpg]]"  # 路径错误
```

**✅ 正确格式**
```yaml
cover: {{cover}}  # 自动生成正确的路径
```

## 🛠️ 快速诊断

### 检查当前模板

1. 打开 Settings → LinguaSync → Note Template
2. 搜索 `cover`
3. 确认格式为 `cover: {{cover}}`（无引号）

### 检查生成的文件

1. 打开文件管理器
2. 导航到 `Languages/Videos/`
3. 查看是否有视频标题命名的文件夹
4. 文件夹内是否有对应的 `.jpg` 文件

### 如果文件存在但笔记中显示错误

可能是模板中使用了硬编码的占位符，而不是变量。

**解决方法**：
- 使用 `{{cover}}` 变量，而不是硬编码 `[[VideoName.jpg]]`

## 📋 检查清单

在重新导入前，确认：

- [ ] 模板中 cover 格式为 `cover: {{cover}}`（无引号）
- [ ] 没有硬编码的 "VideoName" 字符串
- [ ] 启用了 "Auto Download Thumbnails"
- [ ] 已删除旧的有问题的笔记
- [ ] 重启了 Obsidian

## 🎓 理解变量系统

### 模板变量 vs 硬编码

**模板变量**（正确）：
```yaml
cover: {{cover}}
```
- `{{cover}}` 会被实际的文件链接替换
- 结果：`cover: [[How To Order Coffee In English.jpg]]`

**硬编码**（错误）：
```yaml
cover: "[[VideoName.jpg]]"
```
- 不会被替换，保持原样
- 结果：`cover: "[[VideoName.jpg]]"` ← 错误！

### 所有可用变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `{{title}}` | 视频标题 | How To Order Coffee |
| `{{cover}}` | 封面链接 | [[How To Order Coffee.jpg]] |
| `{{channel}}` | 频道名称 | English Academy |
| `{{url}}` | 视频 URL | https://youtu.be/xxx |
| `{{date}}` | 当前日期 | 2025-11-24 |
| `{{duration}}` | 视频时长 | 15m 30s |

## 💡 建议

1. **使用默认模板**
   - 新版本的默认模板已经修复了所有问题
   - 如果不需要特殊定制，建议使用默认模板

2. **自定义时注意**
   - 使用变量而不是硬编码
   - cover 不加引号
   - 测试后再批量导入

3. **保存模板备份**
   - 在自定义前复制一份
   - 出问题时可以快速恢复

---

**关键要点**：
- ✅ 使用 `cover: {{cover}}` 不要加引号
- ✅ 不要硬编码 "VideoName"
- ✅ 使用模板变量系统
- ✅ 重新导入视频测试

如果按照以上步骤操作后问题仍然存在，请提供：
1. 当前的模板内容（Settings → Note Template）
2. 控制台日志（按 Ctrl+Shift+I）
3. 生成的笔记文件内容
