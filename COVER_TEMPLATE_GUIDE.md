# Cover 模板设置指南

## 🎯 正确的 Cover 设置格式

### 在模板中设置

**✅ 正确格式**（无引号）：
```yaml
---
title: "{{title}}"
cover: {{cover}}
channel: "{{channel}}"
---
```

**❌ 错误格式**（带引号）：
```yaml
---
title: "{{title}}"
cover: "{{cover}}"  # ← 不要加引号！
channel: "{{channel}}"
---
```

## 📝 为什么不能加引号？

在 Obsidian 的 Frontmatter 中，`cover` 是**特殊属性类型**：

- **Text 类型**（需要引号）：
  ```yaml
  title: "Video Title"
  channel: "Channel Name"
  ```

- **Cover 类型**（不需要引号）：
  ```yaml
  cover: [[image.jpg]]
  ```

当模板中写 `cover: "{{cover}}"` 时：
1. `{{cover}}` 被替换为 `[[image.jpg]]`
2. 结果变成 `cover: "[[image.jpg]]"` ← 被识别为 Text 类型
3. Obsidian 提示类型错误 ⚠️

当模板中写 `cover: {{cover}}` 时：
1. `{{cover}}` 被替换为 `[[image.jpg]]`
2. 结果变成 `cover: [[image.jpg]]` ← 正确的 Cover 类型 ✅
3. Obsidian 显示封面预览 🖼️

## ⚙️ 在设置中配置

### 方法 1：使用默认模板

插件的默认模板已经配置好了：
```yaml
cover: {{cover}}  # ← 无引号
```

直接使用即可！

### 方法 2：自定义模板

如果您要自定义模板：

1. **打开设置**
   ```
   Settings → LinguaSync → Note Template
   ```

2. **编辑模板**
   找到 Frontmatter 部分，确保：
   ```yaml
   cover: {{cover}}
   ```
   **不要写成**：
   ```yaml
   cover: "{{cover}}"
   ```

3. **保存设置**

## 🔍 检查现有模板

如果您之前已经自定义了模板，请检查：

1. **打开设置** → LinguaSync → Note Template
2. **查找** `cover:` 行
3. **确认格式**：
   - ✅ `cover: {{cover}}`
   - ❌ `cover: "{{cover}}"`
4. **如有引号，删除**

## 📊 对比示例

### 模板配置

| 配置 | 格式 | 结果 | 状态 |
|------|------|------|------|
| `cover: {{cover}}` | `cover: [[image.jpg]]` | ✅ 正确 | 显示封面 |
| `cover: "{{cover}}"` | `cover: "[[image.jpg]]"` | ❌ 错误 | 类型警告 |

### 生成的笔记

**正确配置**：
```yaml
---
title: "How To Order Coffee"
cover: [[How To Order Coffee In English.jpg]]
channel: "English Academy"
---
```

**错误配置**：
```yaml
---
title: "How To Order Coffee"
cover: "[[How To Order Coffee In English.jpg]]"  # ← 会提示错误
channel: "English Academy"
---
```

## 🛠️ 其他属性规则

### 需要引号的属性（Text 类型）

```yaml
title: "{{title}}"        # ← 需要引号
channel: "{{channel}}"    # ← 需要引号
langr: {{title}}          # ← 可选（简单文本）
```

### 不需要引号的属性

```yaml
cover: {{cover}}          # ← Cover 类型
date: {{date}}            # ← Date 类型
cefr: B2                  # ← 单个值
url: {{url}}              # ← URL 类型
duration: {{duration}}    # ← 数字/时间
```

### 列表类型

```yaml
tags:
  - english/video         # ← 不需要引号
  - tutorial
```

## 💡 快速修复

### 如果您的 Cover 显示错误

**步骤 1：检查模板**
```
Settings → LinguaSync → Note Template
```

**步骤 2：找到 cover 行**
```yaml
cover: "{{cover}}"  # ← 如果是这样
```

**步骤 3：移除引号**
```yaml
cover: {{cover}}    # ← 改成这样
```

**步骤 4：重新导入**
- 删除旧笔记
- 重新导入视频
- 检查效果

### 如果不想重新导入

手动修改现有笔记：

1. 打开笔记
2. 编辑 Frontmatter：
   ```yaml
   # 修改前
   cover: "[[image.jpg]]"
   
   # 修改后
   cover: [[image.jpg]]
   ```
3. 保存

## 📚 相关说明

### 变量替换机制

插件在生成笔记时：
```typescript
// 1. 读取模板
template = `cover: {{cover}}`

// 2. 生成封面链接
coverLink = `[[VideoName.jpg]]`

// 3. 替换变量
result = template.replace('{{cover}}', coverLink)

// 4. 最终结果
result = `cover: [[VideoName.jpg]]`  // ✅ 无引号
```

如果模板是 `cover: "{{cover}}"`：
```typescript
// 替换后
result = `cover: "[[VideoName.jpg]]"`  // ❌ 有引号
```

## 🎓 最佳实践

### 推荐的 Frontmatter 结构

```yaml
---
# 文本属性 - 加引号
title: "{{title}}"
channel: "{{channel}}"

# 简单属性 - 不加引号
langr: {{title}}
date: {{date}}
cefr: B2

# 特殊类型 - 不加引号
cover: {{cover}}
url: {{url}}
duration: {{duration}}

# 固定值
type: video-note
status: inbox

# 列表
tags:
  - english/video
---
```

## ⚠️ 常见错误

### 错误 1：所有变量都加引号
```yaml
# ❌ 不要这样
title: "{{title}}"
cover: "{{cover}}"    # ← 错误
url: "{{url}}"        # ← 不必要
date: "{{date}}"      # ← 不必要
```

### 错误 2：所有变量都不加引号
```yaml
# ❌ 也不要这样
title: {{title}}      # ← 如果标题包含特殊字符会出错
cover: {{cover}}      # ← 正确
channel: {{channel}}  # ← 如果频道名有特殊字符会出错
```

### 正确方式
```yaml
# ✅ 正确的方式
title: "{{title}}"    # ← 文本加引号
cover: {{cover}}      # ← Cover 不加引号
channel: "{{channel}}"# ← 文本加引号
url: {{url}}          # ← URL 不加引号
```

## 🔗 相关文档

- [Cover 属性修复文档](./COVER_PROPERTY_FIX.md)
- [Obsidian Properties 文档](https://help.obsidian.md/Editing+and+formatting/Properties)
- [插件使用指南](./README.md)

---

**关键要点**：
- ✅ 模板中写 `cover: {{cover}}`（无引号）
- ✅ 生成结果 `cover: [[image.jpg]]`（无引号）
- ✅ Obsidian 正确识别为 Cover 类型
- ✅ 显示封面预览 🖼️

**记住**：Cover 是特殊类型，不要加引号！
