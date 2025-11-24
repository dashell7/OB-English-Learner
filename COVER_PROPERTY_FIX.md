# Cover 属性类型修复

## ❌ 问题

Obsidian 提示错误：
```
作为 text 显示？
您的 unknown 数据不兼容。它将被调整以适配新格式。
```

## 🔍 原因

在 Obsidian 中，`cover` 是一个**特殊属性类型**，用于显示笔记封面。它必须是**不带引号的 wikilink**：

**错误格式** ❌：
```yaml
cover: "[[image.jpg]]"  # 带引号 = 被识别为 text 类型
```

**正确格式** ✅：
```yaml
cover: [[image.jpg]]    # 无引号 = 被识别为 cover 类型
```

## ✅ 修复

### 修改模板

**修改前**：
```typescript
const DEFAULT_TEMPLATE = `---
title: "{{title}}"
cover: "{{cover}}"      // ← 有引号
channel: "{{channel}}"
---`
```

**修改后**：
```typescript
const DEFAULT_TEMPLATE = `---
title: "{{title}}"
cover: {{cover}}        // ← 无引号
channel: "{{channel}}"
---`
```

## 📊 Obsidian 属性类型

### 需要引号的属性（Text 类型）
```yaml
title: "How To Order Coffee"
channel: "English Academy"
langr: How To Order Coffee
```

### 不需要引号的特殊属性

**Cover（封面）**：
```yaml
cover: [[image.jpg]]
```

**Aliases（别名）**：
```yaml
aliases:
  - Coffee Tutorial
  - Starbucks Guide
```

**Tags（标签）**：
```yaml
tags:
  - english/video
  - tutorial
```

**Date（日期）**：
```yaml
date: 2025-11-24
```

## 🎯 正确的笔记 Frontmatter

```yaml
---
title: "How To Order Coffee In English"
langr: How To Order Coffee In English
date: 2025-11-24
cefr: B2
cover: [[How To Order Coffee In English.jpg]]  # ← 无引号！
channel: "English Academy"
url: https://youtu.be/jhEtBuuYNj4
duration: 15m 30s
type: video-note
status: inbox
tags:
  - english/video
---
```

## 🚀 如何验证

1. **重启 Obsidian** 加载新版本
2. **删除旧笔记**（包含错误格式的）
3. **重新导入视频**
4. **检查 Frontmatter**：
   - Cover 应显示为 `cover: [[image.jpg]]`（无引号）
   - 属性面板应正常显示封面预览
   - 无类型错误提示

## 📝 属性面板中的显示

### 错误格式显示
```
cover: "[[How To Order Coffee In English.jpg]]"
       ⚠️ 作为 text 显示？
```

### 正确格式显示
```
cover: [[How To Order Coffee In English.jpg]]
       🖼️ [封面预览图片]
```

## 🔧 其他需要注意的属性

### URL 属性
也不需要引号（因为不是 text 类型）：
```yaml
url: https://youtu.be/abc123
```

### Duration 属性
可以不带引号（数字或时间格式）：
```yaml
duration: 930        # 秒数
# 或
duration: 15m 30s    # 时间字符串（不带引号）
```

### CEFR 属性
不需要引号（单个值）：
```yaml
cefr: B2
```

## 📚 Obsidian 文档参考

- [Properties](https://help.obsidian.md/Editing+and+formatting/Properties)
- [Cover images](https://help.obsidian.md/Editing+and+formatting/Properties#Cover+images)

关键规则：
> The `cover` property accepts a link to an image in your vault. You can link to an image using a wikilink, e.g. `cover: [[image.png]]`, **without quotes**.

## 🎓 学习要点

1. **Cover 是特殊属性** - 不要当成普通文本
2. **Wikilink 不需要引号** - 直接写 `[[link]]`
3. **文本才需要引号** - 如 `title: "My Title"`

## ✨ 最佳实践

### 推荐的 Frontmatter 结构
```yaml
---
# 文本属性 - 需要引号
title: "视频标题"
channel: "频道名称"
langr: 学习资源名称

# 特殊类型 - 不需要引号
date: 2025-11-24
cefr: B2
cover: [[封面图.jpg]]
url: https://...
duration: 15m 30s

# 复合类型
type: video-note
status: inbox
tags:
  - english/video
---
```

---

**修复日期**: 2024-11-24
**影响**: Cover 属性类型识别
**重要性**: ⭐⭐⭐ 高（影响封面显示）
