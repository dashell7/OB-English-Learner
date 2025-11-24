# Language Learner 格式适配说明

## 🎯 格式规范

根据 Language Learner 插件的官方标准，LinguaSync 现在生成完全兼容的笔记格式。

### 标准格式结构

```markdown
langr: [视频标题]
langr-audio: [YouTube URL]
langr-origin: [频道名] - YouTube

^^^article

[纯英文段落文本，无时间戳，每3行合并为一个段落]

^^^words

^^^notes

---

## 视频信息
...
```

## 📝 关键特性

### 1. **语言标记** (langr)

```markdown
langr: How To Order Coffee In English
```

- **作用**: 让Language Learner识别此页面可供阅读
- **必需**: 是

### 2. **音频链接** (langr-audio)

```markdown
langr-audio: https://youtu.be/jhEtBuuYNj4
```

- **作用**: 提供音频/视频链接，实现边听边读
- **必需**: 否，但强烈推荐

### 3. **来源标记** (langr-origin)

```markdown
langr-origin: Ariannita la Gringa - YouTube
```

- **作用**: 用于自动填充例句中的出处部分
- **格式**: `[频道名] - YouTube`

### 4. **文章区域** (^^^article)

```markdown
^^^article

[文章内容]

^^^words
```

- **作用**: 标记文章正文的开始和结束
- **要求**: 
  - 必须在 `^^^article` 和 `^^^words` 之间
  - 纯英文文本，无时间戳
  - 段落格式，便于阅读

### 5. **生词区域** (^^^words)

```markdown
^^^words

[用户添加的生词]

^^^notes
```

- **作用**: 用户手动添加学习的生词
- **由 Language Learner 自动填充**

### 6. **笔记区域** (^^^notes)

```markdown
^^^notes

[用户的学习笔记]
```

- **作用**: 用户的自由笔记区域
- **由用户手动填写**

## 🔄 文本处理

### 段落生成逻辑

```typescript
// 每3行字幕合并为一个段落
const paragraphs = [];
let currentParagraph = [];

transcript.forEach((line, index) => {
    currentParagraph.push(line.text);
    if ((index + 1) % 3 === 0 || index === transcript.length - 1) {
        paragraphs.push(currentParagraph.join(' '));
        currentParagraph = [];
    }
});

// 段落之间用空行分隔
const content = paragraphs.join('\n\n');
```

### 示例输出

```markdown
^^^article

Hello! I'm Ariannita la Gringa, welcome back to my YouTube channel. Can you guys guess where I am today? Today I'm at Starbucks, as you can see behind me.

You can see the beautiful Starbucks logo that they have. This logo is famous all around the world. You guys might all be wondering, Ariannita, why are you at Starbucks?

Today I'm at Starbucks because I want to teach you guys some vocabulary about coffee. You might be thinking, wait, ordering coffee is really easy. Actually, it can be quite difficult, especially at Starbucks.

^^^words

^^^notes
```

## 📂 文件结构

### 新的文件组织

```
Languages/Videos/
├── How To Order Coffee In English.md          ← 笔记（根目录）
└── How To Order Coffee In English/            ← 资源文件夹
    ├── How To Order Coffee In English.jpg     ← 缩略图
    └── Subtitles/
        ├── How To Order Coffee In English - EN.srt
        ├── How To Order Coffee In English - ZH.srt
        └── How To Order Coffee In English - EN-ZH.srt
```

### 变更原因

- **笔记在根目录**: Language Learner 更容易扫描和索引
- **资源在子文件夹**: 保持整洁，但不影响笔记访问

## 🎯 Language Learner 功能支持

### ✅ 完全支持的功能

1. **沉浸式阅读模式**
   - 点击右上角 📖 图标进入阅读模式
   - 纯英文文本，便于阅读

2. **生词高亮**
   - 自动高亮 New 和 Learning 状态的单词
   - 点击单词即可查词

3. **点击查词**
   - 支持多词典源（有道、剑桥、AI等）
   - 查词结果自动保存到生词本

4. **边听边读**
   - 通过 `langr-audio` 链接播放视频
   - 结合字幕文件实现同步

5. **阅读统计**
   - 自动统计总词数、生词数
   - 计算生词比例

6. **例句来源标注**
   - 通过 `langr-origin` 自动填充
   - 在生词卡片中显示来源

## 🔧 使用方法

### 1. 导入视频

```
运行 LinguaSync: Import YouTube Video
输入 URL
等待处理
```

### 2. 在 Language Learner 中阅读

```
打开生成的笔记
点击右上角 📖 图标
进入沉浸式阅读模式
点击单词查词
```

### 3. 学习生词

```
查词后点击 "New" 添加到生词本
在 ^^^words 区域查看收集的生词
定期复习和更新单词状态
```

## 📊 对比

### 旧格式 (不兼容)

```markdown
# How To Order Coffee In English

## Transcript

| Time | Text |
|------|------|
| 00:00 | Hello! I'm Ariannita... |
| 00:06 | Can you guys guess... |
```

**问题**:
- ❌ 表格格式不适合阅读
- ❌ 时间戳干扰文本识别
- ❌ Language Learner无法解析

### 新格式 (完全兼容)

```markdown
langr: How To Order Coffee In English
langr-audio: https://youtu.be/jhEtBuuYNj4
langr-origin: Ariannita la Gringa - YouTube

^^^article

Hello! I'm Ariannita la Gringa, welcome back to my YouTube channel. Can you guys guess where I am today?

^^^words

^^^notes
```

**优点**:
- ✅ 纯文本，易读
- ✅ 段落格式，自然
- ✅ Language Learner完美支持
- ✅ 保留所有功能

## 🎨 自定义模板

如果您想调整格式，可以在设置中编辑模板：

```
Settings > LinguaSync > Note Template
```

**注意**：修改模板时，请保留以下关键标记：

```markdown
langr: {{title}}
langr-audio: {{url}}
langr-origin: {{channel}} - YouTube

^^^article
{{transcript}}
^^^words
^^^notes
```

## 📚 相关资源

- [Language Learner 插件](https://github.com/guopenghui/obsidian-language-learner)
- [LinguaSync 文档](./README.md)
- [模板使用指南](./TEMPLATE_GUIDE.md)

---

**享受沉浸式英语学习体验！✨**
