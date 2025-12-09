import { App, Modal, Notice } from 'obsidian';
import { LinguaSyncSettings } from '../types';

/**
 * Custom Command AI Modal - 100% matches Copilot's UI
 * Displays AI-generated response with streaming support and follow-up capability
 */
export class CustomCommandAIModal extends Modal {
	commandTitle: string;
	promptContent: string;
	selectedText: string;
	settings: LinguaSyncSettings;
	editor: any;
	aiResponse: string = '';
	conversationHistory: Array<{ role: string; content: string }> = [];
	isGenerating: boolean = false;

	// UI Elements
	responseTextarea: HTMLTextAreaElement | null = null;
	followupTextarea: HTMLTextAreaElement | null = null;
	followupContainer: HTMLDivElement | null = null;

	constructor(
		app: App,
		commandTitle: string,
		promptContent: string,
		selectedText: string,
		settings: LinguaSyncSettings,
		editor: any
	) {
		super(app);
		this.commandTitle = commandTitle;
		this.promptContent = promptContent;
		this.selectedText = selectedText;
		this.settings = settings;
		this.editor = editor;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('custom-command-ai-modal');

		// Title
		const titleEl = contentEl.createDiv({ cls: 'modal-title' });
		titleEl.createSpan({ text: `🎯 ${this.commandTitle}` });

		// Selected Text Section  
		if (this.selectedText && this.selectedText.trim()) {
			const selectedSection = contentEl.createDiv({ cls: 'selected-text-section' });
			selectedSection.createDiv({ text: '📄 Selected Text / 选中的文本', cls: 'section-label' });
			
			const selectedTextarea = selectedSection.createEl('textarea', { cls: 'selected-textarea' });
			selectedTextarea.value = this.selectedText;
			selectedTextarea.disabled = true;
			selectedTextarea.style.maxHeight = '100px';
		}

		// AI Response Section
		const responseSection = contentEl.createDiv({ cls: 'response-section' });
		responseSection.createDiv({ text: '🤖 AI Response / AI 响应', cls: 'section-label' });
		
		this.responseTextarea = responseSection.createEl('textarea', { cls: 'response-textarea' });
		this.responseTextarea.value = 'loading...';
		this.responseTextarea.disabled = true;
		this.responseTextarea.style.minHeight = '300px';

		// Model Info
		const modelInfo = responseSection.createDiv({ cls: 'model-info' });
		modelInfo.textContent = `🤖 ${this.settings.aiProvider.toUpperCase()} - ${this.settings.aiModel}`;

		// Action Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
		
		const leftButtons = buttonContainer.createDiv({ cls: 'left-buttons' });
		const rightButtons = buttonContainer.createDiv({ cls: 'right-buttons' });

		// Insert Button
		const insertBtn = leftButtons.createEl('button', { text: 'Insert / 插入', cls: 'mod-cta' });
		insertBtn.disabled = true;
		insertBtn.style.display = 'none';
		insertBtn.onclick = async () => {
			if (this.aiResponse) {
				this.editor.replaceSelection(this.aiResponse);
				new Notice('✅ Inserted');
				this.close();
			}
		};

		// Replace Button
		const replaceBtn = leftButtons.createEl('button', { text: 'Replace / 替换', cls: 'mod-cta' });
		replaceBtn.disabled = true;
		replaceBtn.style.display = 'none';
		replaceBtn.onclick = async () => {
			if (this.aiResponse) {
				this.editor.replaceSelection(this.aiResponse);
				new Notice('✅ Replaced');
				this.close();
			}
		};

		// Submit Button (for follow-up)
		const submitBtn = leftButtons.createEl('button', { text: 'Submit / 提交', cls: 'mod-cta' });
		submitBtn.disabled = true;
		submitBtn.style.display = 'none';
		submitBtn.onclick = async () => {
			const followupText = this.followupTextarea?.value?.trim();
			if (followupText) {
				await this.generateFollowupResponse(followupText, insertBtn, replaceBtn, copyBtn, submitBtn, stopBtn);
				if (this.followupTextarea) {
					this.followupTextarea.value = '';
				}
			}
		};

		// Stop Button
		const stopBtn = rightButtons.createEl('button', { text: 'Stop / 停止' });
		stopBtn.style.display = 'inline-block';
		stopBtn.onclick = () => {
			// TODO: Implement stop functionality
			new Notice('⏹ Stopped');
		};

		// Copy Button
		const copyBtn = rightButtons.createEl('button', { text: '📋 Copy / 复制' });
		copyBtn.disabled = true;
		copyBtn.onclick = async () => {
			if (this.aiResponse) {
				await navigator.clipboard.writeText(this.aiResponse);
				new Notice('✅ Copied');
			}
		};

		// Follow-up Input Section
		this.followupContainer = contentEl.createDiv({ cls: 'followup-container' });
		this.followupContainer.style.display = 'none';
		
		this.followupContainer.createDiv({ text: '💬 Follow-up / 追问', cls: 'section-label' });
		this.followupTextarea = this.followupContainer.createEl('textarea', { 
			cls: 'followup-textarea',
			attr: { placeholder: 'Enter follow-up instructions...' }
		});
		this.followupTextarea.style.minHeight = '60px';

		// Start AI generation immediately
		this.generateAIResponse(insertBtn, replaceBtn, copyBtn, submitBtn, stopBtn);
	}

	async generateAIResponse(
		insertBtn: HTMLButtonElement,
		replaceBtn: HTMLButtonElement,
		copyBtn: HTMLButtonElement,
		submitBtn: HTMLButtonElement,
		stopBtn: HTMLButtonElement
	) {
		this.isGenerating = true;
		this.aiResponse = '';

		try {
			// Check if AI is configured
			if (!this.settings.aiApiKey || !this.settings.aiApiKey.trim()) {
				throw new Error('AI API Key not configured. Please set it in Settings → AI.');
			}

			// Show Stop button, hide action buttons during generation
			stopBtn.style.display = 'inline-block';
			insertBtn.style.display = 'none';
			replaceBtn.style.display = 'none';
			copyBtn.disabled = true;

			// Import and create AI translator
			const { AITranslator } = await import('../translator');
			const translator = new AITranslator({
				provider: this.settings.aiProvider,
				apiKey: this.settings.aiApiKey,
				model: this.settings.aiModel,
				baseUrl: this.settings.aiBaseUrl
			});

			// Clear textarea and enable it for streaming
			if (this.responseTextarea) {
				this.responseTextarea.value = '';
				this.responseTextarea.disabled = false;
			}

			// Call AI with streaming
			await translator.callAIStream(this.promptContent, (chunk) => {
				// Accumulate response
				this.aiResponse += chunk;
				
				// Update textarea in real-time
				if (this.responseTextarea) {
					this.responseTextarea.value = this.aiResponse;
					// Auto-scroll to bottom
					this.responseTextarea.scrollTop = this.responseTextarea.scrollHeight;
				}
			});
			
			// Trim final response
			this.aiResponse = this.aiResponse.trim();
			
			// Save to conversation history
			this.conversationHistory.push(
				{ role: 'user', content: this.promptContent },
				{ role: 'assistant', content: this.aiResponse }
			);
			
			// Final update
			if (this.responseTextarea) {
				this.responseTextarea.value = this.aiResponse;
			}

			// Hide Stop button, enable action buttons
			stopBtn.style.display = 'none';
			insertBtn.style.display = 'inline-block';
			replaceBtn.style.display = 'inline-block';
			insertBtn.disabled = false;
			replaceBtn.disabled = false;
			copyBtn.disabled = false;
			
			// Show follow-up input and switch to Submit button
			if (this.followupContainer) {
				this.followupContainer.style.display = 'block';
			}
			if (this.followupTextarea) {
				this.followupTextarea.focus();
			}
			// Hide Insert/Replace, show Submit
			insertBtn.style.display = 'none';
			replaceBtn.style.display = 'none';
			submitBtn.style.display = 'inline-block';
			submitBtn.disabled = false;

			this.isGenerating = false;

		} catch (error) {
			console.error('AI generation error:', error);
			
			const errorMessage = `❌ Error generating AI response:\n${error.message}\n\n请检查 AI 配置（Settings → AI）。`;
			
			if (this.responseTextarea) {
				this.responseTextarea.value = errorMessage;
				this.responseTextarea.disabled = false;
			}
			
			// Hide Stop, show action buttons
			stopBtn.style.display = 'none';
			insertBtn.style.display = 'inline-block';
			replaceBtn.style.display = 'inline-block';
			
			new Notice(`❌ ${error.message}`);
			this.isGenerating = false;
		}
	}

	async generateFollowupResponse(
		followupText: string,
		insertBtn: HTMLButtonElement,
		replaceBtn: HTMLButtonElement,
		copyBtn: HTMLButtonElement,
		submitBtn: HTMLButtonElement,
		stopBtn: HTMLButtonElement
	) {
		this.isGenerating = true;
		this.aiResponse = '';

		try {
			// Build conversation history prompt
			const historyPrompt = this.conversationHistory.map(msg =>
				`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
			).join('\n\n') + `\n\nUser: ${followupText}`;

			// Show Stop button
			stopBtn.style.display = 'inline-block';
			submitBtn.disabled = true;
			copyBtn.disabled = true;

			// Import and create AI translator
			const { AITranslator } = await import('../translator');
			const translator = new AITranslator({
				provider: this.settings.aiProvider,
				apiKey: this.settings.aiApiKey,
				model: this.settings.aiModel,
				baseUrl: this.settings.aiBaseUrl
			});

			// Clear textarea
			if (this.responseTextarea) {
				this.responseTextarea.value = '';
			}

			// Call AI with streaming
			await translator.callAIStream(historyPrompt, (chunk) => {
				this.aiResponse += chunk;
				if (this.responseTextarea) {
					this.responseTextarea.value = this.aiResponse;
					this.responseTextarea.scrollTop = this.responseTextarea.scrollHeight;
				}
			});
			
			// Trim and save
			this.aiResponse = this.aiResponse.trim();
			this.conversationHistory.push(
				{ role: 'user', content: followupText },
				{ role: 'assistant', content: this.aiResponse }
			);
			
			// Final update
			if (this.responseTextarea) {
				this.responseTextarea.value = this.aiResponse;
			}

			// Hide Stop button
			stopBtn.style.display = 'none';
			submitBtn.disabled = false;
			copyBtn.disabled = false;

			this.isGenerating = false;

		} catch (error) {
			console.error('Follow-up generation error:', error);
			
			const errorMessage = `❌ Error: ${error.message}`;
			if (this.responseTextarea) {
				this.responseTextarea.value = this.aiResponse + '\n\n' + errorMessage;
			}
			
			stopBtn.style.display = 'none';
			submitBtn.disabled = false;
			copyBtn.disabled = false;
			
			new Notice(`❌ ${error.message}`);
			this.isGenerating = false;
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
