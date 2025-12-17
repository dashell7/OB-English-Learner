import { App, TFile } from 'obsidian';
import { requestUrl } from 'obsidian';

export interface VaultQAConfig {
    provider: 'openai' | 'deepseek' | 'gemini' | 'siliconflow' | 'custom';
    apiKey: string;
    model?: string;
    baseUrl?: string;
}

export interface QASource {
    path: string;
    title: string;
    excerpt: string;
    relevance: number;
}

export interface QAResult {
    answer: string;
    sources: QASource[];
    query: string;
}

export class VaultQA {
    constructor(
        private app: App,
        private config: VaultQAConfig
    ) {}

    /**
     * 基于笔记内容回答问题（使用简单的关键词搜索）
     */
    async askVault(question: string, options?: {
        maxSources?: number;
        folders?: string[];
        excludeFolders?: string[];
    }): Promise<QAResult> {
        console.log('[VaultQA] Processing question:', question);
        
        // 1. 搜索相关笔记
        const maxSources = options?.maxSources || 10;
        const relevantNotes = await this.searchNotes(question, {
            ...options,
            maxSources
        });

        console.log(`[VaultQA] Found ${relevantNotes.length} relevant notes`);

        if (relevantNotes.length === 0) {
            return {
                answer: '抱歉，在您的笔记中没有找到与这个问题相关的内容。',
                sources: [],
                query: question
            };
        }

        // 2. 构建上下文
        const context = this.buildContext(relevantNotes);

        // 3. 调用 AI 生成答案
        const answer = await this.generateAnswer(question, context);

        return {
            answer,
            sources: relevantNotes,
            query: question
        };
    }

    /**
     * 搜索相关笔记（简单的关键词匹配）
     */
    private async searchNotes(query: string, options?: {
        maxSources?: number;
        folders?: string[];
        excludeFolders?: string[];
    }): Promise<QASource[]> {
        // 提取关键词
        const keywords = this.extractKeywords(query);
        console.log('[VaultQA] Search keywords:', keywords);

        const files = this.app.vault.getMarkdownFiles();
        const results: Array<{
            file: TFile;
            content: string;
            score: number;
        }> = [];

        for (const file of files) {
            // 文件夹过滤
            if (options?.folders && options.folders.length > 0) {
                const inFolder = options.folders.some(folder => 
                    file.path.startsWith(folder)
                );
                if (!inFolder) continue;
            }

            // 排除文件夹
            if (options?.excludeFolders && options.excludeFolders.length > 0) {
                const inExcluded = options.excludeFolders.some(folder =>
                    file.path.startsWith(folder)
                );
                if (inExcluded) continue;
            }

            try {
                const content = await this.app.vault.cachedRead(file);
                const score = this.calculateRelevance(content, keywords);

                if (score > 0) {
                    results.push({ file, content, score });
                }
            } catch (error) {
                console.warn(`[VaultQA] Failed to read file: ${file.path}`, error);
            }
        }

        // 按相关度排序
        results.sort((a, b) => b.score - a.score);

        // 取前 N 个
        const topResults = results.slice(0, options?.maxSources || 10);

        return topResults.map(r => ({
            path: r.file.path,
            title: r.file.basename,
            excerpt: this.extractRelevantExcerpt(r.content, keywords),
            relevance: r.score
        }));
    }

    /**
     * 提取关键词
     */
    private extractKeywords(query: string): string[] {
        // 转小写
        const text = query.toLowerCase();
        
        // 移除标点符号
        const cleaned = text.replace(/[.,!?;:"""''()[\]{}]/g, ' ');
        
        // 分词
        const words = cleaned.split(/\s+/).filter(w => w.length > 0);
        
        // 过滤停用词
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'can', 'what', 'which', 'who', 'when',
            'where', 'why', 'how', 'this', 'that', 'these', 'those',
            '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都',
            '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会',
            '着', '没有', '看', '好', '自己', '这', '那', '什么', '哪', '怎么'
        ]);
        
        return words.filter(w => !stopWords.has(w) && w.length > 1);
    }

    /**
     * 计算文本与关键词的相关度
     */
    private calculateRelevance(content: string, keywords: string[]): number {
        const lowerContent = content.toLowerCase();
        let score = 0;

        for (const keyword of keywords) {
            // 完整匹配得分更高
            const exactMatches = (lowerContent.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
            score += exactMatches * 3;

            // 部分匹配也计分
            const partialMatches = (lowerContent.match(new RegExp(keyword, 'g')) || []).length;
            score += partialMatches;
        }

        return score;
    }

    /**
     * 提取相关片段
     */
    private extractRelevantExcerpt(content: string, keywords: string[]): string {
        const lines = content.split('\n');
        const relevantLines: string[] = [];

        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            const hasKeyword = keywords.some(kw => lowerLine.includes(kw));
            
            if (hasKeyword) {
                relevantLines.push(line.trim());
                if (relevantLines.length >= 3) break; // 最多 3 行
            }
        }

        if (relevantLines.length === 0) {
            // 如果没有找到，返回前几行
            return lines.slice(0, 3).join(' ').substring(0, 200) + '...';
        }

        return relevantLines.join(' ').substring(0, 300) + '...';
    }

    /**
     * 构建上下文
     */
    private buildContext(sources: QASource[]): string {
        const contextParts: string[] = [];

        for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            contextParts.push(`[来源 ${i + 1}: ${source.title}]`);
            contextParts.push(source.excerpt);
            contextParts.push('');
        }

        return contextParts.join('\n');
    }

    /**
     * 调用 AI 生成答案
     */
    private async generateAnswer(question: string, context: string): Promise<string> {
        const prompt = `你是一个英语学习助手。基于用户的学习笔记回答问题。

用户笔记内容：
${context}

用户问题：${question}

请基于上述笔记内容回答问题。如果笔记中没有相关信息，请诚实地说明。回答要简洁、准确，并指出信息来源。`;

        try {
            const response = await this.callAI(prompt);
            return response;
        } catch (error) {
            console.error('[VaultQA] AI call failed:', error);
            throw new Error(`AI 调用失败: ${error.message}`);
        }
    }

    /**
     * 调用 AI API
     */
    private async callAI(prompt: string): Promise<string> {
        const url = this.getApiUrl();
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };

        const body = {
            model: this.config.model || this.getDefaultModel(),
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 1000
        };

        const response = await requestUrl({
            url,
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (response.status !== 200) {
            throw new Error(`API 错误: ${response.status}`);
        }

        const data = response.json;
        return data.choices[0].message.content.trim();
    }

    /**
     * 获取 API URL
     */
    private getApiUrl(): string {
        if (this.config.baseUrl) {
            return this.config.baseUrl;
        }

        switch (this.config.provider) {
            case 'openai':
                return 'https://api.openai.com/v1/chat/completions';
            case 'deepseek':
                return 'https://api.deepseek.com/v1/chat/completions';
            case 'gemini':
                return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
            case 'siliconflow':
                return 'https://api.siliconflow.cn/v1/chat/completions';
            default:
                return this.config.baseUrl || '';
        }
    }

    /**
     * 获取默认模型
     */
    private getDefaultModel(): string {
        switch (this.config.provider) {
            case 'openai':
                return 'gpt-4o-mini';
            case 'deepseek':
                return 'deepseek-chat';
            case 'gemini':
                return 'gemini-2.0-flash';
            case 'siliconflow':
                return 'deepseek-ai/DeepSeek-V3';
            default:
                return 'gpt-4o-mini';
        }
    }
}
