# LinguaSync 模板指南

## 📝 概述

LinguaSync 支持自定义 Markdown 笔记模板，让您可以完全控制生成笔记的格式和布局。

## 🎯 可用变量

在模板中，您可以使用以下变量：

| 变量 | 说明 | 示例 |
|------|------|------|
| `{{title}}` | 视频标题 | "How To Order Coffee In English" |
| `{{videoId}}` | YouTube 视频ID | "jhEtBuuYNj4" |
| `{{url}}` | 视频完整URL | "https://youtu.be/jhEtBuuYNj4" |
| `{{channel}}` | 频道名称 | "Ariannita la Gringa" |
| `{{duration}}` | 视频时长 | "9m 29s" |
| `{{uploadDate}}` | 上传日期 | "2025-11-24" |
| `{{thumbnail}}` | 缩略图URL | "https://img.youtube.com/..." |
| `{{srtLinks}}` | SRT字幕文件链接 | 自动生成的链接列表 |
| `{{transcript}}` | 完整转录内容 | 带时间戳的英文文本 |
| `{{totalWords}}` | 总词数 | "567" |
| `{{totalLines}}` | 总行数 | "84" |

## 📌 默认模板（Language Learner 标准格式）

```markdown
langr: {{title}}
langr-audio: {{url}}
langr-origin: {{channel}} - YouTube

^^^article

{{transcript}}

^^^words

^^^notes

---

## 视频信息

**频道**: {{channel}}  
**时长**: {{duration}}  
**日期**: {{uploadDate}}

## 字幕文件

{{srtLinks}}
```

### Language Learner 格式说明

- `langr: xxx` - 标题，显示该页面可以被插件读取
- `langr-audio: xxx` - 音频/视频链接，可以边听边读
- `langr-origin: xxx` - 文章来源，用于自动填充例句中的出处
- `^^^article` - 标记文章内容区域开始
- `^^^words` - 标记生词区域开始
- `^^^notes` - 标记笔记区域开始

## 🎨 模板示例

### 示例 1: 简洁版

```markdown
# {{title}}

> 📹 Channel: {{channel}} | ⏱️ {{duration}}

![]({{url}})

## 字幕文件

{{srtLinks}}

## 英文原文

{{transcript}}
```

### 示例 2: 学习笔记版

```markdown
# 📺 {{title}}

## 📋 视频信息

- **频道**: {{channel}}
- **时长**: {{duration}}
- **日期**: {{uploadDate}}
- **链接**: [Watch on YouTube]({{url}})

## 📊 学习统计

- 总行数: {{totalLines}}
- 总词数: ~{{totalWords}} 词
- 预计阅读时间: {{totalWords}} ÷ 200 ≈ {{totalWords}} / 200 分钟

## 🎬 视频

![]({{url}})

## 📝 字幕下载

{{srtLinks}}

## 📖 完整转录

{{transcript}}

## ✍️ 学习笔记

_在此处添加您的学习笔记和心得..._

## 🔖 生词本

_记录您学到的新单词..._
```

### 示例 3: Anki 卡片版

```markdown
---
type: video-learning
tags: [english, listening, {{channel}}]
---

# {{title}}

## Video Embed

![]({{url}})

## Subtitles

{{srtLinks}}

## Full Transcript

{{transcript}}

---

## Flashcards

_Add your Anki flashcards here..._

### Card 1
**Front**: 
**Back**: 

### Card 2
**Front**: 
**Back**: 
```

### 示例 4: 极简版（纯文本）

```markdown
{{transcript}}

---
Source: {{url}}
Channel: {{channel}}
Duration: {{duration}}
```

## 🔧 使用方法

### 1. 打开设置

1. 进入 **Settings > LinguaSync**
2. 滚动到 **Note Template** 部分

### 2. 编辑模板

在文本框中编辑您的模板，使用上述变量。

### 3. 重置模板

如果想恢复默认模板，点击 **Reset Template** 按钮。

## 💡 高级技巧

### 1. 条件显示

虽然模板系统不直接支持条件语句，但您可以设计模板让空值不突兀：

```markdown
**频道**: {{channel}}
**日期**: {{uploadDate}}
```

如果 `uploadDate` 为空，只会显示 `**日期**: `

### 2. 自定义样式

使用 Markdown 和 HTML 来自定义样式：

```markdown
<div style="background: #f0f0f0; padding: 10px; border-radius: 5px;">

**📊 统计信息**
- 词数: {{totalWords}}
- 行数: {{totalLines}}

</div>
```

### 3. 集成其他插件

#### 与 Dataview 集成

```markdown
---
video-url: {{url}}
video-channel: {{channel}}
video-duration: {{duration}}
---

# {{title}}

## Transcript

{{transcript}}
```

然后可以使用 Dataview 查询：

````markdown
```dataview
TABLE video-channel, video-duration
FROM #english/video
WHERE video-url != null
```
````

#### 与 Tasks 插件集成

```markdown
# {{title}}

## Transcript

{{transcript}}

## 学习任务

- [ ] 第一遍通读 📅 2025-11-25
- [ ] 精读并标记生词 📅 2025-11-26
- [ ] 跟读练习 📅 2025-11-27
```

## ⚠️ 注意事项

1. **保存设置**: 修改模板后会自动保存
2. **即时生效**: 新模板将应用于下一次导入的视频
3. **已有笔记**: 修改模板不会影响已生成的笔记
4. **变量大小写**: 变量名区分大小写，必须完全匹配

## 🐛 故障排除

### 问题：变量没有被替换

**解决方案**: 
- 检查变量名拼写是否正确
- 确保使用双花括号 `{{}}`
- 变量名区分大小写

### 问题：格式不正确

**解决方案**:
- 使用 **Reset Template** 恢复默认
- 检查 Markdown 语法是否正确
- 预览生成的笔记

### 问题：模板太长导致卡顿

**解决方案**:
- 简化模板
- 避免在模板中包含大量静态内容
- 将静态内容移到笔记中手动添加

## 📚 更多资源

- [Markdown 语法指南](https://www.markdownguide.org/)
- [Obsidian 文档](https://help.obsidian.md/)
- [Language Learner 插件](https://github.com/guopenghui/obsidian-language-learner)

---

**祝您学习愉快！✨**
