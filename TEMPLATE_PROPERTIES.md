# 笔记模板默认属性说明

## 📋 Frontmatter 属性顺序

根据语言学习需求，默认模板的 Frontmatter 属性按以下顺序排列：

```yaml
---
title: "{{title}}"           # 1. 视频标题
langr: {{title}}             # 2. 语言学习资源标题
date: {{date}}               # 3. 创建日期
cefr: B2                     # 4. CEFR 难度等级
cover: "{{cover}}"           # 5. 封面图片
channel: "{{channel}}"       # 6. 频道/UP主
url: {{url}}                 # 7. 视频链接
duration: {{duration}}       # 8. 时长
type: video-note             # 9. 笔记类型
status: inbox                # 10. 状态
tags:                        # 11. 标签
  - english/video
---
```

## 🎯 核心属性说明

### 1. title - 标题
- **值**: 视频的完整标题
- **用途**: 笔记的主标题，Obsidian 文件名的基础
- **示例**: `"The surprising habits of original thinkers"`

### 2. langr - 语言学习资源
- **值**: 默认使用视频标题
- **用途**: 标记为语言学习材料，可在 Langr 工作流中使用
- **可修改**: 可以设置为更简短的学习标题

### 3. date - 创建日期
- **值**: 自动生成为当前日期
- **格式**: `YYYY-MM-DD`（如 `2025-11-24`）
- **用途**: 追踪学习进度，按时间排序
- **示例**: `2025-11-24`

### 4. cefr - CEFR 等级
- **默认值**: `B2` (中高级)
- **可选值**: `A1`, `A2`, `B1`, `B2`, `C1`, `C2`
- **用途**: 标记内容难度，便于分级学习
- **建议**: 导入后根据实际内容手动调整

#### CEFR 等级参考
| 等级 | 名称 | 描述 |
|------|------|------|
| **A1** | Beginner | 初学者 - 基础日常用语 |
| **A2** | Elementary | 初级 - 简单交流 |
| **B1** | Intermediate | 中级 - 熟悉话题的交流 |
| **B2** | Upper Intermediate | 中高级 - 流利且自然的交流 ⭐ (默认) |
| **C1** | Advanced | 高级 - 复杂主题的详细表达 |
| **C2** | Proficient | 精通 - 接近母语水平 |

### 5. cover - 封面图片
- **值**: Obsidian 内部链接格式
- **格式**: `"[[Assets/cover-videoId.jpg]]"`
- **用途**: 视觉化笔记，快速识别内容
- **自动生成**: 插件自动下载并链接

### 6. channel - 频道/UP主
- **值**: YouTube 频道名 或 Bilibili UP主名
- **用途**: 按创作者组织内容，追踪喜欢的频道
- **示例**: 
  - YouTube: `"TED"`
  - Bilibili: `"李永乐老师官方"`

### 7. url - 视频链接
- **值**: 完整的视频 URL
- **格式**: 
  - YouTube: `https://www.youtube.com/watch?v=xxxxx`
  - Bilibili: `https://www.bilibili.com/video/BVxxxx`
- **用途**: 
  - 快速访问原视频
  - 用于 `langr-audio` 音频播放
  - 存档备份

### 8-11. 其他属性
- **duration**: 视频时长（如 `15m 30s`）
- **type**: 固定为 `video-note`，用于筛选视频笔记
- **status**: 默认 `inbox`，可改为 `processing`, `completed` 等
- **tags**: 默认标签 `english/video`，可自定义添加

## 🔧 使用建议

### 导入后的手动调整

1. **CEFR 等级** 👈 最重要
   ```yaml
   # 听完视频后评估难度
   cefr: B1  # 如果觉得简单，降为 B1
   cefr: C1  # 如果觉得复杂，升为 C1
   ```

2. **Langr 标题**
   ```yaml
   # 原标题太长时，可简化
   title: "How I Learned English in 6 Months - Full Method Explained"
   langr: "English Learning Method"  # 简化为更短的学习标题
   ```

3. **状态管理**
   ```yaml
   status: inbox        # 刚导入
   status: processing   # 正在学习
   status: reviewed     # 已复习
   status: completed    # 已完成
   ```

4. **标签扩展**
   ```yaml
   tags:
     - english/video
     - ted-talk          # 添加内容类型
     - psychology        # 添加主题
     - vocabulary/B2     # 添加词汇等级
   ```

## 🎨 在属性管理器中编辑

设置页面提供了可视化的属性管理器：

```
┌─────────────────────────────────────────┐
│ title      {{title}}              ☑ 🗑  │
│ langr      xxx                    ☑ 🗑  │
│ date       {{date}}               ☑ 🗑  │
│ cefr       B2                     ☑ 🗑  │
│ cover      {{cover}}              ☑ 🗑  │
│ channel    {{channel}}            ☑ 🗑  │
│ url        {{url}}                ☑ 🗑  │
│                                          │
│              [+ Add Property]            │
└─────────────────────────────────────────┘
```

- ☑ - 切换显示/隐藏（注释）
- 🗑 - 删除属性
- 可拖拽排序（如支持）

## 📊 Dataview 查询示例

利用这些属性，可以创建强大的 Dataview 查询：

### 按难度分组
```dataview
TABLE cefr, channel, date
FROM "Languages/Videos"
WHERE type = "video-note"
SORT cefr ASC, date DESC
```

### 按频道统计
```dataview
TABLE rows.file.link as "Videos"
FROM "Languages/Videos"
WHERE type = "video-note"
GROUP BY channel
```

### 本月学习进度
```dataview
LIST
FROM "Languages/Videos"
WHERE type = "video-note" 
  AND date >= date(today) - dur(30 days)
SORT date DESC
```

### B2 级别未完成
```dataview
TASK
FROM "Languages/Videos"
WHERE cefr = "B2" AND status != "completed"
```

## 🔗 相关工作流

### Langr 音频播放
```yaml
langr-audio: {{url}}
langr-origin: {{channel}} - YouTube
```
这两个属性支持 Langr 插件的音频播放功能。

### 分级学习路径
1. 先学习 A2/B1 内容打基础
2. 主攻 B2 内容提升水平
3. 挑战 C1/C2 内容拓展能力

### 复习计划
按 `date` 和 `cefr` 组织复习：
- 每周复习本周的 B2 内容
- 每月复习上月的 C1 内容

## 💡 最佳实践

1. **导入后立即调整 CEFR**
   - 看完视频第一时间评估难度
   - 可以在学习过程中调整

2. **使用状态追踪进度**
   - `inbox` → `processing` → `reviewed` → `completed`

3. **添加主题标签**
   - 便于按主题检索和复习

4. **定期回顾 cover**
   - 封面图片能快速唤起记忆

5. **利用 URL 重听**
   - 定期回到原视频复习

---

**提示**: 所有属性都可以在设置中通过可视化管理器调整！
