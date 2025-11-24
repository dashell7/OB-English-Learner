# AI 智能文本格式化功能

## 📝 功能概述

YouTube/Bilibili 的自动转录通常**缺少标点符号**，导致文本难以阅读。LinguaSync 的 AI 智能格式化功能可以自动：

1. ✅ 添加标点符号（句号、逗号、问号、感叹号等）
2. ✅ 首字母大写
3. ✅ 智能分段（根据话题变化自动分段）
4. ✅ 修复明显的空格问题

## 🆚 效果对比

### 原始转录（无标点符号）
```
hey guys it's arianita lagringa and welcome back to my YouTube channel can you guys 
guess where I'm at today today

I'm at Starbucks and as you can see behind me you can see the beautiful Starbucks logo 
that they have and this

logo is famous worldwide you all might be wondering arianita why are you at Starbucks well 
today I'm at Starbucks

because I want to teach you guys some coffee vocabulary and you guys might be wondering 
wait it's really easy to order

coffee actually it can be pretty difficult especially at Starbucks because they have different 
sizes

different coffee and different drinks all together so come along with me and let's go learn 
some English vocab inside
```

### AI 格式化后（有标点和分段）
```
Hey guys, it's Arianita Lagringa, and welcome back to my YouTube channel. Can you guys 
guess where I'm at today? Today I'm at Starbucks!

And as you can see behind me, you can see the beautiful Starbucks logo that they have. And 
this logo is famous worldwide. 

You all might be wondering, "Arianita, why are you at Starbucks?" Well, today I'm at Starbucks 
because I want to teach you guys some coffee vocabulary. And you guys might be wondering, 
"Wait, it's really easy to order coffee!"

Actually, it can be pretty difficult, especially at Starbucks, because they have different sizes, 
different coffee, and different drinks all together. So come along with me and let's go learn 
some English vocab inside!
```

## ⚙️ 如何启用

### 1. 配置 AI API
在插件设置中配置 AI 服务（与翻译功能共用）：

```
Settings → AI Translation
├─ AI Provider: DeepSeek (推荐) / OpenAI / Gemini
├─ API Key: 输入您的 API 密钥
└─ Model: 选择模型
```

### 2. 启用格式化功能
在设置中打开开关：

```
Settings → AI Translation
└─ ☑ Enable AI Text Formatting
```

### 3. 导入视频
正常导入视频，AI 会自动格式化转录文本：

```
Command: Import YouTube Video
→ 输入 URL
→ AI 自动添加标点和分段
→ 生成格式良好的笔记
```

## 🎯 工作原理

### 处理流程
```
1. 获取原始转录 ━━━━━━━━━━━━━━▶ 无标点符号
   └─ "hey guys its arianita..."
   
2. AI 智能分析 ━━━━━━━━━━━━━━━▶ 理解语义和停顿
   └─ 识别句子边界
   └─ 检测话题变化
   └─ 判断标点类型
   
3. 添加格式 ━━━━━━━━━━━━━━━━━▶ 输出格式化文本
   └─ "Hey guys, it's Arianita..."
   └─ 添加标点: . , ? ! 等
   └─ 首字母大写
   └─ 智能分段
   
4. 插入笔记 ━━━━━━━━━━━━━━━━━▶ 生成最终笔记
```

### 分批处理
- 长视频会被分成多个块（每块约 2000 字符）
- 逐块处理并合并，确保处理大型转录
- 每个块之间有 500ms 延迟，避免 API 限流

## 📊 性能考虑

### 处理时间
| 视频长度 | 转录字符数 | 处理时间 | API 调用 |
|---------|----------|---------|---------|
| 5 分钟  | ~1,500   | ~3秒    | 1 次    |
| 15 分钟 | ~4,500   | ~8秒    | 3 次    |
| 30 分钟 | ~9,000   | ~15秒   | 5 次    |
| 60 分钟 | ~18,000  | ~30秒   | 9 次    |

### API 成本（以 DeepSeek 为例）
- 输入: ¥0.001 / 1K tokens
- 输出: ¥0.002 / 1K tokens
- 一个 15 分钟视频约: ¥0.02-0.04 元

## 🔧 高级设置

### 何时使用
**推荐启用** ✅
- YouTube 自动转录（通常无标点）
- Bilibili 自动转录
- 学习材料需要清晰阅读

**可以禁用** ❌
- 已有完整标点的字幕
- 不需要阅读完整转录
- 想要节省 API 调用

### 与翻译功能的关系
两个功能**独立工作**：

```
场景 1: 仅格式化（无翻译）
├─ enableAITranslation: OFF
├─ enableAIFormatting: ON
└─ 结果: 英文转录 + 标点分段

场景 2: 仅翻译（无格式化）
├─ enableAITranslation: ON
├─ enableAIFormatting: OFF
└─ 结果: 英文转录（无标点）+ 中文翻译

场景 3: 格式化 + 翻译（推荐）
├─ enableAITranslation: ON
├─ enableAIFormatting: ON
└─ 结果: 英文转录（有标点）+ 中文翻译
```

## 💡 最佳实践

### 1. 选择合适的 AI 模型
```
DeepSeek (推荐):
- 模型: deepseek-chat
- 优点: 便宜、快速、效果好
- 成本: ~¥0.001/1K tokens

OpenAI:
- 模型: gpt-4o-mini
- 优点: 质量极高
- 成本: ~$0.15/1M tokens

Gemini:
- 模型: gemini-1.5-flash
- 优点: 免费额度
- 限制: 需要魔法上网
```

### 2. 检查格式化结果
第一次使用时建议：
1. 导入一个测试视频
2. 检查格式化效果
3. 如果不满意，可以禁用并使用默认分段

### 3. 处理失败情况
如果 AI 格式化失败：
- ❌ 不会中断导入流程
- ✅ 自动降级到默认分段
- ⚠️ 控制台会显示错误日志

## 📝 技术细节

### AI Prompt 设计
```
Please format the following transcript text by:
1. Adding proper punctuation (periods, commas, question marks, exclamation marks, etc.)
2. Capitalizing the first letter of sentences
3. Breaking into natural paragraphs based on topic changes or pauses
4. Fixing obvious spacing issues
5. Keep the original words unchanged, only add punctuation and formatting

Input text (without punctuation):
[原始转录文本]

Output the formatted text with proper punctuation and paragraphs:
```

### 代码示例
```typescript
// 在 translator.ts 中
async formatTranscript(lines: TranscriptLine[]): Promise<string> {
    // 合并所有行
    const rawText = lines.map(line => line.text).join(' ');
    
    // 分块处理
    const chunks = splitIntoChunks(rawText, 2000);
    
    // AI 格式化每个块
    const formattedChunks = await Promise.all(
        chunks.map(chunk => this.formatTextChunk(chunk))
    );
    
    // 合并结果
    return formattedChunks.join('\n\n');
}
```

### 在生成器中集成
```typescript
// 在 generator.ts 中
if (this.settings.enableAIFormatting && this.settings.aiApiKey) {
    const formatter = new AITranslator(translatorConfig);
    formattedText = await formatter.formatTranscript(transcript);
}

// 使用格式化文本
const transcriptContent = formattedText || defaultFormattedText;
```

## 🐛 故障排除

### 问题 1: 格式化没有生效
**检查清单**：
- [ ] 是否启用了 "Enable AI Text Formatting"
- [ ] 是否配置了有效的 API Key
- [ ] 检查控制台是否有错误日志
- [ ] API 额度是否充足

### 问题 2: 格式化速度慢
**可能原因**：
- 视频很长（>30分钟）
- 网络延迟高
- AI 服务负载高

**解决方案**：
- 处理短视频时测试
- 检查网络连接
- 更换 AI 服务商

### 问题 3: 格式化效果不理想
**可能原因**：
- 原始转录质量差
- AI 模型理解偏差

**解决方案**：
- 尝试不同的 AI 模型
- 禁用格式化，使用默认分段
- 手动编辑笔记内容

## 📚 相关设置

### 完整配置示例
```yaml
# AI 配置
enableAITranslation: true      # 启用翻译
enableAIFormatting: true       # 启用格式化
aiProvider: deepseek           # 使用 DeepSeek
aiApiKey: sk-xxxxxxxxxxxx      # API 密钥
aiModel: deepseek-chat         # 模型
aiBaseUrl: https://api.deepseek.com/v1/chat/completions

# 模板配置
noteTemplate: |
  ---
  title: "{{title}}"
  langr: {{title}}
  date: {{date}}
  cefr: B2
  cover: "{{cover}}"
  channel: "{{channel}}"
  url: {{url}}
  ---
  
  ^^^article
  
  {{transcript}}  ← 这里会插入格式化后的文本
  
  ^^^words
  ...
```

## 🎓 使用示例

### 示例 1: 学习视频
```
输入: TED Talk (15分钟)
原始: hey everyone today i want to talk about...
格式: Hey everyone! Today I want to talk about...

结果: 清晰易读的学习材料
```

### 示例 2: 教程视频
```
输入: 编程教程 (30分钟)
原始: so first we need to install node js and then...
格式: So first, we need to install Node.js, and then...

结果: 适合学习的格式化文本
```

### 示例 3: Vlog
```
输入: 日常 Vlog (10分钟)
原始: omg guys you wont believe what happened today so...
格式: OMG guys! You won't believe what happened today! So...

结果: 自然流畅的口语化文本
```

## ✨ 未来改进

计划中的功能：

- [ ] 支持更多语言（中文、日文等）
- [ ] 可自定义格式化规则
- [ ] 批量重新格式化已导入的笔记
- [ ] 格式化预览功能
- [ ] 支持本地 AI 模型

## 🔗 相关文档

- [AI Translation 功能说明](./README.md#ai-translation)
- [模板自定义指南](./TEMPLATE_PROPERTIES.md)
- [API 配置指南](./README.md#settings)

---

**提示**: 这个功能可以显著提升转录文本的可读性，强烈推荐在学习英文视频时启用！✨
