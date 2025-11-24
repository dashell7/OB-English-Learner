import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, setIcon, TFile, AbstractInputSuggest, TFolder, debounce } from 'obsidian';
import { YouTubeScraper } from './src/scraper';
import { NoteGenerator } from './src/generator';
import { BasesIntegration } from './src/bases';
import { LinguaSyncSettings } from './src/types';
import { ProgressNotice } from './src/progress-notice';
import { PasswordManagerModal } from './src/password-manager';

const DEFAULT_TEMPLATE = `---
title: "{{title}}"
langr: {{title}}
date: {{date}}
cefr: B2
cover: {{cover}}
channel: "{{channel}}"
url: {{url}}
duration: {{duration}}
type: video-note
status: inbox
tags:
  - english/video
---

langr-audio: {{url}}
langr-origin: {{channel}} - YouTube

^^^article

{{transcript}}

^^^words

^^^notes

---

## 视频信息

**频道**: {{channel}}  
**时长**: {{duration}}  
**日期**: {{uploadDate}}

## 字幕文件

{{srtLinks}}`;

const DEFAULT_FORMATTING_PROMPT = `Please format the following transcript text. You MUST follow these rules:
1. ADD PUNCTUATION: Insert periods, commas, question marks, etc. where appropriate.
2. PARAGRAPH BREAKS: Break into short paragraphs (every 2-4 sentences). Use double newlines (\\n\\n) between paragraphs.
3. CAPITALIZATION: Capitalize the first letter of each sentence.
4. NO CONTENT CHANGES: Do NOT change, add, or remove any words. Keep the original wording exactly as is.
5. NO EXPLANATIONS: Output ONLY the formatted text.

Input text:
{{text}}

Formatted text:`;

const DEFAULT_SETTINGS: LinguaSyncSettings = {
	defaultLanguage: 'en',
	targetLanguage: 'zh',
	videoFolder: 'Languages/Videos',
	assetsFolder: 'Languages/Assets',
	autoDownloadThumbnails: true,
	generateBilingualTranscript: false,
	// AI Translation & Formatting
	enableAITranslation: true,
	enableAIFormatting: true,  // AI punctuation and paragraph formatting
	aiFormattingPrompt: DEFAULT_FORMATTING_PROMPT,
	aiProvider: 'deepseek',
	aiApiKey: '',
	aiModel: 'deepseek-chat',
	aiBaseUrl: 'https://api.deepseek.com/v1/chat/completions',
	// Template
	noteTemplate: DEFAULT_TEMPLATE,
	// Account
	credentials: []
}

export default class LinguaSyncPlugin extends Plugin {
	settings: LinguaSyncSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		this.addRibbonIcon('video', 'OB English Learner', () => {
			new YouTubeInputModal(this.app, async (url) => {
				await this.importVideo(url);
			}).open();
		});

		// Command: Import YouTube Video
		this.addCommand({
			id: 'import-youtube-video',
			name: 'Import YouTube Video',
			callback: () => {
				new YouTubeInputModal(this.app, async (url) => {
					await this.importVideo(url);
				}).open();
			}
		});

		// Command: Initialize Knowledge Base
		this.addCommand({
			id: 'initialize-knowledge-base',
			name: 'Initialize Knowledge Base',
			callback: async () => {
				await this.initializeKnowledgeBase();
			}
		});

		// Add settings tab
		this.addSettingTab(new LinguaSyncSettingTab(this.app, this));
	}

	async importVideo(url: string) {
		// Total steps: 1.Extract ID, 2.Fetch transcript, 3.Detect language, 4.AI translate, 5.Create folders, 6.Generate SRTs, 7.Download thumbnail, 8.Create note
		const totalSteps = 8;
		const progress = new ProgressNotice(totalSteps);

		try {
			// Step 1: Extract video ID
			progress.nextStep('Extracting video ID...');
			const videoId = YouTubeScraper.extractVideoId(url);
			if (!videoId) {
				throw new Error('Invalid YouTube URL');
			}

			// Check if this video was already imported
			const existingNote = await this.findExistingNote(url, videoId);
			const isUpdate = existingNote !== null;
			
			if (isUpdate) {
				console.log('[OB English Learner] 🔄 Video already imported, updating note only...');
				progress.updateMessage('Video already exists, updating...');
			}

			// Step 2: Fetch original transcript
			progress.nextStep('Fetching video transcript...');
			
			// Prepare translator config
			const translatorConfig = this.settings.enableAITranslation && this.settings.aiApiKey ? {
				provider: this.settings.aiProvider,
				apiKey: this.settings.aiApiKey,
				model: this.settings.aiModel,
				baseUrl: this.settings.aiBaseUrl
			} : undefined;

			// Fetch video data with progress updates
			const videoData = await this.fetchVideoDataWithProgress(url, translatorConfig, progress);

			// Step 5: Create folders and files
			progress.nextStep('Creating folders...');

			// Step 6: Generate SRT files
			progress.nextStep('Generating subtitle files...');

			// Step 7: Download thumbnail
			progress.nextStep('Downloading thumbnail...');

			// Step 8: Create note
			progress.nextStep('Creating Markdown note...');

			// Generate note (pass isUpdate flag)
			const generator = new NoteGenerator(this.app, this.settings);
			const file = await generator.createVideoNote(videoData, isUpdate);

			// Success!
			if (isUpdate) {
				progress.success(`Updated: ${file.basename}`);
			} else {
				progress.success(`Created: ${file.basename}`);
			}

			// Open the note
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);

		} catch (error) {
			progress.error(error.message);
			console.error('Import failed:', error);
		}
	}

	/**
	 * Find existing note by video URL or ID
	 */
	async findExistingNote(url: string, videoId: string): Promise<TFile | null> {
		const videoFolder = this.settings.videoFolder;
		const files = this.app.vault.getMarkdownFiles();
		
		for (const file of files) {
			// Only check files in video folder
			if (!file.path.startsWith(videoFolder)) continue;
			
			// Read file content to check frontmatter
			const content = await this.app.vault.read(file);
			
			// Check if URL matches in frontmatter
			const urlMatch = content.match(/^url:\s*(.+)$/m);
			if (urlMatch) {
				const existingUrl = urlMatch[1].trim();
				// Normalize URLs for comparison
				if (this.normalizeVideoUrl(existingUrl) === this.normalizeVideoUrl(url)) {
					console.log(`[LinguaSync] Found existing note: ${file.basename}`);
					return file;
				}
			}
		}
		
		return null;
	}

	/**
	 * Normalize video URL for comparison (extract video ID)
	 */
	normalizeVideoUrl(url: string): string {
		const videoId = YouTubeScraper.extractVideoId(url);
		return videoId || url;
	}

	/**
	 * Fetch video data with progress updates
	 */
	private async fetchVideoDataWithProgress(url: string, translatorConfig: any, progress: ProgressNotice) {
		// This wraps YouTubeScraper.fetchVideoData and provides progress updates
		
		// Step 3: Detect language
		progress.nextStep('Detecting language...');
		
		// Step 4: AI translation (if needed)
		if (translatorConfig) {
			progress.nextStep('AI translating to Chinese...');
		} else {
			progress.nextStep('Fetching translations...');
		}
		
		return await YouTubeScraper.fetchVideoData(url, translatorConfig);
	}

	async initializeKnowledgeBase() {
		const notice = new Notice('Initializing Knowledge Base...', 0);

		try {
			const bases = new BasesIntegration(this.app);
			await bases.initializeKnowledgeBase('Languages');

			notice.hide();
			new Notice('✅ Knowledge Base initialized!');

		} catch (error) {
			notice.hide();
			new Notice(`❌ Error: ${error.message}`);
			console.error('Initialization failed:', error);
		}
	}

	onunload() {
		// Cleanup if needed
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// Modal for YouTube URL input
class YouTubeInputModal extends Modal {
	private onSubmit: (url: string) => void;

	constructor(app: App, onSubmit: (url: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl('h2', { text: 'Import YouTube Video' });

		const inputContainer = contentEl.createDiv();
		const input = inputContainer.createEl('input', {
			type: 'text',
			placeholder: 'https://youtu.be/... or https://www.youtube.com/watch?v=...'
		});
		input.style.width = '100%';
		input.style.padding = '8px';
		input.style.marginBottom = '12px';

		const buttonContainer = contentEl.createDiv();
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '8px';

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const submitBtn = buttonContainer.createEl('button', {
			text: 'Import',
			cls: 'mod-cta'
		});
		submitBtn.addEventListener('click', () => {
			const url = input.value.trim();
			if (url) {
				this.onSubmit(url);
				this.close();
			} else {
				new Notice('Please enter a YouTube URL');
			}
		});

		// Submit on Enter key
		input.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				submitBtn.click();
			}
		});

		// Focus input
		setTimeout(() => input.focus(), 100);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Settings tab
class LinguaSyncSettingTab extends PluginSettingTab {
	plugin: LinguaSyncPlugin;
	activeTab: string = 'general'; // Track active tab

	constructor(app: App, plugin: LinguaSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// Helper to create bilingual labels (English top, Chinese bottom)
	createBilingualLabel(en: string, cn: string): DocumentFragment {
		const fragment = document.createDocumentFragment();
		const enEl = fragment.createEl('div', { text: en, cls: 'ls-setting-en' });
		const cnEl = fragment.createEl('div', { text: cn, cls: 'ls-setting-cn' });
		return fragment;
	}

	private saveAndNotify = async () => {
		await this.plugin.saveSettings();
		new Notice('Settings saved / 设置已保存');
	}

	private debouncedSave = debounce(async () => {
		await this.plugin.saveSettings();
		new Notice('Settings saved / 设置已保存');
	}, 1000, true);

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Inject Mac-style CSS
		if (!document.getElementById('ls-mac-styles')) {
			const styleEl = document.createElement('style');
			styleEl.id = 'ls-mac-styles';
			styleEl.textContent = `
				/* === Mac Style Header === */
				.ls-header { text-align: center; padding: 20px 0 15px; margin-bottom: 10px; }
				.ls-title { color: var(--text-normal); font-size: 1.8em; font-weight: 600; margin: 0 0 5px 0; letter-spacing: -0.5px; }
				.ls-subtitle { color: var(--text-muted); font-size: 0.9em; margin: 0; }

				/* === Mac Style Tabs (Segmented Control) === */
				.ls-tab-nav {
					display: flex;
					justify-content: center;
					background-color: var(--background-modifier-form-field);
					padding: 4px;
					border-radius: 8px;
					margin: 0 auto 25px auto;
					width: fit-content;
					box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
				}
				.ls-tab-item {
					padding: 6px 16px;
					cursor: pointer;
					border-radius: 6px;
					color: var(--text-muted);
					font-size: 13px;
					font-weight: 500;
					transition: all 0.15s ease;
					border: 1px solid transparent;
					margin: 0 1px;
					user-select: none;
				}
				.ls-tab-item:hover {
					color: var(--text-normal);
				}
				.ls-tab-item.is-active {
					background-color: var(--background-primary);
					color: var(--text-normal);
					border-color: rgba(0,0,0,0.1);
					box-shadow: 0 1px 2px rgba(0,0,0,0.1);
					font-weight: 600;
				}
				.theme-dark .ls-tab-item.is-active {
					border-color: rgba(255,255,255,0.1);
				}

				/* === Bilingual Settings Text === */
				.ls-setting-en { font-weight: 600; font-size: 1.05em; line-height: 1.3; margin-bottom: 2px; color: var(--text-normal); }
				.ls-setting-cn { font-size: 0.85em; color: var(--text-muted); font-weight: normal; line-height: 1.4; }

				/* === Sections === */
				.ls-section { 
					background: var(--background-primary); 
					border: 1px solid var(--background-modifier-border); 
					border-radius: 10px; 
					padding: 24px; 
					margin-bottom: 20px; 
				}
				.ls-section-title {
					font-size: 1.2em;
					font-weight: 600;
					margin-bottom: 20px;
					padding-bottom: 10px;
					border-bottom: 1px solid var(--background-modifier-border);
					color: var(--text-normal);
				}

				/* === Inputs & Controls === */
				.ls-section input[type="text"], .ls-section select, .ls-section textarea {
					border-radius: 6px;
					border: 1px solid var(--background-modifier-border);
					padding: 6px 10px;
					font-size: 14px;
				}
				.ls-section input[type="text"]:focus, .ls-section textarea:focus {
					border-color: var(--interactive-accent);
					box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
				}
				
				/* === Properties Manager === */
				.ls-properties-card {
					background: var(--background-secondary);
					border-radius: 8px;
					padding: 15px;
					border: 1px solid var(--background-modifier-border);
				}
				.ls-property-row {
					padding: 8px 0;
					border-bottom: 1px solid var(--background-modifier-border);
				}
				.ls-property-row:last-child { border-bottom: none; }

				/* === Animations === */
				@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
				.ls-tab-content { animation: fadeIn 0.2s ease-out; }
			`;
			document.head.appendChild(styleEl);
		}

		// Header
		const headerEl = containerEl.createDiv({ cls: 'ls-header' });
		headerEl.createEl('h1', { text: 'OB English Learner', cls: 'ls-title' });
		headerEl.createEl('p', { text: 'Import and manage YouTube/Bilibili video transcripts for language learning.', cls: 'ls-subtitle' });

		// Tab Navigation
		const navEl = containerEl.createDiv({ cls: 'ls-tab-nav' });
		const tabs = [
			{ id: 'general', label: 'General', labelCn: '常规' },
			{ id: 'video', label: 'Video', labelCn: '视频' },
			{ id: 'ai', label: 'AI', labelCn: '智能' },
			{ id: 'template', label: 'Template', labelCn: '模板' },
			{ id: 'account', label: 'Account', labelCn: '账户' }
		];

		tabs.forEach(tab => {
			const tabEl = navEl.createDiv({ cls: `ls-tab-item ${this.activeTab === tab.id ? 'is-active' : ''}` });
			tabEl.setText(`${tab.label} ${tab.labelCn}`);
			tabEl.onclick = () => {
				this.activeTab = tab.id;
				this.display(); // Re-render
			};
		});

		// Content Container
		const contentEl = containerEl.createDiv({ cls: 'ls-tab-content' });

		// Render based on active tab
		switch (this.activeTab) {
			case 'general': this.renderGeneral(contentEl); break;
			case 'video': this.renderVideo(contentEl); break;
			case 'ai': this.renderAI(contentEl); break;
			case 'template': this.renderTemplate(contentEl); break;
			case 'account': this.renderAccount(contentEl); break;
		}
	}

	renderGeneral(container: HTMLElement) {
		const section = container.createDiv({ cls: 'ls-section' });
		section.createEl('div', { text: 'General / 常规设置', cls: 'ls-section-title' });

		new Setting(section)
			.setName(this.createBilingualLabel('Default Language', '默认语言'))
			.setDesc('Default transcript language (e.g., en, zh, es) / 字幕默认语言代码')
			.addText(text => text
				.setPlaceholder('en')
				.setValue(this.plugin.settings.defaultLanguage)
				.onChange(async (value) => {
					this.plugin.settings.defaultLanguage = value;
					this.debouncedSave();
				}));
	}

	renderVideo(container: HTMLElement) {
		const section = container.createDiv({ cls: 'ls-section' });
		section.createEl('div', { text: 'Video & Assets / 视频与资源', cls: 'ls-section-title' });

		new Setting(section)
			.setName(this.createBilingualLabel('Video Folder', '视频保存目录'))
			.setDesc('Folder where video notes will be saved / 视频笔记存放文件夹')
			.addText(text => {
				text
					.setPlaceholder('Languages/Videos')
					.setValue(this.plugin.settings.videoFolder)
					.onChange(async (value) => {
						this.plugin.settings.videoFolder = value;
						this.debouncedSave();
					});
				new FolderSuggest(this.app, text.inputEl);
			});

		new Setting(section)
			.setName(this.createBilingualLabel('Assets Folder', '资源保存目录'))
			.setDesc('Folder for SRT files and thumbnails / SRT字幕和封面图存放文件夹')
			.addText(text => {
				text
					.setPlaceholder('Languages/Assets')
					.setValue(this.plugin.settings.assetsFolder)
					.onChange(async (value) => {
						this.plugin.settings.assetsFolder = value;
						this.debouncedSave();
					});
				new FolderSuggest(this.app, text.inputEl);
			});
		
		new Setting(section)
			.setName(this.createBilingualLabel('Auto-download Thumbnails', '自动下载封面图'))
			.setDesc('Automatically download video thumbnails / 导入视频时自动保存封面')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoDownloadThumbnails)
				.onChange(async (value) => {
					this.plugin.settings.autoDownloadThumbnails = value;
					this.saveAndNotify();
				}));
	}

	renderAI(container: HTMLElement) {
		const section = container.createDiv({ cls: 'ls-section' });
		section.createEl('div', { text: 'AI Translation / 智能翻译', cls: 'ls-section-title' });

		// AI Models Configuration
		const models: Record<string, { id: string, name: string }[]> = {
			'deepseek': [
				{ id: 'deepseek-chat', name: 'DeepSeek Chat' },
				{ id: 'deepseek-coder', name: 'DeepSeek Coder' }
			],
			'openai': [
				{ id: 'gpt-4o', name: 'GPT-4o' },
				{ id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
				{ id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
			],
			'gemini': [
				{ id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' },
				{ id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
				{ id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
				{ id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B' }
			]
		};

		new Setting(section)
			.setName(this.createBilingualLabel('Enable AI Translation', '启用 AI 翻译'))
			.setDesc('Translate English transcripts to Chinese using AI / 使用 AI 将英文字幕翻译为中文')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAITranslation)
				.onChange(async (value) => {
					this.plugin.settings.enableAITranslation = value;
					this.saveAndNotify();
				}));

		new Setting(section)
			.setName(this.createBilingualLabel('Enable AI Formatting', '智能断句与标点'))
			.setDesc('Auto-add punctuation and break paragraphs / 自动添加标点符号并优化段落')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAIFormatting)
				.onChange(async (value) => {
					this.plugin.settings.enableAIFormatting = value;
					await this.saveAndNotify();
					this.display(); // Refresh to show/hide prompt
				}));

		if (this.plugin.settings.enableAIFormatting) {
			new Setting(section)
				.setName(this.createBilingualLabel('Formatting Prompt', '格式化提示词'))
				.setDesc('Custom instructions for AI formatting / 自定义 AI 格式化指令')
				.addTextArea(text => text
					.setPlaceholder('Please format...')
					.setValue(this.plugin.settings.aiFormattingPrompt)
					.onChange(async (value) => {
						this.plugin.settings.aiFormattingPrompt = value;
						this.debouncedSave();
					})
					.inputEl.rows = 6
				)
				.addExtraButton(btn => btn
					.setIcon('reset')
					.setTooltip('Reset to Default / 恢复默认')
					.onClick(async () => {
						this.plugin.settings.aiFormattingPrompt = DEFAULT_FORMATTING_PROMPT;
						await this.saveAndNotify();
						this.display(); // Refresh to show new value
					})
				)
				.settingEl.querySelector('.setting-item-control .setting-item-description')?.remove();
				// Adjust textarea width
				const textAreas = section.querySelectorAll('textarea');
				const lastTextArea = textAreas[textAreas.length - 1];
				if (lastTextArea) {
					lastTextArea.style.width = '100%';
					lastTextArea.style.marginTop = '10px';
				}
		}

		new Setting(section)
			.setName(this.createBilingualLabel('AI Provider', 'AI 服务提供商'))
			.setDesc('Choose your AI service provider / 选择 AI 服务商')
			.addDropdown(dropdown => dropdown
				.addOption('deepseek', 'DeepSeek (推荐)')
				.addOption('openai', 'OpenAI')
				.addOption('gemini', 'Google Gemini')
				.setValue(this.plugin.settings.aiProvider)
				.onChange(async (value: any) => {
					this.plugin.settings.aiProvider = value;
					// Reset model to the first option of the new provider
					const newModels = models[value] || [];
					if (newModels.length > 0) {
						this.plugin.settings.aiModel = newModels[0].id;
					}
					await this.saveAndNotify();
					this.display(); // Refresh UI to update model dropdown
				}));

		new Setting(section)
			.setName(this.createBilingualLabel('API Key', 'API 密钥'))
			.setDesc('Your AI API key / 填写对应服务商的 API Key')
			.addText(text => text
				.setPlaceholder('sk-...')
				.setValue(this.plugin.settings.aiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.aiApiKey = value;
					this.debouncedSave();
				}));

		new Setting(section)
			.setName(this.createBilingualLabel('Model', '模型选择'))
			.setDesc('Select the AI model to use / 选择要使用的模型')
			.addDropdown(dropdown => {
				const currentProvider = this.plugin.settings.aiProvider;
				const availableModels = models[currentProvider] || [];
				
				availableModels.forEach(m => dropdown.addOption(m.id, m.name));
				
				// Ensure current value is valid
				if (!availableModels.find(m => m.id === this.plugin.settings.aiModel)) {
					if (availableModels.length > 0) {
						this.plugin.settings.aiModel = availableModels[0].id;
						this.plugin.saveSettings(); // Silent save for correction
					}
				}

				dropdown
					.setValue(this.plugin.settings.aiModel)
					.onChange(async (value) => {
						this.plugin.settings.aiModel = value;
						this.saveAndNotify();
					});
			});
		
		new Setting(section)
			.setName(this.createBilingualLabel('Test Connection', '测试连接'))
			.setDesc('Test if your API configuration works / 测试 API 配置是否正确')
			.addButton(button => button
				.setButtonText('Test Connection / 测试')
				.setClass('ls-button')
				.onClick(async () => {
					await this.testAIConnection();
				}));
	}

	renderTemplate(container: HTMLElement) {
		const section = container.createDiv({ cls: 'ls-section' });
		section.createEl('div', { text: 'Note Template / 笔记模板', cls: 'ls-section-title' });

		// Properties Manager
		section.createEl('h4', { text: 'Frontmatter Properties / 顶部属性' });
		const descEl = section.createDiv({ text: 'Manage properties that appear at the top of the note / 管理笔记顶部的 YAML 属性', cls: 'setting-item-description' });
		descEl.style.marginBottom = '10px';

		const propertiesDiv = section.createDiv({ cls: 'ls-properties-card' });
		let templateTextArea: any;

		const refreshProperties = () => {
			propertiesDiv.empty();
			const properties = this.parseFrontmatter(this.plugin.settings.noteTemplate);
			
			if (properties.length === 0) {
				const emptyMsg = propertiesDiv.createDiv({ text: 'No properties found. / 未找到属性' });
				emptyMsg.style.color = 'var(--text-muted)';
				emptyMsg.style.padding = '10px';
			}

			properties.forEach((prop, index) => {
				const row = new Setting(propertiesDiv)
					.addText(text => text.setPlaceholder('Key').setValue(prop.key).onChange(k => { 
						properties[index].key = k; 
						this.updateTemplate(properties, templateTextArea);
						this.debouncedSave();
					}))
					.addText(text => text.setPlaceholder('Value').setValue(prop.value).onChange(v => { 
						properties[index].value = v; 
						this.updateTemplate(properties, templateTextArea); 
						this.debouncedSave();
					}))
					.addToggle(toggle => toggle.setValue(prop.enabled).setTooltip('Show/Hide').onChange(e => { 
						properties[index].enabled = e; 
						this.updateTemplate(properties, templateTextArea); 
						this.saveAndNotify();
					}))
					.addButton(btn => btn.setIcon('trash').onClick(() => { 
						properties.splice(index, 1); 
						this.updateTemplate(properties, templateTextArea); 
						refreshProperties(); 
						this.saveAndNotify();
					}));
				
				row.setClass('ls-property-row');
				row.controlEl.style.justifyContent = 'flex-start';
				row.controlEl.style.gap = '10px';
				const inputs = row.controlEl.querySelectorAll('input[type="text"]');
				if (inputs.length >= 2) {
					(inputs[0] as HTMLElement).style.width = '120px';
					(inputs[1] as HTMLElement).style.width = '180px';
				}
			});

			const addBtnContainer = propertiesDiv.createDiv();
			addBtnContainer.style.marginTop = '10px';
			addBtnContainer.style.display = 'flex';
			addBtnContainer.style.justifyContent = 'flex-end';
			const addBtn = addBtnContainer.createEl('button', { text: '+ Add Property' });
			addBtn.onclick = () => {
				properties.push({ key: 'new_property', value: '', enabled: true });
				this.updateTemplate(properties, templateTextArea);
				refreshProperties();
				this.saveAndNotify();
			};
		};

		// Template Variables Info
		const varInfo = section.createDiv({ cls: 'ls-variables' });
		varInfo.style.marginTop = '20px';
		varInfo.style.fontSize = '0.9em';
		varInfo.style.color = 'var(--text-muted)';
		varInfo.innerHTML = `<p><strong>Available Variables / 可用变量:</strong></p>
		<code style="color:#20C9A6">{{title}}</code>, <code style="color:#20C9A6">{{url}}</code>, <code style="color:#20C9A6">{{channel}}</code>, 
		<code style="color:#20C9A6">{{cover}}</code>, <code style="color:#20C9A6">{{transcript}}</code> ...`;

		new Setting(section)
			.setName(this.createBilingualLabel('Template Source', '模板源码'))
			.setDesc('Edit the raw Markdown template / 编辑原始 Markdown 模板')
			.addTextArea(text => {
				templateTextArea = text;
				text.setPlaceholder(DEFAULT_TEMPLATE)
					.setValue(this.plugin.settings.noteTemplate)
					.onChange(async (value) => {
						this.plugin.settings.noteTemplate = value;
						this.debouncedSave();
						refreshProperties();
					});
				text.inputEl.rows = 10;
				text.inputEl.style.width = '100%';
				text.inputEl.style.fontFamily = 'monospace';
			});

		setTimeout(() => refreshProperties(), 0);

		new Setting(section)
			.setName(this.createBilingualLabel('Reset Template', '重置模板'))
			.setDesc('Restore default template / 恢复默认设置')
			.addButton(button => button
				.setButtonText('Reset / 重置')
				.setClass('ls-button') // Use safe class adding
				.onClick(async () => {
					if(confirm('Reset to default template? / 确认重置模板？')) {
						this.plugin.settings.noteTemplate = DEFAULT_TEMPLATE;
						await this.saveAndNotify();
						this.display();
					}
				}));
	}

	renderAccount(container: HTMLElement) {
		const section = container.createDiv({ cls: 'ls-section' });
		section.createEl('div', { text: 'Account Management / 账户管理', cls: 'ls-section-title' });

		const accountDiv = section.createDiv();
		accountDiv.style.display = 'flex';
		accountDiv.style.justifyContent = 'space-between';
		accountDiv.style.alignItems = 'center';
		
		const infoDiv = accountDiv.createDiv();
		const h4 = infoDiv.createEl('h4', { text: 'Password Manager / 密码管理器' });
		h4.style.margin = '0 0 5px 0';
		
		const descDiv = infoDiv.createDiv({ 
			text: 'Manage credentials for protected media sources / 管理受保护媒体源的访问凭证'
		});
		descDiv.style.color = 'var(--text-muted)';
		descDiv.style.fontSize = '0.9em';

		const openBtn = accountDiv.createEl('button');
		openBtn.setText('Open Manager / 打开管理');
		openBtn.onclick = () => new PasswordManagerModal(this.app, this.plugin).open();
	}

	// Helper: Parse Frontmatter
	private parseFrontmatter(template: string): { key: string, value: string, enabled: boolean }[] {
		const match = template.match(/^---\n([\s\S]*?)\n---/);
		if (!match) return [];
		
		const content = match[1];
		const lines = content.split('\n');
		const properties: { key: string, value: string, enabled: boolean }[] = [];
		let currentProp: any = null;
		
		for (const line of lines) {
			const trimLine = line.trim();
			if (!trimLine) continue;
			
			// Handle lists (append to previous value)
			if (trimLine.startsWith('-')) {
				if (currentProp) {
					currentProp.value += '\n' + line;
				}
				continue;
			}
			
			const isCommented = trimLine.startsWith('#');
			const cleanLine = isCommented ? trimLine.substring(1).trim() : trimLine;
			
			// Find first colon
			const colonIndex = cleanLine.indexOf(':');
			if (colonIndex !== -1) {
				const key = cleanLine.substring(0, colonIndex).trim();
				let value = cleanLine.substring(colonIndex + 1).trim();
				
				if (key) {
					currentProp = { key, value, enabled: !isCommented };
					properties.push(currentProp);
				}
			}
		}
		return properties;
	}

	// Helper: Update Template
	private updateTemplate(properties: { key: string, value: string, enabled: boolean }[], textArea: any) {
		const yamlLines = ['---'];
		properties.forEach(p => {
			const prefix = p.enabled ? '' : '# ';
			yamlLines.push(`${prefix}${p.key}: ${p.value}`);
		});
		yamlLines.push('---');
		const newFrontmatter = yamlLines.join('\n');
		
		let currentTemplate = this.plugin.settings.noteTemplate;
		if (currentTemplate.match(/^---\n([\s\S]*?)\n---/)) {
			this.plugin.settings.noteTemplate = currentTemplate.replace(/^---\n([\s\S]*?)\n---/, newFrontmatter);
		} else {
			this.plugin.settings.noteTemplate = newFrontmatter + '\n' + currentTemplate;
		}
		
		if (textArea) textArea.setValue(this.plugin.settings.noteTemplate);
	}

	/**
	 * Test AI connection
	 */
	private async testAIConnection() {
		const { aiProvider, aiApiKey, aiModel, aiBaseUrl } = this.plugin.settings;
		
		if (!aiApiKey) {
			new Notice('❌ Please enter your API key first / 请先输入 API 密钥');
			return;
		}
		
		const notice = new Notice('🔄 Testing connection... / 正在测试连接...', 0);
		
		try {
			const { AITranslator } = await import('./src/translator');
			
			const translator = new AITranslator({
				provider: aiProvider,
				apiKey: aiApiKey,
				model: aiModel,
				baseUrl: aiBaseUrl
			});
			
			// Test with a simple translation
			const testLines = [{
				start: 0,
				duration: 1,
				text: 'Hello',
				lang: 'en'
			}];
			
			await translator.translateTranscript(testLines);
			
			notice.hide();
			new Notice('✅ Connection successful! / 连接成功！\nAI service is ready.', 5000);
			
		} catch (error) {
			notice.hide();
			console.error('[OB English Learner] AI connection test failed:', error);
			
			let errorMessage = error.message || 'Unknown error';
			let detail = errorMessage;
			
			// Provide helpful error messages
			if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
				detail = 'Invalid API Key (401). Please check your key.\nAPI 密钥无效，请检查。';
			} else if (errorMessage.includes('429')) {
				detail = 'Rate Limit Exceeded (429). Check your quota.\n超出配额限制，请检查账户余额。';
			} else if (errorMessage.includes('403')) {
				detail = 'Access Forbidden (403). Region or permission issue.\n访问被拒绝，可能是地区限制或权限问题。';
			} else if (errorMessage.includes('404')) {
				detail = 'Model Not Found (404). Check model name.\n模型未找到，请检查模型名称是否正确。';
			} else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
				detail = 'Network Error. Check internet/proxy.\n网络错误，请检查网络连接或代理设置。';
			}
			
			new Notice(`❌ Connection Failed / 连接失败\n${detail}`, 10000);
		}
	}
}

class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private inputEl: HTMLInputElement;

	constructor(app: App, textInputEl: HTMLInputElement) {
		super(app, textInputEl);
		this.inputEl = textInputEl;
		
		// Auto-select text on focus so user can easily clear it to see all folders
		this.inputEl.addEventListener('focus', () => {
			this.inputEl.select();
		});
	}

	getSuggestions(inputStr: string): TFolder[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const folders: TFolder[] = [];
		const lowerCaseInputStr = inputStr.toLowerCase();

		abstractFiles.forEach((file: any) => {
			if (file instanceof TFolder) {
				// Match path
				if (file.path.toLowerCase().contains(lowerCaseInputStr)) {
					folders.push(file);
				}
			}
		});

		// Sort by path length (shallower folders first) then alphabetically
		folders.sort((a, b) => {
			const depthA = a.path.split('/').length;
			const depthB = b.path.split('/').length;
			if (depthA !== depthB) return depthA - depthB;
			return a.path.localeCompare(b.path);
		});

		return folders.slice(0, 100); // Limit to 100 results to prevent lag
	}

	renderSuggestion(file: TFolder, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFolder): void {
		this.inputEl.value = file.path;
		this.inputEl.trigger("input");
		this.close();
	}
}
