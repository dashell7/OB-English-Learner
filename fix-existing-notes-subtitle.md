# 🔧 修复现有笔记的字幕同步问题

## 问题说明

**症状**: Media Extended 播放视频时，字幕与视频内容不同步

**根本原因**: 
- 字幕文件时间戳是正确的 ✅
- 但 Media Extended 插件没有加载字幕文件 ❌
- 显示的是视频标题作为默认字幕

## 解决方案

### 对于新导入的视频

✅ **已修复！** 重启 Obsidian 后，新导入的视频会自动包含字幕路径。

### 对于现有的笔记

需要**手动添加字幕路径**到 frontmatter。

---

## 🛠️ 修复步骤（手动）

### Step 1: 打开笔记

打开需要修复的视频笔记，例如：
```
01-Input Materials/文章学习/before I continue..md
```

### Step 2: 查找字幕文件

在 `03-Resources/subtitles/` 文件夹中找到对应的字幕文件：
```
03-Resources/subtitles/before I continue. - EN-ZH.srt  ← 双语字幕（推荐）
03-Resources/subtitles/before I continue. - EN.srt     ← 英文字幕
03-Resources/subtitles/before I continue. - ZH.srt     ← 中文字幕
```

### Step 3: 修改 Frontmatter

在笔记的 frontmatter（`---` 之间）添加 `subtitle:` 字段：

**修改前**:
```yaml
---
title: before I continue.
date: 2025-12-03
cover: 03-Resources/thumbnails/before I continue..jpg
url: https://www.youtube.com/watch?v=c8snSF5v7YI
langr-audio:
langr-origin: Miss Honey 🍯 - YouTube
langr: xxx
langr-pos: "1"
---
```

**修改后**:
```yaml
---
title: before I continue.
date: 2025-12-03
cover: 03-Resources/thumbnails/before I continue..jpg
url: https://www.youtube.com/watch?v=c8snSF5v7YI
subtitle: "03-Resources/subtitles/before I continue. - EN-ZH.srt"  ← 添加这一行
langr-audio:
langr-origin: Miss Honey 🍯 - YouTube
langr: xxx
langr-pos: "1"
---
```

### Step 4: 保存并重新加载视频

1. 保存笔记（Ctrl + S）
2. 关闭视频播放器
3. 重新播放视频

**预期结果**: 字幕与视频内容完美同步！ ✅

---

## 📋 字幕文件选择建议

| 类型 | 文件名格式 | 说明 | 推荐度 |
|------|-----------|------|--------|
| **双语字幕** | `视频名 - EN-ZH.srt` | 中英双语同时显示 | ⭐⭐⭐⭐⭐ 最推荐 |
| **英文字幕** | `视频名 - EN.srt` | 只显示英文 | ⭐⭐⭐⭐ |
| **中文字幕** | `视频名 - ZH.srt` | 只显示中文 | ⭐⭐⭐ |

**建议**: 优先使用**双语字幕**（EN-ZH.srt），方便学习对照。

---

## 🔍 验证修复成功

### 测试步骤

1. **播放视频**
   - 点击笔记中的 URL 链接或使用 Media Extended 播放

2. **检查字幕显示**
   - 字幕应该在视频下方显示
   - 双语字幕格式：
     ```
     英文字幕内容
     中文翻译内容
     ```

3. **验证同步性**
   - 快进到 01:00
   - 应该显示：`Then he went back again and choked me again...`
   - 而不是：`before I continue.`

### 如果仍然不同步

检查以下几点：

#### ✅ 检查 1: 字幕路径是否正确
```yaml
subtitle: "03-Resources/subtitles/before I continue. - EN-ZH.srt"
         ↑                        ↑
         必须有引号              文件名必须完全匹配（包括空格和符号）
```

#### ✅ 检查 2: 字幕文件是否存在
```
在 Obsidian 文件浏览器中确认文件存在：
03-Resources/subtitles/before I continue. - EN-ZH.srt
```

#### ✅ 检查 3: 文件名是否包含特殊字符
如果文件名包含 `.` 或其他特殊字符，确保使用引号：
```yaml
subtitle: "03-Resources/subtitles/before I continue. - EN-ZH.srt"
                                                   ↑ 注意这个点
```

---

## 🎯 批量修复脚本（高级）

如果你有很多笔记需要修复，可以使用 Templater 插件或自定义脚本批量添加字幕路径。

### 使用 Dataview 查询

```dataview
TABLE file.name, subtitle
FROM "01-Input Materials/文章学习"
WHERE file.frontmatter.url != null AND subtitle = null
```

这会列出所有有视频 URL 但缺少字幕路径的笔记。

---

## 📝 示例：完整的修复后笔记

```markdown
---
title: before I continue.
date: 2025-12-03
cover: 03-Resources/thumbnails/before I continue..jpg
url: https://www.youtube.com/watch?v=c8snSF5v7YI
subtitle: "03-Resources/subtitles/before I continue. - EN-ZH.srt"
langr-audio:
langr-origin: Miss Honey 🍯 - YouTube
langr: xxx
langr-pos: "1"
---

^^^article

This isn't an English learning video.
This is a video I feel like I need to make before I continue uploading on YouTube.

So, you might know I was assaulted by my boyfriend a week ago.
...
```

---

## ⚠️ 常见问题

### Q1: 字幕显示乱码

**原因**: 字幕文件编码问题  
**解决**: 确保 SRT 文件使用 UTF-8 编码

### Q2: 字幕不显示

**原因**: Media Extended 未加载字幕文件  
**检查**:
1. frontmatter 中是否有 `subtitle:` 字段
2. 路径是否正确
3. 文件是否存在

### Q3: 字幕时间提前或延后

**原因**: 字幕时间戳偏移  
**解决**: 这是 SRT 文件本身的问题，不是插件问题

### Q4: 双语字幕只显示一种语言

**原因**: SRT 文件格式问题  
**检查**: 打开 SRT 文件，确认每条字幕都有两行文本

**正确格式**:
```
8
00:01:00,000 --> 00:01:06,336
Then he went back again and choked me again and I went unconscious.
然后他又回来，再次掐住我的脖子，我又失去了意识。
```

---

## 🎉 总结

### 问题本质
- **不是**字幕时间戳错误 ❌
- **不是**中英对齐问题 ❌
- **是** Media Extended 没有加载字幕文件 ✅

### 解决方法
1. **新笔记**: 已自动修复，重启 Obsidian 即可 ✅
2. **旧笔记**: 手动添加 `subtitle:` 到 frontmatter ✅

### 验证成功
- 字幕与视频内容同步 ✅
- 双语字幕正常显示 ✅
- 时间戳准确无误 ✅

---

**修复完成！享受流畅的双语学习体验！** 🎓✨
