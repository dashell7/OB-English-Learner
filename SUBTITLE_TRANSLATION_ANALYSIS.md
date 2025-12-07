# 📝 OB English Learner 字幕生成与翻译逻辑分析

**分析日期**: 2025-12-03  
**版本**: 1.0.2

---

## 📊 完整流程图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        用户输入 YouTube URL                          │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Step 1: 提取视频元数据                                               │
│ - 标题、频道、时长、缩略图                                           │
│ - 使用浏览器 User-Agent 请求 YouTube 页面                           │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Step 2: 获取字幕（多策略）                                           │
│                                                                      │
│ Strategy 1: 尝试获取英文字幕                                         │
│   ├─ 尝试 'en', 'en-US', 'en-GB' 语言代码                           │
│   ├─ 检测内容是否真的是英文（检查有无中文字符）                      │
│   └─ 如果是中文内容，尝试下一个语言代码                              │
│                                                                      │
│ Strategy 2: 如果英文未找到，获取原始语言字幕                         │
│   ├─ 不指定语言代码，获取默认字幕                                   │
│   ├─ 自动检测语言（通过内容中的中文字符）                           │
│   └─ 标记为 'en' 或 'zh'                                            │
│                                                                      │
│ Strategy 3: 尝试获取中文翻译                                         │
│   ├─ 如果有英文 + AI 启用 → 使用 AI 翻译 ⭐                        │
│   ├─ 如果 AI 失败/未启用 → 尝试 YouTube 中文字幕                    │
│   └─ 尝试 'zh-Hans', 'zh-CN', 'zh', 'zh-TW' 语言代码               │
│                                                                      │
│ Result:                                                              │
│   ├─ enTranscript (英文字幕，可能为空)                              │
│   └─ zhTranscript (中文翻译，可能为空)                              │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Step 3: 字幕重分段（Resegmentation）                                │
│                                                                      │
│ 目的: 将短字幕行合并成完整句子                                       │
│                                                                      │
│ 逻辑:                                                                │
│   1. 检查标点符号密度                                               │
│      - 如果标点符号 < 行数/10 → 跳过重分段（避免全部合并）          │
│   2. 计算字符级时间戳                                               │
│      - 将每行字幕的时间均匀分配到每个字符                           │
│   3. 按句子终止符分割（. ! ? 。！？）                               │
│      - 遇到句号等标点时创建新行                                     │
│   4. 保持时间戳精确                                                 │
│      - 新行的 start/duration 基于原始字符级时间戳                   │
│                                                                      │
│ 效果:                                                                │
│   原始: "Hello" → "my name is" → "John."                            │
│   重分段: "Hello my name is John."                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Step 4: 确定主字幕（Primary Transcript）                            │
│                                                                      │
│ 优先级:                                                              │
│   1. 如果有英文 → 使用英文作为主字幕（最佳学习体验）                │
│   2. 如果只有中文 → 使用中文（显示警告）                            │
│   3. 如果都没有 → 抛出错误                                          │
│                                                                      │
│ Result:                                                              │
│   ├─ transcript (主字幕)                                            │
│   └─ translatedTranscript (翻译，可选)                              │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Step 5: AI 智能分段与标点（如果启用）                               │
│                                                                      │
│ 条件:                                                                │
│   ✅ enableAIFormatting 或 enableAISubtitles 已启用                │
│   ✅ AI API Key 已配置                                              │
│   ✅ 语言是英文（lang.startsWith('en')）                            │
│                                                                      │
│ 处理流程:                                                            │
│   1. 使用 AI 进行智能分句和标点                                     │
│      - 批处理：每批 20 行                                           │
│      - 等待间隔：2 秒（避免 API 限流）                              │
│      - 合并短行成完整句子                                           │
│      - 添加正确的标点符号                                           │
│                                                                      │
│   2. 如果 enableAITranslation 启用                                  │
│      - 重新翻译精细化后的字幕                                       │
│      - 保持字幕对齐                                                 │
│                                                                      │
│ Result:                                                              │
│   ├─ refinedTranscript (精细化后的字幕)                             │
│   └─ refinedTranslatedTranscript (重新翻译的字幕)                   │
│                                                                      │
│ 错误处理:                                                            │
│   - 失败时使用原始字幕                                              │
│   - 显示错误通知                                                    │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Step 6: 生成 SRT 字幕文件                                           │
│                                                                      │
│ 逻辑:                                                                │
│   - 如果 enableAISubtitles 启用 → 使用 refinedTranscript           │
│   - 否则 → 使用原始 transcript                                      │
│                                                                      │
│ 生成文件:                                                            │
│   ├─ 视频标题.en.srt (英文字幕)                                     │
│   ├─ 视频标题.zh.srt (中文字幕，如果有翻译)                         │
│   └─ 视频标题.bilingual.srt (双语字幕，如果有翻译)                  │
│                                                                      │
│ 位置: 02-Subtitles/视频标题/                                        │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Step 7: 生成笔记内容                                                │
│                                                                      │
│ 逻辑:                                                                │
│   1. 确定显示用字幕                                                 │
│      - 如果 enableAIFormatting 启用 → 使用 refinedTranscript       │
│      - 否则 → 使用原始 transcript                                   │
│                                                                      │
│   2. 优先显示英文                                                   │
│      - 如果主字幕是英文 → 使用主字幕                                │
│      - 如果翻译是英文 → 使用翻译                                    │
│      - 否则 → 使用主字幕                                            │
│                                                                      │
│   3. AI 格式化笔记内容（如果启用）                                  │
│      - 条件: enableAIFormatting + AI API Key                        │
│      - 将字幕转换为段落格式                                         │
│      - 添加标点符号                                                 │
│      - 每 2-4 句分成一段                                            │
│      - 批处理：每批约 2000 字符                                     │
│      - 等待间隔：2 秒                                               │
│                                                                      │
│   4. 默认格式（如果 AI 格式化失败或未启用）                         │
│      - 每 3 行合并成一段                                            │
│      - 用空行分隔段落                                               │
│                                                                      │
│ Result:                                                              │
│   - 创建 01-Videos/视频标题/视频标题.md                             │
│   - 包含视频元数据、封面、字幕链接、格式化文本                      │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
                            ✅ 完成！
```

---

## 🔑 核心逻辑解析

### 1. 字幕获取策略（多重备份）

**问题**: YouTube 字幕 API 不稳定，语言代码可能返回错误的语言

**解决方案**: 三重策略 + 内容检测

```typescript
// Strategy 1: 明确请求英文
for (const langCode of ['en', 'en-US', 'en-GB']) {
    const response = await getTranscript(url, { lang: langCode });
    const hasChinese = /[\u4e00-\u9fa5]/.test(response.lines[0].text);
    if (!hasChinese) {
        enTranscript = response.lines;
        break;
    }
}

// Strategy 2: 获取原始语言
const originalResponse = await getTranscript(url); // 不指定语言
const hasChinese = /[\u4e00-\u9fa5]/.test(originalResponse.lines[0].text);
if (hasChinese) {
    zhTranscript = originalResponse.lines;
} else {
    enTranscript = originalResponse.lines;
}

// Strategy 3: 获取中文翻译
if (enTranscript && aiEnabled) {
    // 优先使用 AI 翻译（质量更好）
    zhTranscript = await aiTranslator.translateTranscript(enTranscript);
} else {
    // 回退到 YouTube 中文字幕
    for (const langCode of ['zh-Hans', 'zh-CN', 'zh', 'zh-TW']) {
        const response = await getTranscript(url, { lang: langCode });
        // ...
    }
}
```

**优点**:
- ✅ 鲁棒性强，多重备份
- ✅ 内容检测比语言代码更可靠
- ✅ AI 翻译质量优于机器翻译

---

### 2. 字幕重分段（Resegmentation）

**问题**: YouTube 字幕通常很短（2-5 个单词），不利于阅读

**原始字幕**:
```
[00:00] Hello
[00:01] my name is
[00:03] John
[00:04] and I'm here
[00:06] to teach you
[00:08] English.
```

**重分段后**:
```
[00:00] Hello my name is John and I'm here to teach you English.
```

**实现逻辑**:
```typescript
// 1. 计算字符级时间戳
for (const line of lines) {
    const durationPerChar = line.duration / line.text.length;
    for (let i = 0; i < line.text.length; i++) {
        allChars.push({
            char: line.text[i],
            time: line.start + (i * durationPerChar)
        });
    }
}

// 2. 按句子终止符分割
for (const charObj of allChars) {
    currentText += charObj.char;
    if (sentenceEndRegex.test(charObj.char)) {
        // 找到句号，创建新行
        newLines.push({
            start: startTime,
            duration: charObj.time - startTime,
            text: currentText.trim(),
            lang: lines[0].lang
        });
        currentText = '';
        startTime = charObj.time;
    }
}
```

**优点**:
- ✅ 保持时间戳精确
- ✅ 形成完整句子，易读
- ✅ 避免过度合并（检查标点密度）

---

### 3. AI 翻译流程

**批处理策略**:
```typescript
// 每批 20 行，避免 token 超限
const batchSize = 20;
for (let i = 0; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, i + batchSize);
    
    // 构建提示词
    const texts = batch.map((line, index) => 
        `${index + 1}. ${line.text}`
    ).join('\n');
    
    const prompt = `请将以下英文字幕翻译成中文。要求：
1. 保持序号不变
2. 翻译要准确、自然、符合中文表达习惯
3. 专业术语要准确
4. 只输出翻译结果，不要解释

待翻译内容：
${texts}

翻译结果：`;
    
    const response = await callAI(prompt);
    const translatedBatch = parseResponse(response, batch);
    translatedLines.push(...translatedBatch);
    
    // 等待 2 秒避免限流
    await sleep(2000);
}
```

**错误处理**:
```typescript
try {
    const response = await callAI(prompt);
    return parseTranslationResponse(response, lines);
} catch (error) {
    // 失败时返回原文 + 标记
    return lines.map(line => ({
        ...line,
        text: `[Translation failed] ${line.text}`,
        lang: 'zh'
    }));
}
```

---

### 4. AI 智能分段与标点

**两阶段处理**:

**阶段 1: 在 main.ts 中（loadVideo）**
```typescript
// 条件：启用 AI Formatting/Subtitles + 语言是英文
if ((enableAIFormatting || enableAISubtitles) && lang.startsWith('en')) {
    // 智能分句和标点（保留时间戳）
    refinedTranscript = await translator.segmentAndPunctuate(transcript);
    
    // 如果启用翻译，重新翻译精细化后的字幕
    if (enableAITranslation) {
        refinedTranslatedTranscript = await translator.translateTranscript(refinedTranscript);
    }
}
```

**阶段 2: 在 generator.ts 中（createVideoNote）**
```typescript
// 确定用于笔记的字幕
const noteTranscript = enableAIFormatting && refinedTranscript
    ? refinedTranscript
    : transcript;

// 再次格式化笔记内容（去除时间戳，转为段落）
if (enableAIFormatting && aiApiKey) {
    formattedTranscriptText = await formatter.formatTranscript(
        displayTranscript,
        aiFormattingPrompt
    );
}
```

**为什么要两次 AI 处理？**

1. **第一次（segmentAndPunctuate）**:
   - 目的: 优化字幕行（保留时间戳）
   - 用于: SRT 字幕文件（如果 enableAISubtitles）
   - 保留: `TranscriptLine[]` 格式（start, duration, text）

2. **第二次（formatTranscript）**:
   - 目的: 优化笔记显示（去除时间戳）
   - 用于: Markdown 笔记内容
   - 输出: 纯文本字符串（分段落）

---

### 5. 字幕使用分配

**三个开关，三种用途**:

| 开关 | 影响范围 | 使用的字幕 |
|-----|---------|-----------|
| **enableAISubtitles** | SRT 字幕文件 | refinedTranscript（AI 优化）|
| **enableAIFormatting** | Markdown 笔记 | AI 格式化文本（段落形式）|
| **enableAITranslation** | 中文翻译 | AI 翻译（而非 YouTube 机翻）|

**示例场景**:

**场景 1**: 全部启用
```
✅ enableAISubtitles
✅ enableAIFormatting
✅ enableAITranslation

Result:
├─ SRT 文件: 使用 AI 精细分句 + 标点
│  ├─ 英文.srt: refinedTranscript
│  ├─ 中文.srt: refinedTranslatedTranscript (AI 翻译)
│  └─ 双语.srt: 合并上述两者
└─ Markdown 笔记: 使用 AI 格式化文本（2-4 句一段）
```

**场景 2**: 只启用笔记格式化
```
❌ enableAISubtitles
✅ enableAIFormatting
❌ enableAITranslation

Result:
├─ SRT 文件: 使用原始字幕（重分段后）
│  └─ 英文.srt: 原始 transcript
└─ Markdown 笔记: 使用 AI 格式化文本（2-4 句一段）
```

**场景 3**: 全部禁用
```
❌ enableAISubtitles
❌ enableAIFormatting
❌ enableAITranslation

Result:
├─ SRT 文件: 使用原始字幕（重分段后）
│  ├─ 英文.srt: 原始 transcript
│  └─ 中文.srt: YouTube 机器翻译（如果有）
└─ Markdown 笔记: 默认格式（每 3 行一段）
```

---

## 🚨 当前存在的问题

### 问题 1: AI 重复处理，效率低

**现象**:
- 同一段字幕被 AI 处理了 2 次
- 第一次: `segmentAndPunctuate`（保留时间戳）
- 第二次: `formatTranscript`（生成段落文本）

**成本**:
- 1 个 10 分钟视频（~150 行字幕）
- 第一次: 8 批 × 2 秒 = 16 秒 + API 调用
- 第二次: 3 批 × 2 秒 = 6 秒 + API 调用
- 总计: ~22 秒 + 双倍 API 费用

**原因**:
- 两个阶段需要不同格式
- 第一次需要保留时间戳（TranscriptLine[]）
- 第二次需要纯文本（string）

---

### 问题 2: AI 格式化可能不稳定

**现象**:
- 用户报告"转录文本还是整段很长，不是 2-4 句一段"

**可能原因**:
1. AI API 调用失败（未捕获）
2. AI 提示词不够严格
3. AI 没有严格遵循指令
4. 某些语言模型不擅长格式化

**当前提示词**:
```
Please format the following transcript text. You MUST follow these rules:
1. ADD PUNCTUATION: Insert periods, commas, question marks, etc.
2. PARAGRAPH BREAKS: Break into short paragraphs (every 2-4 sentences). 
   Use double newlines (\n\n) between paragraphs.
3. CAPITALIZATION: Capitalize the first letter of each sentence.
4. NO CONTENT CHANGES: Do NOT change, add, or remove any words.
5. NO EXPLANATIONS: Output ONLY the formatted text.
```

**问题点**:
- 缺少示例
- 没有强制验证
- 没有后处理检查

---

### 问题 3: 错误处理不够完善

**现象**:
- AI 调用失败时，用户不清楚原因
- 部分失败时继续使用原始字幕，但没有明确提示

**改进前**:
```typescript
} catch (error) {
    console.error('[LinguaSync] AI segmentation failed:', error);
    new Notice(`AI Segmentation failed: ${error.message}`);
    // 继续使用原始字幕
}
```

**问题**:
- 用户只看到 Notice，不知道后续流程
- 不清楚是部分失败还是完全失败
- 没有建议的修复步骤

---

### 问题 4: 翻译批处理等待时间固定

**现象**:
- 无论 API 限流情况如何，都等待 2 秒
- 可能造成不必要的延迟

**当前逻辑**:
```typescript
for (let i = 0; i < lines.length; i += batchSize) {
    // 处理批次
    await processBatch(batch);
    
    // 固定等待 2 秒
    if (i + batchSize < lines.length) {
        await sleep(2000);
    }
}
```

**问题**:
- 不够智能，无法适应不同 API 的限流策略
- 短视频（< 20 行）也会等待，浪费时间

---

### 问题 5: 字幕语言检测不够完善

**现象**:
- 只检查第一行是否包含中文字符
- 可能误判混合语言内容

**当前逻辑**:
```typescript
const firstLine = response.lines[0]?.text || '';
const hasChinese = /[\u4e00-\u9fa5]/.test(firstLine);
```

**问题**:
- 如果第一行是英文，但后续有中文，会误判
- 混合语言视频（中英混杂）无法正确处理

---

## 💡 改进建议

### 改进 1: 合并 AI 处理，减少重复调用

**方案 A: 一次生成两种格式**

```typescript
// 新方法: 同时生成 TranscriptLine[] 和段落文本
async segmentAndFormat(lines: TranscriptLine[]): Promise<{
    segmented: TranscriptLine[],  // 用于 SRT
    formatted: string              // 用于笔记
}> {
    // 批处理
    for (let i = 0; i < lines.length; i += batchSize) {
        const batch = lines.slice(i, i + batchSize);
        
        // 一次 API 调用，要求输出两种格式
        const prompt = `请处理以下字幕，输出两种格式：

1. 分句字幕（保留序号，合并成完整句子，添加标点）
2. 段落文本（每 2-4 句分段，用空行分隔）

输入：
${batch.map((l, i) => `${i+1}. ${l.text}`).join('\n')}

输出格式：
===分句字幕===
1-3: Hello, my name is John.
4-5: I'm here to teach you English.

===段落文本===
Hello, my name is John. I'm here to teach you English.

This is the second paragraph.`;

        const response = await this.callAI(prompt);
        const { segmented, formatted } = this.parseCombinedResponse(response, batch);
        // ...
    }
}
```

**优点**:
- ✅ 减少 50% API 调用
- ✅ 减少 50% 等待时间
- ✅ 降低 API 费用

**缺点**:
- ❌ 提示词更复杂
- ❌ 解析响应更复杂
- ❌ AI 可能不遵循格式

---

**方案 B: 缓存分句结果，直接转换**

```typescript
// 在 segmentAndPunctuate 后，缓存结果
videoData.refinedTranscript = await translator.segmentAndPunctuate(transcript);

// 在 generator.ts 中，直接将 TranscriptLine[] 转换为段落文本
function convertToFormattedText(lines: TranscriptLine[]): string {
    const paragraphs: string[] = [];
    let currentParagraph: string[] = [];
    let sentenceCount = 0;
    
    for (const line of lines) {
        currentParagraph.push(line.text);
        
        // 检查是否是句子结尾
        if (/[.!?。！？]$/.test(line.text.trim())) {
            sentenceCount++;
        }
        
        // 每 2-4 句分段
        if (sentenceCount >= 2 && sentenceCount <= 4) {
            paragraphs.push(currentParagraph.join(' '));
            currentParagraph = [];
            sentenceCount = 0;
        }
    }
    
    // 最后一段
    if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' '));
    }
    
    return paragraphs.join('\n\n');
}
```

**优点**:
- ✅ 无需额外 AI 调用
- ✅ 速度快
- ✅ 100% 可靠（基于规则）

**缺点**:
- ❌ 质量可能不如 AI 生成
- ❌ 无法进一步优化措辞

---

**推荐**: **方案 B**（更实用、更可靠）

---

### 改进 2: 增强 AI 格式化提示词

**改进后的提示词**:

```typescript
const IMPROVED_FORMATTING_PROMPT = `You are a professional transcript formatter. Format the following transcript text.

STRICT RULES (MUST FOLLOW):
1. **PUNCTUATION**: Add periods, commas, question marks, etc. where appropriate.
2. **PARAGRAPH BREAKS**: 
   - Break into short paragraphs.
   - Each paragraph should contain 2-4 complete sentences.
   - Use double newlines (\\n\\n) between paragraphs.
3. **CAPITALIZATION**: Capitalize the first letter of each sentence.
4. **NO CONTENT CHANGES**: Do NOT change, add, or remove any words.
5. **NO EXPLANATIONS**: Output ONLY the formatted text. No comments or notes.

EXAMPLE INPUT:
hello my name is john i am a teacher today i want to teach you english grammar is very important lets start with the basics

EXAMPLE OUTPUT:
Hello, my name is John. I am a teacher. Today I want to teach you English.

Grammar is very important. Let's start with the basics.

INPUT TEXT:
{{text}}

FORMATTED OUTPUT:`;
```

**改进点**:
- ✅ 添加示例（Few-shot learning）
- ✅ 明确段落长度（2-4 句）
- ✅ 强调规则（STRICT RULES, MUST FOLLOW）
- ✅ 清晰的输入/输出分隔

---

### 改进 3: 添加格式验证和后处理

```typescript
async formatTranscript(lines: TranscriptLine[], customPrompt?: string): Promise<string> {
    // ... 现有代码 ...
    
    const result = formattedChunks.join('\n\n');
    
    // 验证格式
    const validation = this.validateFormatting(result, lines);
    
    if (!validation.valid) {
        console.warn('[LinguaSync] ⚠️ AI formatting validation failed:', validation.issues);
        
        // 自动修正
        const corrected = this.autoCorrectFormatting(result);
        console.log('[LinguaSync] Applied auto-correction');
        return corrected;
    }
    
    return result;
}

/**
 * 验证格式化结果
 */
private validateFormatting(text: string, originalLines: TranscriptLine[]) {
    const issues: string[] = [];
    
    // 检查 1: 段落数量合理
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    const expectedParagraphs = Math.ceil(originalLines.length / 3);
    
    if (paragraphs.length < expectedParagraphs / 2) {
        issues.push('Too few paragraphs (text may not be properly segmented)');
    }
    
    // 检查 2: 段落长度合理（2-6 句）
    for (const paragraph of paragraphs) {
        const sentences = paragraph.match(/[.!?。！？]/g)?.length || 0;
        if (sentences > 10) {
            issues.push(`Paragraph too long (${sentences} sentences)`);
        }
    }
    
    // 检查 3: 是否有标点符号
    const punctuationCount = (text.match(/[.!?,;。！？，；]/g) || []).length;
    if (punctuationCount < text.length / 50) {
        issues.push('Insufficient punctuation');
    }
    
    return {
        valid: issues.length === 0,
        issues
    };
}

/**
 * 自动修正格式化问题
 */
private autoCorrectFormatting(text: string): string {
    let corrected = text;
    
    // 修正 1: 如果整段没有分段，强制分段
    if (!corrected.includes('\n\n')) {
        console.log('[LinguaSync] No paragraphs detected, forcing segmentation...');
        const sentences = corrected.split(/(?<=[.!?。！？])\s+/);
        const paragraphs: string[] = [];
        
        for (let i = 0; i < sentences.length; i += 3) {
            const paragraph = sentences.slice(i, i + 3).join(' ');
            paragraphs.push(paragraph);
        }
        
        corrected = paragraphs.join('\n\n');
    }
    
    // 修正 2: 确保首字母大写
    corrected = corrected.replace(/([.!?。！？]\s+)([a-z])/g, (match, p1, p2) => {
        return p1 + p2.toUpperCase();
    });
    
    // 修正 3: 移除多余的空行（超过 2 个）
    corrected = corrected.replace(/\n{3,}/g, '\n\n');
    
    return corrected;
}
```

---

### 改进 4: 智能等待策略

```typescript
class RateLimitManager {
    private lastCallTime: number = 0;
    private failureCount: number = 0;
    private baseDelay: number = 1000; // 1 秒基础延迟
    
    async waitIfNeeded() {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCallTime;
        
        // 根据失败次数动态调整延迟
        const delay = this.baseDelay * Math.pow(2, this.failureCount);
        const needsWait = timeSinceLastCall < delay;
        
        if (needsWait) {
            const waitTime = delay - timeSinceLastCall;
            console.log(`[LinguaSync] Rate limiting: waiting ${waitTime}ms...`);
            await this.sleep(waitTime);
        }
        
        this.lastCallTime = Date.now();
    }
    
    reportSuccess() {
        this.failureCount = Math.max(0, this.failureCount - 1);
    }
    
    reportFailure() {
        this.failureCount++;
    }
    
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 使用
private rateLimiter = new RateLimitManager();

private async callAI(prompt: string): Promise<string> {
    await this.rateLimiter.waitIfNeeded();
    
    try {
        const response = await this.makeAPICall(prompt);
        this.rateLimiter.reportSuccess();
        return response;
    } catch (error) {
        this.rateLimiter.reportFailure();
        throw error;
    }
}
```

---

### 改进 5: 更准确的语言检测

```typescript
/**
 * 检测字幕语言（检查前 10 行）
 */
private static detectLanguage(lines: any[]): 'en' | 'zh' | 'mixed' {
    const sampleSize = Math.min(10, lines.length);
    const sample = lines.slice(0, sampleSize);
    
    let chineseCount = 0;
    let englishCount = 0;
    
    for (const line of sample) {
        const text = line.text || '';
        
        // 检查中文字符
        const hasChinese = /[\u4e00-\u9fa5]/.test(text);
        if (hasChinese) chineseCount++;
        
        // 检查英文单词
        const hasEnglish = /[a-zA-Z]{2,}/.test(text);
        if (hasEnglish) englishCount++;
    }
    
    // 判断语言
    if (chineseCount > sampleSize * 0.7) {
        return 'zh';
    } else if (englishCount > sampleSize * 0.7) {
        return 'en';
    } else {
        return 'mixed';
    }
}

// 使用
const language = this.detectLanguage(response.lines);
console.log(`[LinguaSync] Detected language: ${language}`);

if (language === 'en') {
    enTranscript = response.lines.map(/* ... */);
} else if (language === 'zh') {
    zhTranscript = response.lines.map(/* ... */);
} else {
    // 混合语言，标记为英文但显示警告
    console.warn('[LinguaSync] Mixed language detected in transcript');
    enTranscript = response.lines.map(/* ... */);
}
```

---

### 改进 6: 更好的错误提示

```typescript
} catch (error) {
    console.error('[LinguaSync] ❌ AI segmentation failed:', error);
    
    // 详细的错误通知
    const errorMessage = this.generateUserFriendlyError(error);
    new Notice(errorMessage, 10000); // 10 秒
    
    // 提供恢复建议
    console.log('[LinguaSync] ℹ️ Fallback: Using original transcript without AI formatting');
    console.log('[LinguaSync] ℹ️ To fix: Check AI API settings and try again');
}

private generateUserFriendlyError(error: any): string {
    const errorType = error.message || String(error);
    
    if (errorType.includes('API key')) {
        return '❌ AI Formatting failed: Invalid API Key. Please check your AI settings.';
    } else if (errorType.includes('rate limit')) {
        return '❌ AI Formatting failed: Rate limit exceeded. Please wait and try again.';
    } else if (errorType.includes('network')) {
        return '❌ AI Formatting failed: Network error. Please check your internet connection.';
    } else if (errorType.includes('timeout')) {
        return '❌ AI Formatting failed: Request timeout. Please try again.';
    } else {
        return `❌ AI Formatting failed: ${errorType}. Continuing with default formatting.`;
    }
}
```

---

## 📈 优化总结

| 改进点 | 优先级 | 收益 | 难度 |
|-------|-------|------|------|
| 合并 AI 处理（方案 B） | 🔴 高 | 50% 速度提升 | 低 |
| 增强 AI 提示词 | 🔴 高 | 更好的格式化质量 | 低 |
| 添加格式验证 | 🟠 中 | 提高可靠性 | 中 |
| 智能等待策略 | 🟢 低 | 减少不必要等待 | 中 |
| 改进语言检测 | 🟠 中 | 减少误判 | 低 |
| 更好的错误提示 | 🟠 中 | 改善用户体验 | 低 |

---

## 🎯 实施建议

### 短期（1-2 天）
1. ✅ 实施改进 1 方案 B（合并 AI 处理）
2. ✅ 实施改进 2（增强提示词）
3. ✅ 实施改进 6（更好的错误提示）

### 中期（1 周）
4. ✅ 实施改进 3（格式验证）
5. ✅ 实施改进 5（语言检测）

### 长期（可选）
6. ✅ 实施改进 4（智能等待）
7. ✅ 添加缓存机制（避免重复处理相同视频）
8. ✅ 支持更多语言（日语、韩语等）

---

**文档维护**: Cascade AI Assistant  
**最后更新**: 2025-12-03  
**版本**: 1.0
