import { App } from 'obsidian';
import { VaultQA, VaultQAConfig, QAResult } from './vault-qa';

export type LearningScenario = 'vocabulary' | 'grammar' | 'review' | 'video' | 'general';

export interface LearningAssistantOptions {
    defaultFolders?: string[];
    excludeFolders?: string[];
    maxSources?: number;
}

export class LearningAssistant {
    private vaultQA: VaultQA;
    private options: LearningAssistantOptions;

    constructor(
        private app: App,
        config: VaultQAConfig,
        options?: LearningAssistantOptions
    ) {
        this.vaultQA = new VaultQA(app, config);
        this.options = {
            defaultFolders: options?.defaultFolders || ['01-Videos', '02-Subtitles'],
            excludeFolders: options?.excludeFolders || ['03-Recordings', '.obsidian'],
            maxSources: options?.maxSources || 10
        };
    }

    /**
     * 智能问答（自动检测场景）
     */
    async ask(question: string): Promise<QAResult> {
        console.log('[LearningAssistant] Processing question:', question);
        
        const scenario = this.detectScenario(question);
        console.log('[LearningAssistant] Detected scenario:', scenario);

        switch (scenario) {
            case 'vocabulary':
                return await this.handleVocabularyQuestion(question);
            
            case 'grammar':
                return await this.handleGrammarQuestion(question);
            
            case 'review':
                return await this.handleReviewQuestion(question);
            
            case 'video':
                return await this.handleVideoQuestion(question);
            
            default:
                return await this.handleGeneralQuestion(question);
        }
    }

    /**
     * 检测问题场景
     */
    private detectScenario(question: string): LearningScenario {
        const q = question.toLowerCase();

        // 词汇相关
        const vocabKeywords = ['单词', '词汇', 'word', 'vocabulary', '怎么说', '英文', '翻译'];
        if (vocabKeywords.some(kw => q.includes(kw))) {
            return 'vocabulary';
        }

        // 语法相关
        const grammarKeywords = ['语法', 'grammar', '用法', '区别', '时态', 'tense'];
        if (grammarKeywords.some(kw => q.includes(kw))) {
            return 'grammar';
        }

        // 复习相关
        const reviewKeywords = ['学过', '复习', 'review', '记得', '之前'];
        if (reviewKeywords.some(kw => q.includes(kw))) {
            return 'review';
        }

        // 视频相关
        const videoKeywords = ['视频', 'video', '那个', '哪个'];
        if (videoKeywords.some(kw => q.includes(kw))) {
            return 'video';
        }

        return 'general';
    }

    /**
     * 处理词汇问题
     */
    private async handleVocabularyQuestion(question: string): Promise<QAResult> {
        return await this.vaultQA.askVault(question, {
            folders: this.options.defaultFolders,
            excludeFolders: this.options.excludeFolders,
            maxSources: 8
        });
    }

    /**
     * 处理语法问题
     */
    private async handleGrammarQuestion(question: string): Promise<QAResult> {
        return await this.vaultQA.askVault(question, {
            folders: this.options.defaultFolders,
            excludeFolders: this.options.excludeFolders,
            maxSources: 10
        });
    }

    /**
     * 处理复习问题
     */
    private async handleReviewQuestion(question: string): Promise<QAResult> {
        // 复习问题通常需要更多来源
        return await this.vaultQA.askVault(question, {
            folders: this.options.defaultFolders,
            excludeFolders: this.options.excludeFolders,
            maxSources: 15
        });
    }

    /**
     * 处理视频相关问题
     */
    private async handleVideoQuestion(question: string): Promise<QAResult> {
        return await this.vaultQA.askVault(question, {
            folders: ['01-Videos'],  // 只搜索视频笔记
            excludeFolders: this.options.excludeFolders,
            maxSources: 5
        });
    }

    /**
     * 处理通用问题
     */
    private async handleGeneralQuestion(question: string): Promise<QAResult> {
        return await this.vaultQA.askVault(question, {
            folders: this.options.defaultFolders,
            excludeFolders: this.options.excludeFolders,
            maxSources: this.options.maxSources
        });
    }

    /**
     * 更新配置
     */
    updateOptions(options: Partial<LearningAssistantOptions>): void {
        this.options = {
            ...this.options,
            ...options
        };
    }
}
