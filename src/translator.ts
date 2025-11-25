import { requestUrl, Notice } from 'obsidian';
import { TranscriptLine } from './types';

export interface TranslatorConfig {
    provider: 'openai' | 'deepseek' | 'gemini' | 'siliconflow' | 'videocaptioner' | 'custom';
    apiKey: string;
    model?: string;
    baseUrl?: string;
}

export class AITranslator {
    private hasNotifiedError = false;

    constructor(private config: TranslatorConfig) {}

    /**
     * Test connection by making a simple API call
     * Throws error if connection fails
     */
    async testConnection(): Promise<void> {
        const prompt = "Hello";
        await this.callAI(prompt);
    }

    /**
     * 翻译整个字幕数组
     */
    async translateTranscript(lines: TranscriptLine[]): Promise<TranscriptLine[]> {
        console.log('[LinguaSync] Starting AI translation...');
        console.log(`[LinguaSync] Provider: ${this.config.provider}, Lines: ${lines.length}`);

        // 批量翻译，每20行一组以提高效率
        const batchSize = 20;
        const translatedLines: TranscriptLine[] = [];

        for (let i = 0; i < lines.length; i += batchSize) {
            const batch = lines.slice(i, i + batchSize);
            console.log(`[LinguaSync] Translating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(lines.length / batchSize)}...`);
            
            const translatedBatch = await this.translateBatch(batch);
            translatedLines.push(...translatedBatch);
            
            // 避免API限流，稍微延迟
            if (i + batchSize < lines.length) {
                await this.sleep(500);
            }
        }

        console.log('[LinguaSync] ✅ Translation completed!');
        return translatedLines;
    }

    /**
     * 翻译一批字幕
     */
    private async translateBatch(lines: TranscriptLine[]): Promise<TranscriptLine[]> {
        // 构建提示词
        const texts = lines.map((line, index) => `${index + 1}. ${line.text}`).join('\n');
        
        const prompt = `请将以下英文字幕翻译成中文。要求：
1. 保持序号不变
2. 翻译要准确、自然、符合中文表达习惯
3. 专业术语要准确
4. 只输出翻译结果，不要解释

待翻译内容：
${texts}

翻译结果：`;

        try {
            const response = await this.callAI(prompt);
            return this.parseTranslationResponse(response, lines);
        } catch (error) {
            console.error('[LinguaSync] Translation error:', error);
            
            if (!this.hasNotifiedError) {
                new Notice(`Translation failed: ${error.message}. Check console for details.`);
                this.hasNotifiedError = true;
            }

            // 翻译失败时返回原文作为占位
            return lines.map(line => ({
                ...line,
                text: `[Translation failed] ${line.text}`,
                lang: 'zh'
            }));
        }
    }

    /**
     * 调用AI API
     */
    private async callAI(prompt: string): Promise<string> {
        const { provider, apiKey, model, baseUrl } = this.config;

        if (provider === 'openai' || provider === 'deepseek' || provider === 'siliconflow' || provider === 'videocaptioner' || provider === 'custom') {
            return await this.callOpenAICompatible(prompt, apiKey, model, baseUrl);
        } else if (provider === 'gemini') {
            return await this.callGemini(prompt, apiKey, model);
        }

        throw new Error(`Unsupported provider: ${provider}`);
    }

    /**
     * 调用OpenAI兼容的API（OpenAI, DeepSeek等）
     */
    private async callOpenAICompatible(
        prompt: string,
        apiKey: string,
        model?: string,
        baseUrl?: string
    ): Promise<string> {
        // Validate API key before making request
        if (!apiKey || !apiKey.trim()) {
            throw new Error('API key is required but not provided or is empty');
        }

        let defaultBaseUrl = 'https://api.openai.com/v1/chat/completions';
        if (this.config.provider === 'deepseek') {
            defaultBaseUrl = 'https://api.deepseek.com/v1/chat/completions';
        } else if (this.config.provider === 'siliconflow') {
            defaultBaseUrl = 'https://api.siliconflow.cn/v1/chat/completions';
        } else if (this.config.provider === 'videocaptioner') {
            defaultBaseUrl = 'https://api.videocaptioner.cn/v1/chat/completions';
        }

        const url = baseUrl || defaultBaseUrl;

        let defaultModel = 'gpt-4o-mini';
        if (this.config.provider === 'deepseek') {
            defaultModel = 'deepseek-chat';
        } else if (this.config.provider === 'siliconflow') {
            defaultModel = 'deepseek-ai/DeepSeek-V3';
        } else if (this.config.provider === 'videocaptioner') {
            defaultModel = 'gpt-4.1-mini';
        }

        const response = await requestUrl({
            url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey.trim()}`
            },
            body: JSON.stringify({
                model: model || defaultModel,
                messages: [
                    {
                        role: 'system',
                        content: '你是一个专业的英中翻译助手。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 4000
            })
        });

        const data = response.json;
        return data.choices[0].message.content.trim();
    }

    /**
     * 调用Gemini API
     */
    private async callGemini(prompt: string, apiKey: string, model?: string): Promise<string> {
        // Validate API key before making request
        if (!apiKey || !apiKey.trim()) {
            throw new Error('API key is required but not provided or is empty');
        }

        const modelName = model || 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;

        const response = await requestUrl({
            url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 4000
                }
            })
        });

        const data = response.json;
        return data.candidates[0].content.parts[0].text.trim();
    }

    /**
     * 解析AI返回的翻译结果
     */
    private parseTranslationResponse(response: string, originalLines: TranscriptLine[]): TranscriptLine[] {
        const lines = response.split('\n').filter(line => line.trim());
        const translated: TranscriptLine[] = [];

        for (const originalLine of originalLines) {
            // 尝试找到对应的翻译
            const matchedLine = lines.find(line => {
                const match = line.match(/^(\d+)\.\s*(.+)$/);
                return match && parseInt(match[1]) === (translated.length + 1);
            });

            if (matchedLine) {
                const match = matchedLine.match(/^(\d+)\.\s*(.+)$/);
                translated.push({
                    start: originalLine.start,
                    duration: originalLine.duration,
                    text: match![2],
                    lang: 'zh'
                });
            } else {
                // 如果没有匹配到，使用整行作为翻译
                const candidateLine = lines[translated.length];
                translated.push({
                    start: originalLine.start,
                    duration: originalLine.duration,
                    text: candidateLine ? candidateLine.replace(/^\d+\.\s*/, '') : originalLine.text,
                    lang: 'zh'
                });
            }
        }

        return translated;
    }

    /**
     * 使用 AI 对字幕进行智能分句和标点，并保留时间戳
     */
    async segmentAndPunctuate(lines: TranscriptLine[]): Promise<TranscriptLine[]> {
        console.log('[LinguaSync] Starting AI segmentation and punctuation...');
        
        // Process in batches to fit in context window
        // A batch of 20 lines is reasonable for stability
        const batchSize = 20;
        const resultLines: TranscriptLine[] = [];
        
        for (let i = 0; i < lines.length; i += batchSize) {
            const batch = lines.slice(i, i + batchSize);
            console.log(`[LinguaSync] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(lines.length / batchSize)}...`);
            
            const batchResult = await this.processSegmentationBatch(batch);
            resultLines.push(...batchResult);
            
            // Avoid rate limits
            if (i + batchSize < lines.length) {
                await this.sleep(500);
            }
        }
        
        console.log('[LinguaSync] ✅ AI segmentation completed!');
        return resultLines;
    }

    private async processSegmentationBatch(lines: TranscriptLine[]): Promise<TranscriptLine[]> {
        const input = lines.map((line, index) => `${index + 1}. ${line.text}`).join('\n');
        
        const prompt = `You are a subtitle editor. Your task is to merge split subtitle lines into complete, grammatically correct sentences with proper punctuation.

Rules:
1. Merge lines to form full sentences.
2. Add proper punctuation and capitalization.
3. Do NOT change or skip any words.
4. Output strictly in this format: "StartID-EndID: Sentence"
   - StartID: The ID of the first line in this sentence.
   - EndID: The ID of the last line in this sentence.
   - If a sentence is just one line, use "ID-ID".
   
Input lines:
${input}

Output format example:
1-2: Hello, my name is John.
3-3: How are you?
4-6: I am doing great today, thanks for asking.

Output:`;

        try {
            const response = await this.callAI(prompt);
            return this.parseSegmentationResponse(response, lines);
        } catch (error) {
            console.error('[LinguaSync] Segmentation error:', error);
            // Fallback: return original lines
            return lines;
        }
    }

    private parseSegmentationResponse(response: string, originalLines: TranscriptLine[]): TranscriptLine[] {
        const newLines: TranscriptLine[] = [];
        const lines = response.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
            // Parse "StartID-EndID: Text"
            const match = line.match(/^(\d+)-(\d+):\s*(.+)$/);
            if (match) {
                const startIdx = parseInt(match[1]) - 1; // 0-based index
                const endIdx = parseInt(match[2]) - 1;
                const text = match[3].trim();
                
                // Validate indices
                if (startIdx >= 0 && endIdx < originalLines.length && startIdx <= endIdx) {
                    const startLine = originalLines[startIdx];
                    const endLine = originalLines[endIdx];
                    
                    // Calculate combined duration: EndTime of last line - StartTime of first line
                    const duration = (endLine.start + endLine.duration) - startLine.start;
                    
                    newLines.push({
                        start: startLine.start,
                        duration: duration,
                        text: text,
                        lang: startLine.lang
                    });
                }
            }
        }
        
        // Fallback if parsing failed completely (e.g. AI output garbage)
        if (newLines.length === 0 && originalLines.length > 0) {
            // Try to at least return original lines to avoid data loss
            return originalLines;
        }
        
        return newLines;
    }

    /**
     * 智能格式化转录文本：添加标点符号和分段
     * @param lines 转录行
     * @param customPrompt 自定义 prompt 模板（可选），使用 {{text}} 作为文本占位符
     */
    async formatTranscript(lines: TranscriptLine[], customPrompt?: string): Promise<string> {
        console.log('[LinguaSync] Starting AI text formatting (punctuation & paragraphs)...');
        
        // 将所有行合并成一个长文本
        const rawText = lines.map(line => line.text).join(' ');
        
        // 分批处理，每批大约2000字符
        const maxChunkSize = 2000;
        const chunks: string[] = [];
        
        let currentChunk = '';
        const words = rawText.split(' ');
        
        for (const word of words) {
            if ((currentChunk + ' ' + word).length > maxChunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = word;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + word;
            }
        }
        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }
        
        console.log(`[LinguaSync] Formatting ${chunks.length} text chunks...`);
        
        const formattedChunks: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
            console.log(`[LinguaSync] Formatting chunk ${i + 1}/${chunks.length}...`);
            const formatted = await this.formatTextChunk(chunks[i], customPrompt);
            formattedChunks.push(formatted);
            
            // 避免API限流
            if (i < chunks.length - 1) {
                await this.sleep(500);
            }
        }
        
        const result = formattedChunks.join('\n\n');
        console.log('[LinguaSync] ✅ Text formatting completed!');
        return result;
    }

    /**
     * 格式化单个文本块
     * @param text 输入文本
     * @param customPrompt 自定义 prompt 模板（可选）
     */
    private async formatTextChunk(text: string, customPrompt?: string): Promise<string> {
        // Use custom prompt if provided, otherwise use default
        const promptTemplate = customPrompt || `Please format the following transcript text. You MUST follow these rules:
1. ADD PUNCTUATION: Insert periods, commas, question marks, etc. where appropriate.
2. PARAGRAPH BREAKS: Break into short paragraphs (every 2-4 sentences). Use double newlines (\\n\\n) between paragraphs.
3. CAPITALIZATION: Capitalize the first letter of each sentence.
4. NO CONTENT CHANGES: Do NOT change, add, or remove any words. Keep the original wording exactly as is.
5. NO EXPLANATIONS: Output ONLY the formatted text.

Input text:
{{text}}

Formatted text:`;

        // Replace {{text}} placeholder with actual text
        const prompt = promptTemplate.replace(/\{\{text\}\}/g, text);

        try {
            const response = await this.callAI(prompt);
            return response.trim();
        } catch (error) {
            console.error('[LinguaSync] Formatting error:', error);
            // 失败时返回原文
            return text;
        }
    }

    /**
     * 延迟函数
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
