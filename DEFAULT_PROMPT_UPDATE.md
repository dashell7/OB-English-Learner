# 默认 Prompt 更新 - 强化断句和标点

## 📝 更新内容

已优化默认格式化 Prompt，更明确地指示 AI 在断句处添加标点符号。

## 🆚 更新对比

### 旧版 Prompt
```
1. Adding proper punctuation (periods, commas, question marks, exclamation marks, etc.)
2. Capitalizing the first letter of sentences
3. Breaking into natural paragraphs (aim for 3-5 sentences per paragraph)
4. Fixing obvious spacing issues
5. Keep the original words unchanged
```

### 新版 Prompt ✨
```
1. Identify natural sentence breaks and add appropriate punctuation marks at those breaks (periods, commas, question marks, exclamation marks, etc.)
2. Add punctuation between clauses for better readability
3. Capitalize the first letter of each sentence
4. Break into natural paragraphs (aim for 3-5 sentences per paragraph for better readability)
5. Fix obvious spacing issues
6. Keep the original words unchanged, only add punctuation and formatting
```

## 🎯 改进要点

### 1. 明确断句指示 ⭐
**旧**：Adding proper punctuation  
**新**：Identify natural sentence breaks and add appropriate punctuation marks at those breaks

**说明**：明确告诉 AI 要先识别句子的自然断点，然后在这些断点处添加标点。

### 2. 从句标点 ⭐
**新增**：Add punctuation between clauses for better readability

**说明**：指示 AI 在从句之间也添加标点（逗号、分号等），提升可读性。

### 3. 顺序优化
将"识别断句"和"添加标点"作为第一步，强调这是最重要的任务。

## 📊 效果对比

### 旧 Prompt 可能的输出
```
Hey guys it's Arianita Lagringa and welcome back to my YouTube channel. Can you guys guess where I'm at today today I'm at Starbucks and as you can see behind me you can see the beautiful Starbucks logo that they have.
```
❌ 问题：
- 句子过长
- 缺少中间标点
- "today today" 重复未处理

### 新 Prompt 预期输出
```
Hey guys, it's Arianita Lagringa, and welcome back to my YouTube channel. Can you guys guess where I'm at today? 

Today, I'm at Starbucks, and as you can see behind me, you can see the beautiful Starbucks logo that they have.
```
✅ 改进：
- 识别了"today"作为新句子的开始
- 在从句间添加了逗号
- 句子长度更合理

## 🔍 具体改进示例

### 示例 1: 从句标点

**输入**：
```
because I want to teach you guys some coffee vocabulary and you guys might be wondering wait it's really easy to order coffee
```

**旧 Prompt**：
```
Because I want to teach you guys some coffee vocabulary and you guys might be wondering wait it's really easy to order coffee.
```

**新 Prompt**：
```
Because I want to teach you guys some coffee vocabulary, and you guys might be wondering, "Wait, it's really easy to order coffee!"
```

✅ 改进：
- 添加了从句间的逗号
- 识别了引用语气
- 问号改为感叹号

### 示例 2: 长句断句

**输入**：
```
logo is famous worldwide you all might be wondering arianita why are you at Starbucks well today I'm at Starbucks
```

**旧 Prompt**：
```
Logo is famous worldwide you all might be wondering Arianita why are you at Starbucks well today I'm at Starbucks.
```

**新 Prompt**：
```
Logo is famous worldwide. You all might be wondering, "Arianita, why are you at Starbucks?" Well, today I'm at Starbucks.
```

✅ 改进：
- 识别出三个独立句子
- 正确使用问号
- 添加了对话标点

### 示例 3: 复杂长句

**输入**：
```
coffee actually it can be pretty difficult especially at Starbucks because they have different sizes different coffee and different drinks all together
```

**旧 Prompt**：
```
Coffee actually it can be pretty difficult especially at Starbucks because they have different sizes different coffee and different drinks all together.
```

**新 Prompt**：
```
Coffee, actually, it can be pretty difficult, especially at Starbucks, because they have different sizes, different coffee, and different drinks all together.
```

✅ 改进：
- 在"actually"前后添加逗号（插入语）
- "especially"前添加逗号（副词）
- 列举项之间添加逗号

## 🎨 技术解析

### Prompt Engineering 原则

**1. 任务分解**
```
旧：Adding proper punctuation
新：1) Identify breaks → 2) Add punctuation
```
明确步骤，让 AI 按顺序执行。

**2. 具体化**
```
旧：punctuation
新：punctuation marks at those breaks
```
指定标点的位置。

**3. 上下文提示**
```
新增：between clauses for better readability
```
说明为什么要添加标点（提升可读性）。

### AI 理解机制

新 Prompt 帮助 AI：
1. **识别语义单元** - "natural sentence breaks"
2. **理解标点目的** - "for better readability"
3. **处理复杂结构** - "between clauses"

## 💡 最佳实践

### 对于用户

**1. 使用新的默认设置**
- 重启 Obsidian 后自动使用新 Prompt
- 旧笔记不受影响

**2. 如果已自定义 Prompt**
- 可以参考新版改进您的 Prompt
- 或点击 "Reset to Default" 使用新版

**3. 测试和调整**
```
导入测试视频 → 检查效果 → 根据需要微调
```

### 对于开发者

**Prompt 设计要点**：
- 分步骤说明（1, 2, 3...）
- 动词 + 目标（Identify breaks, Add punctuation）
- 解释原因（for better readability）
- 约束条件（Keep original words unchanged）

## 🔄 迁移指南

### 自动迁移
- 新安装：自动使用新 Prompt
- 现有安装：保留自定义 Prompt

### 手动更新

**方法 1：重置为默认**
1. 进入 Settings → AI Translation
2. 找到 "Formatting Prompt"
3. 点击 "Reset to Default"

**方法 2：手动编辑**
1. 打开 Formatting Prompt 文本框
2. 参考新版本调整您的 Prompt
3. 保存设置

## 📈 性能影响

- **Token 使用**：略微增加（~10 tokens）
- **处理时间**：无明显变化
- **效果提升**：显著（特别是长句处理）

## ⚠️ 注意事项

### 可能的影响

**1. 标点可能更密集**
- 新 Prompt 会在更多位置添加标点
- 如果觉得过多，可以调整为"only at major breaks"

**2. 风格变化**
- 从句标点增多，更接近书面语
- 如果需要保持口语风格，可以移除第 2 条

**3. 兼容性**
- 不同 AI 模型理解可能略有差异
- 建议测试后选择最适合的模型

## 🎓 延伸阅读

### Prompt 优化技巧

**1. 渐进细化**
```
V1: Add punctuation
V2: Add punctuation at breaks  
V3: Identify breaks and add punctuation ← 当前
```

**2. 提供示例**（可选）
```
Example:
Input: hello world how are you
Output: Hello world! How are you?
```

**3. 负面约束**
```
Don't: Change words, Add extra words
Do: Only add punctuation
```

## 🔗 相关文档

- [自定义格式化 Prompt](./CUSTOM_FORMATTING_PROMPT.md)
- [AI 格式化功能](./AI_FORMATTING.md)
- [Prompt Engineering 最佳实践](https://platform.openai.com/docs/guides/prompt-engineering)

---

**更新版本**: v1.1.1  
**更新日期**: 2024-11-24  
**兼容性**: 向后兼容，可选升级
