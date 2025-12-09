import { App, Modal, Notice, setIcon } from 'obsidian';
import { QAResult } from './vault-qa';

export class AnswerModal extends Modal {
    private result: QAResult;

    constructor(app: App, result: QAResult) {
        super(app);
        this.result = result;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('learning-assistant-modal');

        // Header
        const header = contentEl.createDiv({ cls: 'modal-header' });
        header.createEl('h2', { text: '🤖 学习助手回答' });

        // Question section
        const questionSection = contentEl.createDiv({ cls: 'qa-section' });
        questionSection.createEl('h3', { text: '📝 您的问题' });
        const questionBox = questionSection.createDiv({ cls: 'qa-question' });
        questionBox.createEl('p', { text: this.result.query });

        // Answer section
        const answerSection = contentEl.createDiv({ cls: 'qa-section' });
        answerSection.createEl('h3', { text: '💡 回答' });
        const answerBox = answerSection.createDiv({ cls: 'qa-answer' });
        
        // Split answer into paragraphs
        const paragraphs = this.result.answer.split('\n\n');
        for (const para of paragraphs) {
            if (para.trim()) {
                answerBox.createEl('p', { text: para.trim() });
            }
        }

        // Sources section
        if (this.result.sources.length > 0) {
            const sourcesSection = contentEl.createDiv({ cls: 'qa-section' });
            sourcesSection.createEl('h3', { text: '📚 来源笔记' });
            
            const sourcesList = sourcesSection.createDiv({ cls: 'qa-sources' });
            for (const source of this.result.sources) {
                const sourceItem = sourcesList.createDiv({ cls: 'qa-source-item' });
                
                // Source title (clickable)
                const titleEl = sourceItem.createDiv({ cls: 'qa-source-title' });
                const link = titleEl.createEl('a', { 
                    text: source.title,
                    cls: 'qa-source-link'
                });
                link.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await this.openNote(source.path);
                });

                // Source excerpt
                if (source.excerpt) {
                    const excerptEl = sourceItem.createDiv({ cls: 'qa-source-excerpt' });
                    excerptEl.createEl('p', { text: source.excerpt });
                }
            }
        }

        // Action buttons
        const actions = contentEl.createDiv({ cls: 'modal-button-container' });
        
        // Copy answer button
        const copyBtn = actions.createEl('button', { text: '📋 复制回答' });
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(this.result.answer);
            new Notice('✅ 已复制到剪贴板');
        });

        // Close button
        const closeBtn = actions.createEl('button', { text: '关闭', cls: 'mod-cta' });
        closeBtn.addEventListener('click', () => {
            this.close();
        });

        // Add styles
        this.injectStyles();
    }

    private async openNote(path: string) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file) {
            await this.app.workspace.getLeaf().openFile(file as any);
            this.close();
        } else {
            new Notice(`无法打开文件: ${path}`);
        }
    }

    private injectStyles() {
        if (document.getElementById('learning-assistant-modal-styles')) return;

        const styleEl = document.createElement('style');
        styleEl.id = 'learning-assistant-modal-styles';
        styleEl.textContent = `
            .learning-assistant-modal {
                padding: 20px;
            }

            .learning-assistant-modal .modal-header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px solid var(--background-modifier-border);
                padding-bottom: 10px;
            }

            .learning-assistant-modal .modal-header h2 {
                margin: 0;
                color: var(--text-normal);
            }

            .learning-assistant-modal .qa-section {
                margin-bottom: 25px;
            }

            .learning-assistant-modal .qa-section h3 {
                color: var(--text-accent);
                font-size: 1.1em;
                margin-bottom: 10px;
            }

            .learning-assistant-modal .qa-question {
                background: var(--background-secondary);
                padding: 15px;
                border-radius: 8px;
                border-left: 4px solid var(--interactive-accent);
            }

            .learning-assistant-modal .qa-question p {
                margin: 0;
                font-weight: 500;
            }

            .learning-assistant-modal .qa-answer {
                background: var(--background-secondary);
                padding: 15px;
                border-radius: 8px;
                line-height: 1.6;
            }

            .learning-assistant-modal .qa-answer p {
                margin: 0 0 10px 0;
            }

            .learning-assistant-modal .qa-answer p:last-child {
                margin-bottom: 0;
            }

            .learning-assistant-modal .qa-sources {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .learning-assistant-modal .qa-source-item {
                background: var(--background-secondary);
                padding: 12px;
                border-radius: 6px;
                border-left: 3px solid var(--text-muted);
            }

            .learning-assistant-modal .qa-source-title {
                margin-bottom: 8px;
            }

            .learning-assistant-modal .qa-source-link {
                color: var(--link-color);
                text-decoration: none;
                font-weight: 500;
                cursor: pointer;
            }

            .learning-assistant-modal .qa-source-link:hover {
                text-decoration: underline;
                color: var(--link-color-hover);
            }

            .learning-assistant-modal .qa-source-excerpt {
                color: var(--text-muted);
                font-size: 0.9em;
                font-style: italic;
            }

            .learning-assistant-modal .qa-source-excerpt p {
                margin: 0;
            }

            .learning-assistant-modal .modal-button-container {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid var(--background-modifier-border);
            }

            .learning-assistant-modal button {
                padding: 8px 16px;
                border-radius: 6px;
                border: none;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }

            .learning-assistant-modal button:hover {
                opacity: 0.8;
            }
        `;

        document.head.appendChild(styleEl);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class QuestionInputModal extends Modal {
    private onSubmit: (question: string) => void;
    private inputEl: HTMLTextAreaElement;

    constructor(app: App, onSubmit: (question: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '🤖 向学习助手提问' });
        contentEl.createEl('p', { 
            text: '基于您的学习笔记回答问题',
            cls: 'setting-item-description'
        });

        // Input area
        this.inputEl = contentEl.createEl('textarea', {
            placeholder: '例如：\n- 我学过哪些关于食物的单词？\n- go to 和 go shopping 的区别？\n- 那个讲购物的视频叫什么？'
        });
        this.inputEl.rows = 5;
        this.inputEl.style.width = '100%';
        this.inputEl.style.marginBottom = '15px';
        this.inputEl.style.padding = '10px';
        this.inputEl.style.borderRadius = '6px';

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        
        const submitBtn = buttonContainer.createEl('button', { text: '提问', cls: 'mod-cta' });
        submitBtn.addEventListener('click', () => {
            const question = this.inputEl.value.trim();
            if (question) {
                this.onSubmit(question);
                this.close();
            } else {
                new Notice('请输入问题');
            }
        });

        const cancelBtn = buttonContainer.createEl('button', { text: '取消' });
        cancelBtn.addEventListener('click', () => {
            this.close();
        });

        // Focus input
        setTimeout(() => this.inputEl.focus(), 100);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
