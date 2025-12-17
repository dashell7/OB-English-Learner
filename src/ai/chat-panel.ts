import { App, Modal, Notice, TextAreaComponent, MarkdownView, requestUrl } from 'obsidian';
import { VaultQAConfig } from './vault-qa';

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export class AIChatPanel extends Modal {
    private config: VaultQAConfig;
    private messages: ChatMessage[] = [];
    private inputEl: TextAreaComponent;
    private chatContainer: HTMLElement;
    private isProcessing: boolean = false;

    constructor(app: App, config: VaultQAConfig) {
        super(app);
        this.config = config;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('ai-chat-panel');

        // Header
        const header = contentEl.createDiv({ cls: 'chat-header' });
        header.createEl('h2', { text: '💬 AI Assistant' });
        const subtitle = header.createDiv({ cls: 'chat-subtitle' });
        subtitle.createEl('span', { text: 'Chat with AI about your learning' });

        // Quick actions
        const quickActions = contentEl.createDiv({ cls: 'quick-actions' });
        this.createQuickAction(quickActions, '📝 翻译', 'Translate selected text to Chinese');
        this.createQuickAction(quickActions, '📖 解释', 'Explain this word/phrase');
        this.createQuickAction(quickActions, '✍️ 改写', 'Rewrite to be more natural');
        this.createQuickAction(quickActions, '🎯 总结', 'Summarize the main points');

        // Chat messages container
        this.chatContainer = contentEl.createDiv({ cls: 'chat-messages' });

        // Welcome message
        this.addAssistantMessage('你好！我是 AI 学习助手。我可以帮你：\n\n📝 翻译英文\n📖 解释单词和短语\n✍️ 改写句子\n🎯 总结内容\n\n试试点击上方的快捷按钮，或直接输入问题！');

        // Input area
        const inputContainer = contentEl.createDiv({ cls: 'chat-input-container' });
        
        this.inputEl = new TextAreaComponent(inputContainer);
        this.inputEl.inputEl.addClass('chat-input');
        this.inputEl.setPlaceholder('输入消息... (Shift+Enter 换行, Enter 发送)');
        
        // Handle Enter key
        this.inputEl.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Send button
        const sendBtn = inputContainer.createEl('button', { text: '发送', cls: 'chat-send-btn' });
        sendBtn.addEventListener('click', () => this.sendMessage());

        // Clear button
        const clearBtn = contentEl.createDiv({ cls: 'chat-clear-btn' });
        clearBtn.createEl('span', { text: '🗑️ 清空对话' });
        clearBtn.addEventListener('click', () => this.clearChat());

        // Inject styles
        this.injectStyles();
    }

    private createQuickAction(container: HTMLElement, label: string, prompt: string) {
        const btn = container.createEl('button', { text: label, cls: 'quick-action-btn' });
        btn.addEventListener('click', async () => {
            // Get selected text from active editor
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view && view.editor) {
                const selection = view.editor.getSelection();
                if (selection) {
                    const message = `${prompt}:\n\n${selection}`;
                    await this.sendCustomMessage(message);
                } else {
                    new Notice('请先选择文本');
                }
            } else {
                new Notice('请在编辑器中选择文本');
            }
        });
    }

    private async sendMessage() {
        const content = this.inputEl.getValue().trim();
        if (!content || this.isProcessing) return;

        this.inputEl.setValue('');
        this.addUserMessage(content);

        this.isProcessing = true;
        try {
            const response = await this.callAI(content);
            this.addAssistantMessage(response);
        } catch (error) {
            this.addAssistantMessage(`❌ 错误: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    private async sendCustomMessage(content: string) {
        if (this.isProcessing) return;

        this.addUserMessage(content);

        this.isProcessing = true;
        try {
            const response = await this.callAI(content);
            this.addAssistantMessage(response);
        } catch (error) {
            this.addAssistantMessage(`❌ 错误: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    private addUserMessage(content: string) {
        const message: ChatMessage = {
            role: 'user',
            content,
            timestamp: Date.now()
        };
        this.messages.push(message);
        this.renderMessage(message);
        this.scrollToBottom();
    }

    private addAssistantMessage(content: string) {
        const message: ChatMessage = {
            role: 'assistant',
            content,
            timestamp: Date.now()
        };
        this.messages.push(message);
        this.renderMessage(message);
        this.scrollToBottom();
    }

    private renderMessage(message: ChatMessage) {
        const messageEl = this.chatContainer.createDiv({ cls: `chat-message ${message.role}` });
        
        const avatar = messageEl.createDiv({ cls: 'message-avatar' });
        avatar.createEl('span', { text: message.role === 'user' ? '👤' : '🤖' });

        const content = messageEl.createDiv({ cls: 'message-content' });
        
        // Split into paragraphs
        const paragraphs = message.content.split('\n\n');
        for (const para of paragraphs) {
            if (para.trim()) {
                // Handle bullet points
                if (para.trim().startsWith('•') || para.trim().startsWith('-')) {
                    const lines = para.split('\n');
                    const list = content.createEl('ul');
                    for (const line of lines) {
                        const cleaned = line.replace(/^[•\-]\s*/, '').trim();
                        if (cleaned) {
                            list.createEl('li', { text: cleaned });
                        }
                    }
                } else {
                    content.createEl('p', { text: para.trim() });
                }
            }
        }

        const time = messageEl.createDiv({ cls: 'message-time' });
        time.createEl('span', { text: this.formatTime(message.timestamp) });
    }

    private formatTime(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }

    private scrollToBottom() {
        setTimeout(() => {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }, 100);
    }

    private clearChat() {
        this.messages = [];
        this.chatContainer.empty();
        this.addAssistantMessage('对话已清空。有什么可以帮你的吗？');
    }

    private async callAI(userMessage: string): Promise<string> {
        // Build conversation context
        const messages = [
            {
                role: 'system',
                content: '你是一个英语学习助手。帮助用户翻译、解释、改写英文内容。回答要简洁、准确、实用。'
            },
            // Include last 5 messages for context
            ...this.messages.slice(-5).map(m => ({
                role: m.role,
                content: m.content
            })),
            {
                role: 'user',
                content: userMessage
            }
        ];

        const url = this.getApiUrl();
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };

        const body = {
            model: this.config.model || this.getDefaultModel(),
            messages: messages,
            temperature: 0.7,
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

    private injectStyles() {
        if (document.getElementById('ai-chat-panel-styles')) return;

        const styleEl = document.createElement('style');
        styleEl.id = 'ai-chat-panel-styles';
        styleEl.textContent = `
            .ai-chat-panel {
                padding: 0;
                width: 600px;
                max-width: 90vw;
                height: 70vh;
                display: flex;
                flex-direction: column;
            }

            .chat-header {
                padding: 20px;
                border-bottom: 2px solid var(--background-modifier-border);
                background: var(--background-secondary);
            }

            .chat-header h2 {
                margin: 0 0 5px 0;
                color: var(--text-normal);
            }

            .chat-subtitle {
                color: var(--text-muted);
                font-size: 0.9em;
            }

            .quick-actions {
                display: flex;
                gap: 8px;
                padding: 15px 20px;
                border-bottom: 1px solid var(--background-modifier-border);
                flex-wrap: wrap;
            }

            .quick-action-btn {
                padding: 6px 12px;
                border-radius: 6px;
                border: 1px solid var(--background-modifier-border);
                background: var(--background-primary);
                color: var(--text-normal);
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
            }

            .quick-action-btn:hover {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border-color: var(--interactive-accent);
            }

            .chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 15px;
            }

            .chat-message {
                display: flex;
                gap: 10px;
                animation: slideIn 0.3s ease;
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .message-avatar {
                font-size: 24px;
                flex-shrink: 0;
            }

            .message-content {
                flex: 1;
                background: var(--background-secondary);
                padding: 12px 15px;
                border-radius: 12px;
                line-height: 1.6;
            }

            .chat-message.user .message-content {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
            }

            .message-content p {
                margin: 0 0 8px 0;
            }

            .message-content p:last-child {
                margin-bottom: 0;
            }

            .message-content ul {
                margin: 8px 0;
                padding-left: 20px;
            }

            .message-content li {
                margin: 4px 0;
            }

            .message-time {
                font-size: 0.75em;
                color: var(--text-muted);
                text-align: right;
                padding: 0 35px 0 0;
            }

            .chat-input-container {
                display: flex;
                gap: 10px;
                padding: 15px 20px;
                border-top: 2px solid var(--background-modifier-border);
                background: var(--background-secondary);
            }

            .chat-input {
                flex: 1;
                min-height: 60px;
                max-height: 120px;
                padding: 10px;
                border-radius: 8px;
                border: 1px solid var(--background-modifier-border);
                resize: vertical;
                font-family: var(--font-interface);
            }

            .chat-send-btn {
                padding: 10px 20px;
                border-radius: 8px;
                border: none;
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                cursor: pointer;
                font-weight: 500;
                transition: opacity 0.2s;
            }

            .chat-send-btn:hover {
                opacity: 0.8;
            }

            .chat-clear-btn {
                text-align: center;
                padding: 10px;
                color: var(--text-muted);
                cursor: pointer;
                font-size: 0.9em;
                transition: color 0.2s;
            }

            .chat-clear-btn:hover {
                color: var(--text-error);
            }
        `;

        document.head.appendChild(styleEl);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
