# 自定义 AI 格式化 Prompt

## 🎯 功能说明

现在您可以自定义 AI 文本格式化的 Prompt，灵活调整分段长度和格式化规则！

## ⚙️ 如何使用

### 1. 打开设置

```
Settings → AI Translation → Formatting Prompt
```

### 2. 编辑 Prompt

在大文本框中编辑您的自定义 Prompt。使用 `{{text}}` 作为输入文本的占位符。

### 3. 调整分段长度

修改 Prompt 中的分段指示，例如：

**短段落**（2-4 句/段）：
```
3. Breaking into natural paragraphs (aim for 2-4 sentences per paragraph for concise reading)
```

**中等段落**（3-5 句/段）- 默认：
```
3. Breaking into natural paragraphs (aim for 3-5 sentences per paragraph for better readability)
```

**长段落**（5-8 句/段）：
```
3. Breaking into natural paragraphs (aim for 5-8 sentences per paragraph for detailed content)
```

### 4. 重置为默认

点击 "Reset to Default" 按钮恢复默认 Prompt。

## 📝 默认 Prompt

```
Please format the following transcript text by:
1. Adding proper punctuation (periods, commas, question marks, exclamation marks, etc.)
2. Capitalizing the first letter of sentences
3. Breaking into natural paragraphs (aim for 3-5 sentences per paragraph for better readability)
4. Fixing obvious spacing issues
5. Keep the original words unchanged, only add punctuation and formatting

Input text (without punctuation):
{{text}}

Output the formatted text with proper punctuation and paragraphs:
```

## 🎨 自定义示例

### 示例 1: 简短分段（适合快速阅读）

```
Please format this transcript by:
1. Add all necessary punctuation marks
2. Capitalize properly
3. Create SHORT paragraphs (2-3 sentences each) for easy scanning
4. Fix spacing issues
5. Keep original words unchanged

Input text:
{{text}}

Output formatted text with short paragraphs:
```

**效果**：
```
Hey guys, it's Arianita Lagringa, and welcome back to my YouTube channel. Can you guess where I'm at today?

Today I'm at Starbucks! And as you can see behind me, you can see the beautiful Starbucks logo.

This logo is famous worldwide. You all might be wondering, "Why are you at Starbucks?"
```

### 示例 2: 详细分段（适合深度学习）

```
Please format this transcript by:
1. Add comprehensive punctuation (periods, commas, semicolons, colons, question marks, exclamation marks)
2. Proper capitalization for names and sentences
3. Create DETAILED paragraphs (5-7 sentences each) for thorough reading
4. Maintain logical flow between sentences
5. Preserve original wording

Text to format:
{{text}}

Formatted output with detailed paragraphs:
```

**效果**：
```
Hey guys, it's Arianita Lagringa, and welcome back to my YouTube channel. Can you guys guess where I'm at today? Today I'm at Starbucks! And as you can see behind me, you can see the beautiful Starbucks logo that they have. This logo is famous worldwide. You all might be wondering, "Arianita, why are you at Starbucks?" Well, today I'm at Starbucks because I want to teach you guys some coffee vocabulary. And you guys might be wondering, "Wait, it's really easy to order coffee!" Actually, it can be pretty difficult, especially at Starbucks, because they have different sizes, different coffee, and different drinks all together.
```

### 示例 3: 中文格式化

如果需要格式化中文转录：

```
请格式化以下转录文本：
1. 添加标点符号（句号、逗号、问号、感叹号等）
2. 根据主题变化智能分段（每段 3-5 句，便于阅读）
3. 修正空格问题
4. 保持原文词汇不变

待格式化文本：
{{text}}

输出格式化后的文本：
```

### 示例 4: 专业术语保留

对于专业内容（如编程、科技）：

```
Format this technical transcript:
1. Add punctuation marks accurately
2. Capitalize technical terms and proper nouns correctly (e.g., JavaScript, API, React)
3. Create moderate paragraphs (4-5 sentences each)
4. Preserve technical jargon and code terminology exactly as spoken
5. Add line breaks at natural topic transitions

Input:
{{text}}

Formatted technical output:
```

## 🔧 高级技巧

### 变量占位符

当前支持的占位符：
- `{{text}}` - 输入文本（必需）

### Prompt 组成要素

一个好的 Prompt 应包含：

1. **任务说明** - 明确告诉 AI 要做什么
2. **具体规则** - 列出格式化要求（标点、大写、分段等）
3. **分段指示** - 指定每段的句子数量
4. **约束条件** - 例如"保持原文不变"
5. **输入标记** - 使用 `{{text}}` 占位符
6. **输出标记** - 明确输出格式

### 调整分段长度的关键词

| 长度 | 句数 | 关键词 |
|------|------|--------|
| 超短 | 1-2 | very short, brief, concise |
| 短 | 2-4 | short, compact, quick |
| 中等 | 3-5 | moderate, balanced, readable |
| 长 | 5-8 | detailed, comprehensive, thorough |
| 超长 | 8+ | extensive, in-depth |

## 📊 效果对比

### 不同分段长度的阅读体验

**超短段（1-2 句）**：
- ✅ 快速浏览
- ✅ 视觉清爽
- ❌ 过于零散
- 适合：新闻快讯、社交媒体

**短段（2-4 句）**：
- ✅ 易于理解
- ✅ 适合移动端
- ✅ 减少认知负担
- 适合：教程、Vlog

**中等段（3-5 句）** - 推荐：
- ✅ 平衡性好
- ✅ 逻辑清晰
- ✅ 适合大多数内容
- 适合：学习材料、TED 演讲

**长段（5-8 句）**：
- ✅ 内容完整
- ✅ 上下文丰富
- ❌ 阅读疲劳
- 适合：学术内容、深度访谈

## 🎯 使用建议

### 根据内容类型选择

**口语化内容**（Vlog、访谈）：
- 推荐：短段（2-4 句）
- 理由：口语节奏快，话题跳转多

**教育内容**（教程、讲座）：
- 推荐：中等段（3-5 句）
- 理由：知识点清晰，便于笔记

**学术内容**（论文讲解、专业分析）：
- 推荐：长段（5-8 句）
- 理由：逻辑连贯，论证完整

### 根据学习目标调整

**快速浏览**：
- 使用短段
- 可以快速扫描获取关键信息

**深度学习**：
- 使用中等到长段
- 保持上下文完整性

**制作笔记**：
- 使用中等段
- 易于摘录和引用

## 💡 实用技巧

### 1. 测试不同长度

建议先用一个测试视频尝试不同的分段长度：
```
1. 导入视频（短段设置）→ 查看效果
2. 调整 Prompt 为中等段 → 重新导入
3. 比较并选择最适合的
```

### 2. 保存多个版本

可以将不同的 Prompt 保存在笔记中：
```markdown
# My Formatting Prompts

## Short Paragraphs
[prompt for 2-4 sentences]

## Medium Paragraphs
[prompt for 3-5 sentences]

## Long Paragraphs
[prompt for 5-8 sentences]
```

### 3. 组合使用

对于长视频，可以：
- 开头：短段（吸引注意力）
- 中间：中等段（详细内容）
- 结尾：短段（总结要点）

（目前需要手动编辑，未来可能支持分区格式化）

## ⚠️ 注意事项

### Prompt 编写规范

1. **必须包含 `{{text}}`**
   - 这是输入文本的占位符
   - AI 会将实际文本替换到这个位置

2. **指令要清晰**
   - 使用简单明确的语言
   - 避免模糊或矛盾的指示

3. **保持合理长度**
   - Prompt 太长会占用 token
   - 太短可能效果不佳
   - 推荐：100-300 字符

### 可能的问题

**问题 1：分段没有按预期长度**
- **原因**：AI 模型理解偏差
- **解决**：更明确地指定句数，如 "exactly 3-5 sentences"

**问题 2：格式化后内容有变化**
- **原因**：Prompt 中缺少"保持原文不变"指示
- **解决**：添加 "Keep original words unchanged"

**问题 3：处理速度慢**
- **原因**：Prompt 太复杂或网络延迟
- **解决**：简化 Prompt，或更换 AI 服务商

## 📚 相关文档

- [AI 智能格式化功能](./AI_FORMATTING.md)
- [设置指南](./README.md#settings)
- [故障排除](./AI_FORMATTING.md#故障排除)

## 🎓 学习资源

### Prompt Engineering 最佳实践

1. **Be Specific** - 具体明确
2. **Give Examples** - 提供示例（可选）
3. **Set Constraints** - 设置约束
4. **Test Iteratively** - 迭代测试

### 推荐阅读

- OpenAI Prompt Engineering Guide
- Claude Prompt Design
- Best Practices for AI Text Formatting

---

**功能版本**: v1.1.0
**更新日期**: 2024-11-24
**提示**: 调整 Prompt 后，可以重新导入视频测试效果！
