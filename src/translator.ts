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
     * @param onProgress 进度回调 (currentBatch, totalBatches, percentage)
     */
    async translateTranscript(
        lines: TranscriptLine[], 
        onProgress?: (current: number, total: number, percentage: number) => void
    ): Promise<TranscriptLine[]> {
        console.log('[LinguaSync] Starting AI translation...');
        console.log(`[LinguaSync] Provider: ${this.config.provider}, Lines: ${lines.length}`);

        // 根据不同提供商优化批次大小和延迟
        let batchSize = 25;
        let delayMs = 2000;
        
        // 针对不同 API 提供商的优化策略
        switch (this.config.provider) {
            case 'deepseek':
                batchSize = 30; // DeepSeek 速度快，可以更大批次
                delayMs = 1500; // 更短延迟
                break;
            case 'siliconflow':
                batchSize = 25; // 平衡设置
                delayMs = 2000;
                break;
            case 'gemini':
                batchSize = 20; // Gemini 免费版限流严格
                delayMs = 2500;
                break;
            case 'openai':
                batchSize = 20; // OpenAI 按 token 计费，适中设置
                delayMs = 2000;
                break;
            default:
                batchSize = 25;
                delayMs = 2000;
        }
        
        console.log(`[LinguaSync] Batch config: ${batchSize} lines/batch, ${delayMs}ms delay`);
        
        const translatedLines: TranscriptLine[] = [];
        const totalBatches = Math.ceil(lines.length / batchSize);
        const startTime = Date.now();

        for (let i = 0; i < lines.length; i += batchSize) {
            const batch = lines.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            
            console.log(`[LinguaSync] Translating batch ${batchNum}/${totalBatches} (${batch.length} lines)...`);
            
            const batchStart = Date.now();
            const translatedBatch = await this.translateBatch(batch);
            translatedLines.push(...translatedBatch);
            const batchTime = ((Date.now() - batchStart) / 1000).toFixed(1);
            
            // 显示进度和预计剩余时间
            const batchProgress = (batchNum / totalBatches) * 100;
            const elapsed = (Date.now() - startTime) / 1000;
            const estimatedTotal = (elapsed / batchNum) * totalBatches;
            const remaining = Math.max(0, estimatedTotal - elapsed);
            
            console.log(`[LinguaSync] ✓ Batch ${batchNum} completed in ${batchTime}s | Progress: ${batchProgress.toFixed(0)}% | ETA: ${remaining.toFixed(0)}s`);
            
            // 调用进度回调
            if (onProgress) {
                onProgress(batchNum, totalBatches, batchProgress);
            }
            
            // 避免API限流，使用优化后的延迟
            if (i + batchSize < lines.length) {
                console.log(`[LinguaSync] Waiting ${delayMs / 1000}s before next batch...`);
                await this.sleep(delayMs);
            }
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[LinguaSync] ✅ Translation completed! Total time: ${totalTime}s (${lines.length} lines)`);
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
     * 调用AI API (with retry logic for rate limits)
     * Exported as public to allow external usage (e.g., custom commands)
     */
    async callAI(prompt: string, retries: number = 5): Promise<string> {
        const { provider, apiKey, model, baseUrl } = this.config;

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                if (provider === 'openai' || provider === 'deepseek' || provider === 'siliconflow' || provider === 'videocaptioner' || provider === 'custom') {
                    return await this.callOpenAICompatible(prompt, apiKey, model, baseUrl);
                } else if (provider === 'gemini') {
                    return await this.callGemini(prompt, apiKey, model);
                }

                throw new Error(`Unsupported provider: ${provider}`);
            } catch (error) {
                const errorMsg = error.message || error.toString();
                
                // Check if it's a rate limit error (429)
                if (errorMsg.includes('429') && attempt < retries - 1) {
                    // Exponential backoff: 3s, 6s, 12s, 24s, 30s
                    let waitTime = Math.pow(2, attempt) * 3000; 
                    if (waitTime > 30000) waitTime = 30000; // Max 30s wait
                    
                    console.warn(`[LinguaSync] Rate limit hit (429), retrying in ${waitTime}ms... (attempt ${attempt + 1}/${retries})`);
                    await this.sleep(waitTime);
                    continue; // Retry
                }
                
                // If not a rate limit error or final attempt, throw
                throw error;
            }
        }

        throw new Error('API call failed after retries');
    }

    /**
     * 调用AI API with streaming (流式响应)
     * @param prompt The prompt to send
     * @param onChunk Callback for each chunk of response
     */
    async callAIStream(prompt: string, onChunk: (chunk: string) => void): Promise<string> {
        const { provider, apiKey, model, baseUrl } = this.config;

        if (provider === 'openai' || provider === 'deepseek' || provider === 'siliconflow' || provider === 'videocaptioner' || provider === 'custom') {
            return await this.callOpenAICompatibleStream(prompt, apiKey, model, baseUrl, onChunk);
        } else if (provider === 'gemini') {
            // Gemini doesn't support streaming in the same way, fallback to non-streaming
            const response = await this.callGemini(prompt, apiKey, model);
            onChunk(response);
            return response;
        }

        throw new Error(`Unsupported provider: ${provider}`);
    }

    /**
     * 调用OpenAI兼容的API with streaming
     */
    private async callOpenAICompatibleStream(
        prompt: string,
        apiKey: string,
        model?: string,
        baseUrl?: string,
        onChunk?: (chunk: string) => void
    ): Promise<string> {
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

        const requestBody = {
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
            max_tokens: 4000,
            stream: true  // Enable streaming
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey.trim()}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error (${response.status}): ${errorText}`);
            }

            if (!response.body) {
                throw new Error('Response body is null');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                fullResponse += content;
                                if (onChunk) {
                                    onChunk(content);
                                }
                            }
                        } catch (e) {
                            // Skip invalid JSON
                            console.warn('Failed to parse streaming chunk:', e);
                        }
                    }
                }
            }

            return fullResponse;

        } catch (error) {
            console.error('[LinguaSync] Streaming API call failed:', error);
            throw error;
        }
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

        const requestBody = {
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
        };

        // Log request details for debugging
        console.log(`[LinguaSync] API Request:`, {
            url,
            provider: this.config.provider,
            model: requestBody.model,
            promptLength: prompt.length
        });

        try {
            const response = await requestUrl({
                url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey.trim()}`
                },
                body: JSON.stringify(requestBody)
            });

            const data = response.json;
            
            // Validate response structure
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                console.error('[LinguaSync] Invalid API response structure:', data);
                throw new Error('Invalid API response structure');
            }
            
            return data.choices[0].message.content.trim();
        } catch (error) {
            // Enhanced error logging
            console.error('[LinguaSync] API Request failed:');
            console.error('  URL:', url);
            console.error('  Provider:', this.config.provider);
            console.error('  Model:', requestBody.model);
            console.error('  Error:', error);
            
            // Extract more details if available
            if (error.status) {
                console.error('  Status:', error.status);
            }
            if (error.message) {
                console.error('  Message:', error.message);
            }
            
            throw error;
        }
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
            
            // Avoid rate limits - 增加延迟到3.5秒
            if (i + batchSize < lines.length) {
                console.log('[LinguaSync] Waiting 3.5s before next batch to avoid rate limit...');
                await this.sleep(3500);
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
        
        // Log AI response for debugging
        console.log('[LinguaSync] AI segmentation response (first 500 chars):', response.substring(0, 500));
        console.log(`[LinguaSync] Parsing ${lines.length} response lines for ${originalLines.length} original lines`);
        
        // Track which original lines have been processed
        const processedIndices = new Set<number>();
        
        for (const line of lines) {
            // Parse "StartID-EndID: Text" with flexible whitespace
            const match = line.match(/^\s*(\d+)\s*-\s*(\d+)\s*:\s*(.+)$/);
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
                    
                    // Mark these indices as processed
                    for (let i = startIdx; i <= endIdx; i++) {
                        processedIndices.add(i);
                    }
                } else {
                    console.warn(`[LinguaSync] Invalid indices in AI output: ${startIdx}-${endIdx} (max: ${originalLines.length - 1})`);
                }
            } else if (line.trim() && !line.match(/^(Output|Input|Rules|Example|Format):/i)) {
                // Log unmatched lines that don't look like headers
                console.warn(`[LinguaSync] Failed to parse AI output line: "${line.substring(0, 80)}..."`);
            }
        }
        
        // Check for unprocessed lines
        const unprocessedCount = originalLines.length - processedIndices.size;
        if (unprocessedCount > 0) {
            console.warn(`[LinguaSync] ⚠️ ${unprocessedCount}/${originalLines.length} original lines were not processed by AI!`);
            
            // Add unprocessed lines as-is to avoid data loss
            for (let i = 0; i < originalLines.length; i++) {
                if (!processedIndices.has(i)) {
                    console.warn(`[LinguaSync] Adding unprocessed line ${i + 1}: "${originalLines[i].text.substring(0, 50)}..."`);
                    newLines.push(originalLines[i]);
                }
            }
        }
        
        // Fallback if parsing failed completely (e.g. AI output garbage)
        if (newLines.length === 0 && originalLines.length > 0) {
            console.error('[LinguaSync] ❌ AI segmentation parsing completely failed, using original lines');
            return originalLines;
        }
        
        console.log(`[LinguaSync] ✅ Parsed ${newLines.length} segments from ${originalLines.length} original lines`);
        return newLines;
    }

    /**
     * Clean subtitle text: remove [Music], [Applause], etc.
     */
    private cleanText(text: string): string {
        if (!text) return '';
        
        return text
            .replace(/\[Music\]/gi, '')
            .replace(/\[Applause\]/gi, '')
            .replace(/\[Laughter\]/gi, '')
            .replace(/\[Background Music\]/gi, '')
            .replace(/\[Sound\]/gi, '')
            .replace(/\[Noise\]/gi, '')
            .replace(/\[.*?\]/g, '')
            .replace(/\\n/g, ' ')      // Replace literal \n with space
            .replace(/\s+/g, ' ')       // Collapse multiple spaces
            .trim();
    }

    /**
     * 智能格式化转录文本：添加标点符号和分段
     * @param lines 转录行
     * @param customPrompt 自定义 prompt 模板（可选），使用 {{text}} 作为文本占位符
     */
    async formatTranscript(lines: TranscriptLine[], customPrompt?: string): Promise<string> {
        console.log('[LinguaSync] Starting AI text formatting (punctuation & paragraphs)...');
        
        // 将所有行合并成一个长文本，并清理标记
        const rawText = lines.map(line => this.cleanText(line.text)).filter(t => t.length > 0).join(' ');
        
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
            
            // 避免API限流 - 增加延迟到3.5秒
            if (i < chunks.length - 1) {
                console.log('[LinguaSync] Waiting 3.5s before next chunk to avoid rate limit...');
                await this.sleep(3500);
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
