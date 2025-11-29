import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, setIcon, TFile, AbstractInputSuggest, TFolder, debounce, requestUrl, moment } from 'obsidian';
import { YouTubeScraper } from './src/scraper';
import { NoteGenerator } from './src/generator';
import { BasesIntegration } from './src/bases';
import { LinguaSyncSettings } from './src/types';
import { ProgressNotice } from './src/progress-notice';
import { PasswordManagerModal } from './src/password-manager';
import { AudioRecorder } from './src/voice/audio-recorder';
import { TranscriptionService } from './src/voice/transcription-service';
import { RecordingModal } from './src/voice/recording-modal';
import { TTSManager } from './src/tts/tts-manager';
import { ttsPanelExtension } from './src/tts/codemirror-extension';

const DEFAULT_TEMPLATE = `---
title: {{title}}
date: {{date}}
cover: {{cover}}
url: {{url}}
langr-audio: 
langr-origin: {{channel}} - YouTube
langr: xxx
---

^^^article

{{transcript}}

^^^words

^^^notes`;

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
	// Setup
	hasCompletedSetup: false,
	// General
	defaultLanguage: 'en',
	targetLanguage: 'zh',
	videoFolder: 'Languages/Videos',
	assetsFolder: 'Languages/Assets',  // 已废弃，保留用于兼容
	subtitlesFolder: 'Languages/Subtitles',  // 新增：字幕文件夹
	thumbnailsFolder: 'Languages/Thumbnails',  // 新增：封面图片文件夹
	autoDownloadThumbnails: true,
	generateBilingualTranscript: true,
	// AI Translation & Formatting
	enableAITranslation: false,
	enableAIFormatting: false,  // Note content
	enableAISubtitles: false,   // SRT files
	aiFormattingPrompt: DEFAULT_FORMATTING_PROMPT,
	aiProvider: 'deepseek',
	aiApiKey: '',
	aiModel: 'deepseek-chat',
	aiBaseUrl: 'https://api.deepseek.com/v1/chat/completions',
	// Voice to Text
	enableVoice2Text: false,
	sttProvider: 'openai',
	sttApiKey: '',
	sttLanguage: '',
	sttModel: 'whisper-1',
	sttBaseUrl: 'https://api.openai.com/v1/audio/transcriptions',
	saveAudio: true,
	audioFolder: 'recordings',
	audioFormat: 'wav',
	audioFilenameTemplate: 'Recording_{{date:YYYY-MM-DD}}_{{time:HH-mm-ss}}',
	// Text to Speech
	enableTTS: false,
    ttsProvider: 'openai',
    ttsApiKey: '',
	ttsModel: 'tts-1',
	ttsVoice: 'alloy',
    ttsSpeed: 1.0,
    ttsBaseUrl: '',
    ttsOutputFormat: 'audio-16khz-128kbitrate-mono-mp3',
    // TTS Advanced
    ttsShowPlayer: 'always',
    ttsAutoscroll: true,
    ttsCacheType: 'local',
    ttsCacheDuration: 24,
    ttsAudioFolder: '03-Resources/aloud',
    ttsChunking: 'sentence',
	// Template
	noteTemplate: DEFAULT_TEMPLATE,
	// Account
	credentials: []
}

export default class LinguaSyncPlugin extends Plugin {
	settings: LinguaSyncSettings;
	recorder: AudioRecorder;
	transcriptionService: TranscriptionService;
    ttsManager: TTSManager;
	statusBarItem: HTMLElement;
	isRecording: boolean = false;
	recordingModal: RecordingModal | null = null;

	async onload() {
		await this.loadSettings();
		this.injectStyles();

		this.recorder = new AudioRecorder();
		this.transcriptionService = new TranscriptionService(this.settings);
        this.ttsManager = new TTSManager(this.app, this.settings);
        this.registerEditorExtension(ttsPanelExtension(this.ttsManager));

		// Show Setup Wizard on first install
		if (!this.settings.hasCompletedSetup) {
			// Delay to let Obsidian fully load
			setTimeout(() => {
				new SetupWizardModal(this.app, this).open();
			}, 1000);
		}

		// Add ribbon icon
		this.addRibbonIcon('video', 'Import YouTube Video', () => {
			new YouTubeInputModal(this.app, async (url) => {
				await this.importVideo(url);
			}).open();
		});

		// Add Voice Ribbon Icon
		this.addRibbonIcon('microphone', 'Start Voice Recording', () => {
			if (this.isRecording) {
				// If already recording, this should probably stop it or focus the modal?
				// The original plugin toggled it.
				// But our startRecording creates a new modal.
				// If we have a reference to modal, we can close it (which stops recording).
				if (this.recordingModal) {
					this.recordingModal.close(); // This triggers onRecordingClose(true) usually
				}
			} else {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view) {
					this.startRecording(view.editor, view);
				} else {
					new Notice('Please open a Markdown note first.');
				}
			}
		});

		// Add Status Bar Item
		this.statusBarItem = this.addStatusBarItem();
		this.statusBarItem.addClass('mod-clickable');
		this.statusBarItem.setAttribute('aria-label', 'Start Voice Recording');
		this.statusBarItem.setAttribute('title', 'Click to Start Recording');
		this.statusBarItem.innerHTML = '🎙';
		this.statusBarItem.addEventListener('click', () => {
			if (this.isRecording) {
				if (this.recordingModal) this.recordingModal.close();
			} else {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view) {
					this.startRecording(view.editor, view);
				} else {
					new Notice('Please open a Markdown note first.');
				}
			}
		});

		// Command: Start Voice Recording
		this.addCommand({
			id: 'start-voice-recording',
			name: 'Start Voice Recording',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.startRecording(editor, view);
			}
		});

		// Command: Speak Selection
		this.addCommand({
			id: 'speak-selection',
			name: 'Speak Selection (TTS)',
			editorCallback: (editor: Editor) => {
				this.speakSelection(editor);
			}
		});

		// Context Menu: TTS Options (Match Aloud exactly)
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu, editor, view) => {
				if (this.settings.enableTTS) {
					// 1. Play selection
					menu.addItem((item) => {
						item
							.setTitle('Aloud: Play selection')
							.setIcon('play')
							.onClick(() => {
								this.speakSelection(editor);
							});
					});
					
					// 2. Paste text to audio
					menu.addItem((item) => {
						item
							.setTitle('Aloud: Paste text to audio')
							.setIcon('clipboard')
							.onClick(async () => {
								try {
									const text = await navigator.clipboard.readText();
									if (text) {
										// replaceSelection=true: replace clipboard text with audio embed
										await this.exportTextToAudio(text, true);
									} else {
										new Notice('Clipboard is empty');
									}
								} catch (err) {
									new Notice('Failed to read clipboard: ' + err.message);
									console.error(err);
								}
							});
					});
					
					// 3. Export selection to audio
					menu.addItem((item) => {
						item
							.setTitle('Aloud: Export selection to audio')
							.setIcon('file-audio')
							.onClick(async () => {
								const text = editor.getSelection();
								if (text) {
									// replaceSelection=false: insert audio embed above selection
									await this.exportTextToAudio(text, false);
								} else {
									new Notice('No text selected');
								}
							});
					});
				}
			})
		);

		// Command: Open Setup Wizard
		this.addCommand({
			id: 'open-setup-wizard',
			name: '🧙 Open Setup Wizard',
			callback: () => {
				new SetupWizardModal(this.app, this).open();
			}
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

		// Debug: Test metadata extraction
		this.addCommand({
			id: 'debug-test-metadata',
			name: '[DEBUG] Test Metadata Extraction',
			callback: () => {
				new YouTubeInputModal(this.app, async (url) => {
					try {
						new Notice('Testing metadata extraction...');
						console.log('\n═══════════════════════════════════════');
						console.log('[DEBUG] Testing metadata extraction for:', url);
						console.log('═══════════════════════════════════════\n');
						
						const { YouTubeScraper } = await import('./src/scraper');
						const videoId = YouTubeScraper.extractVideoId(url);
						console.log('[DEBUG] Video ID:', videoId);
						
						if (!videoId) {
							new Notice('Invalid YouTube URL');
							return;
						}
						
						const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
						const response = await requestUrl({ 
							url: pageUrl,
							headers: {
								'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
								'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
								'Accept-Language': 'en-US,en;q=0.9',
								'Accept-Encoding': 'gzip, deflate, br',
								'DNT': '1',
								'Connection': 'keep-alive',
								'Upgrade-Insecure-Requests': '1'
							}
						});
						console.log('[DEBUG] HTML fetched, length:', response.text.length);
						
						// Actually call extractMetadata to see detailed logs
						console.log('\n--- Calling extractMetadata() ---\n');
						// @ts-ignore - accessing private method for testing
						const metadata = YouTubeScraper['extractMetadata'](response.text, videoId);
						
						console.log('\n--- Result ---');
						console.log('Title:', metadata.title);
						console.log('Author:', metadata.author);
						console.log('Duration:', metadata.duration);
						console.log('═══════════════════════════════════════\n');
						
						new Notice(`Title: ${metadata.title}`);
					} catch (error) {
						console.error('[DEBUG] Test failed:', error);
						new Notice(`Test failed: ${error.message}`);
					}
				}).open();
			}
		});

		// Add settings tab
		this.addSettingTab(new LinguaSyncSettingTab(this.app, this));
	}

	async startRecording(editor: Editor, view?: MarkdownView) {
		// Check setting (or allow it but warn if no key?)
		// Let's check enable flag first
		if (!this.settings.enableVoice2Text) {
			new Notice('Please enable Voice to Text in settings first.');
			// Optional: open settings?
			// this.app.setting.openTabById(this.manifest.id);
			return;
		}

		try {
			await this.recorder.startRecording(this.settings.audioFormat);
			const stream = this.recorder.getStream();

			if (!stream) {
				new Notice('Failed to access microphone stream.');
				return;
			}
			
			this.isRecording = true;
			this.statusBarItem.innerHTML = '⏹';
			this.statusBarItem.setAttribute('aria-label', 'Stop Recording');
			this.statusBarItem.setAttribute('title', 'Click to Stop Recording');

			this.recordingModal = new RecordingModal(
				this.app,
				async (cancelled) => {
					// Reset status
					this.isRecording = false;
					this.statusBarItem.innerHTML = '🎙';
					this.statusBarItem.setAttribute('aria-label', 'Start Voice Recording');
					this.statusBarItem.setAttribute('title', 'Click to Start Recording');
					this.recordingModal = null;

					if (cancelled) {
						this.recorder.cleanup();
						return;
					}

					// Save requested
					new Notice('Processing audio...');
					try {
						const audioBlob = await this.recorder.stopRecording();
						
						// 1. Save Audio File
						let audioLink = '';
						if (this.settings.saveAudio) {
							try {
								const fileName = await this.saveAudioFile(audioBlob, view?.file?.basename);
								audioLink = `![[${fileName}]]\n`;
							} catch (saveErr) {
								console.error('Failed to save audio file:', saveErr);
								new Notice('Failed to save audio file: ' + saveErr.message);
							}
						}
						
						// 2. Transcribe
						const notice = new Notice('Transcribing audio... ⏳', 0);
						let transcription = '';
						
						try {
							transcription = await this.transcriptionService.transcribe(audioBlob, this.settings.audioFormat);
							notice.hide();
							new Notice('✅ Transcription complete!');
						} catch (err) {
							notice.hide();
							new Notice('❌ Transcription failed: ' + err.message);
							console.error(err);
						}

						// 3. Insert both (Audio Top, Text Bottom, no blank line)
						const finalContent = `${audioLink}${transcription ? transcription + '\n\n' : ''}`;
						if (finalContent) {
							editor.replaceRange(finalContent, editor.getCursor());
						}

					} catch (error) {
						new Notice('Error processing recording: ' + error.message);
						console.error(error);
					}
				},
				() => this.recorder.pauseRecording(),
				() => this.recorder.resumeRecording(),
				stream
			);
			
			this.recordingModal.open();

		} catch (error) {
			new Notice('Failed to start recording: ' + error.message);
			console.error(error);
			this.isRecording = false;
		}
	}

	async speakSelection(editor: Editor) {
		if (!this.settings.enableTTS) {
			new Notice('Please enable Text to Speech in settings first.');
			return;
		}
		
		const selection = editor.getSelection();
		if (!selection) {
			new Notice('Please select some text to speak.');
			return;
		}
		
		// Limit length? OpenAI limit is 4096 chars.
		if (selection.length > 4096) {
			new Notice('Text too long (max 4096 chars).');
			return;
		}

		const notice = new Notice('Generating speech... ⏳', 0);
		try {
			await this.ttsManager.speak(selection);
			notice.hide();
			new Notice('Playing audio... 🔊');
		} catch (error) {
			notice.hide();
			new Notice('TTS Failed: ' + error.message);
			console.error(error);
		}
	}

	async exportTextToAudio(text: string, replaceSelection: boolean = false) {
		if (!this.settings.enableTTS) {
			new Notice('Please enable Text to Speech in settings first.');
			return;
		}
		
		if (!text || text.trim().length === 0) {
			new Notice('No text to export.');
			return;
		}
		
		// Generate filename: prefix-hash.mp3 (like Aloud)
		const prefix = text
			.replace(/\s/g, '-')
			.replace(/[^a-zA-Z0-9_-]/g, '')
			.slice(0, 20)
			.replace(/-+$/, '') || 'audio';
		
		// Simple hash function
		let hash = 0;
		for (let i = 0; i < text.length; i++) {
			hash = ((hash << 5) - hash) + text.charCodeAt(i);
			hash = hash & hash;
		}
		const hashStr = Math.abs(hash).toString(16);
		
		const folder = this.settings.ttsAudioFolder || '03-Resources/aloud';
		const filename = `${prefix}-${hashStr}.mp3`;
		const filepath = `${folder}/${filename}`;
		
		// Get active editor
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const editor = view?.editor;
		
		const finalReplacement = `![[${filepath}]]\n`;
		const loadingReplacement = `<loading file="${filepath}" />\n`;
		
		// Insert loading placeholder
		if (editor) {
			if (replaceSelection) {
				// Replace selection with loading placeholder
				editor.replaceSelection(loadingReplacement);
			} else {
				// Insert at cursor start (above selection)
				editor.replaceRange(
					loadingReplacement,
					editor.getCursor('from'),
					editor.getCursor('from')
				);
			}
		}
		
		// Function to replace loading state
		const removeLoadingState = (replacement: string) => {
			if (editor) {
				const doc = editor.getValue();
				const escapedLoading = loadingReplacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				const match = doc.match(new RegExp(escapedLoading));
				if (match) {
					const start = doc.indexOf(match[0]);
					const end = start + match[0].length;
					editor.replaceRange(
						replacement,
						editor.offsetToPos(start),
						editor.offsetToPos(end)
					);
				}
			}
		};
		
		try {
			new Notice(`Exporting ${filename}, this may take some time`);
			
			// Generate audio using TTS
			const provider = this.settings.ttsProvider || 'openai';
			let arrayBuffer: ArrayBuffer;
			
			if (provider === 'openai' || provider === 'custom') {
				arrayBuffer = await this.ttsManager['speakOpenAI'](text);
			} else if (provider === 'azure') {
				arrayBuffer = await this.ttsManager['speakAzure'](text);
			} else if (provider === 'elevenlabs') {
				arrayBuffer = await this.ttsManager['speakElevenLabs'](text);
			} else {
				throw new Error(`Provider ${provider} not supported for export`);
			}
			
			// Ensure folder exists
			await this.app.vault.adapter.mkdir(folder);
			
			// Write file
			await this.app.vault.adapter.writeBinary(filepath, arrayBuffer);
			
			// Replace loading with audio embed
			removeLoadingState(finalReplacement);
			new Notice(`Exported ${filename}`);
		} catch (error) {
			new Notice('Export failed: ' + error.message);
			console.error(error);
			// Remove loading placeholder on error
			removeLoadingState('');
		}
	}

	async saveAudioFile(audioBlob: Blob, noteTitle?: string): Promise<string> {
		const folderPath = this.settings.audioFolder || 'recordings';
		const extension = this.settings.audioFormat || 'wav';
		const template = this.settings.audioFilenameTemplate || 'Recording_{{date:YYYY-MM-DD}}_{{time:HH-mm-ss}}';
		
		let fileName = template;
		
		// Replace {{title}}
		fileName = fileName.replace(/{{title}}/g, noteTitle || 'Untitled');
		
		// Replace {{timestamp}}
		fileName = fileName.replace(/{{timestamp}}/g, Date.now().toString());
		
		// Replace {{date:FORMAT}} and {{time:FORMAT}}
		// @ts-ignore - moment is global in Obsidian
		const now = window.moment();
		
		fileName = fileName.replace(/{{date:(.*?)}}/g, (match, format) => now.format(format));
		fileName = fileName.replace(/{{time:(.*?)}}/g, (match, format) => now.format(format));
		
		fileName = fileName.replace(/{{date}}/g, now.format('YYYY-MM-DD'));
		fileName = fileName.replace(/{{time}}/g, now.format('HH-mm-ss'));

		// Sanitize filename
		fileName = fileName.replace(/[\\/:"*?<>|]/g, '');

		const filePath = `${folderPath}/${fileName}.${extension}`;
		
		// Ensure folder exists
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await this.app.vault.createFolder(folderPath);
		}
		
		const arrayBuffer = await audioBlob.arrayBuffer();
		await this.app.vault.createBinary(filePath, arrayBuffer);
		
		return filePath;
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

			// Step 4.5: AI Segmentation & Punctuation Refinement (if enabled)
			if (videoData.transcript && videoData.transcript.length > 0) {
				const lang = videoData.transcript[0].lang;
				console.log(`[LinguaSync] Transcript language detected: ${lang}`);
				
				const needsRefinement = (this.settings.enableAIFormatting || this.settings.enableAISubtitles) 
					&& this.settings.aiApiKey && lang && lang.startsWith('en');

				if (needsRefinement) {
					try {
						progress.nextStep('AI refining transcript segmentation...');
						console.log('[LinguaSync] Refining transcript with AI...');
						
						const { AITranslator } = await import('./src/translator');
						const translator = new AITranslator({
							provider: this.settings.aiProvider,
							apiKey: this.settings.aiApiKey,
							model: this.settings.aiModel,
							baseUrl: this.settings.aiBaseUrl
						});
						
						videoData.refinedTranscript = await translator.segmentAndPunctuate(videoData.transcript);
						console.log(`[LinguaSync] ✅ Transcript refined: ${videoData.refinedTranscript.length} lines`);

						// If the transcript was refined, we MUST re-translate it to keep alignment
						if (this.settings.enableAITranslation) {
							progress.nextStep('AI translating refined transcript...');
							console.log('[LinguaSync] Re-translating refined transcript...');
							videoData.refinedTranslatedTranscript = await translator.translateTranscript(videoData.refinedTranscript);
							console.log(`[LinguaSync] ✅ Re-translation completed: ${videoData.refinedTranslatedTranscript.length} lines`);
						}

					} catch (error) {
						console.error('[LinguaSync] AI segmentation failed, using original:', error);
						new Notice(`AI Segmentation failed: ${error.message}`);
						// Continue with original transcript
					}
				} else if ((this.settings.enableAIFormatting || this.settings.enableAISubtitles) && (!lang || !lang.startsWith('en'))) {
					console.log('[LinguaSync] AI formatting skipped: Language is not English');
				}
			}

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

	injectStyles() {
		if (document.getElementById('ls-mac-styles')) return;
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

			/* === TTS Player Panel (Aloud Style) === */
			.tts-toolbar {
			}
			
			.tts-toolbar-player {
				display: flex;
				padding: 0 var(--size-4-3);
				height: 32px;
				gap: var(--size-4-2);
				align-items: stretch;
			}
			
			.tts-toolbar-player-button-group {
				display: flex;
				align-items: center;
			}
			
			.tts-toolbar-button.tts-toolbar-button-active {
				color: var(--interactive-accent);
			}
			
			.tts-toolbar-button:not(.tts-toolbar-button-active) {
				color: var(--text-muted);
			}
			
			.tts-toolbar-button:hover {
				color: var(--interactive-accent) !important;
			}
			
			.tts-toolbar-button.is-disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
			
			.tts-audio-status-container {
				flex: 1 1 auto;
				display: flex;
				overflow: hidden;
				align-items: center;
				font-size: var(--font-ui-small);
				color: var(--text-muted);
			}
			
			/* Loading Spinner */
			.tts-spin {
				animation: tts-spin 1s linear infinite;
			}
			
			@keyframes tts-spin {
				from { transform: rotate(0deg); }
				to { transform: rotate(360deg); }
			}
			
			.tts-audio-status-loading {
				display: flex;
				justify-content: center;
				align-items: center;
			}
			
			/* Audio Visualizer (Aloud exact styles) */
			.tts-audio-visualizer {
				display: flex;
				justify-content: space-between;
				align-items: center;
				width: 100%;
				max-width: 2rem;
				height: 80%;
			}
			
			.tts-audio-visualizer-bar {
				background-color: var(--icon-color);
				border-radius: 10px;
				width: 6%;
				transition: height 0.04s linear;
			}
		`;
		document.head.appendChild(styleEl);
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

	// Helper to create bilingual labels (English + Chinese inline)
	createBilingualLabel(en: string, cn: string): DocumentFragment {
		const fragment = document.createDocumentFragment();
		const container = fragment.createEl('span', { cls: 'ls-setting-label' });
		container.createEl('span', { text: en, cls: 'ls-setting-en' });
		container.createEl('span', { text: ` ${cn}`, cls: 'ls-setting-cn' });
		return fragment;
	}

	// Helper to format file size
	humanFileSize(size: number): string {
		if (size === 0) return '0 B';
		const i = Math.floor(Math.log(size) / Math.log(1024));
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		return (size / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
	}

	private saveAndNotify = async () => {
		await this.plugin.saveSettings();
		new Notice('Settings saved / 设置已保存');
	}

	private debouncedSave = debounce(async () => {
		await this.plugin.saveSettings();
		new Notice('Settings saved / 设置已保存');
	}, 1000, true);

	// Helper: Check AI configuration status
	getAIStatus(): { status: 'configured' | 'warning' | 'not-set', message: string } {
		const { aiApiKey, aiProvider, aiModel } = this.plugin.settings;
		
		if (!aiApiKey) {
			return { status: 'not-set', message: 'API Key Required' };
		}
		if (!aiProvider || !aiModel) {
			return { status: 'warning', message: 'Incomplete Setup' };
		}
		return { status: 'configured', message: 'Ready' };
	}

	// Helper: Check TTS configuration status
	getTTSStatus(): { status: 'configured' | 'warning' | 'not-set', message: string } {
		const { ttsProvider, ttsApiKey } = this.plugin.settings;
		
		if (!ttsProvider) {
			return { status: 'not-set', message: 'Provider Not Set' };
		}
		
		// Check if API key is required
		const needsKey = ttsProvider === 'openai' || ttsProvider === 'azure' || ttsProvider === 'elevenlabs' || ttsProvider === 'custom';
		if (needsKey && !ttsApiKey && !this.plugin.settings.aiApiKey) {
			return { status: 'warning', message: 'API Key Missing' };
		}
		
		return { status: 'configured', message: 'Ready' };
	}

	// Helper: Check STT configuration status
	getSTTStatus(): { status: 'configured' | 'warning' | 'not-set', message: string } {
		const { sttProvider, sttApiKey } = this.plugin.settings;
		
		if (!sttProvider) {
			return { status: 'not-set', message: 'Provider Not Set' };
		}
		
		// OpenAI can use main AI key as fallback
		if (sttProvider === 'openai' && !sttApiKey && !this.plugin.settings.aiApiKey) {
			return { status: 'warning', message: 'API Key Missing' };
		}
		
		// Other providers need their own keys
		if (sttProvider !== 'openai' && !sttApiKey) {
			return { status: 'warning', message: 'API Key Missing' };
		}
		
		return { status: 'configured', message: 'Ready' };
	}

	// Helper: Create status indicator badge
	createStatusBadge(status: 'configured' | 'warning' | 'not-set', message: string): HTMLElement {
		const badge = document.createElement('span');
		badge.className = `ls-status ${status}`;
		
		const dot = badge.createEl('span', { cls: 'ls-status-dot' });
		badge.createEl('span', { text: message });
		
		return badge;
	}

	// Search: Filter settings by query
	filterSettings(query: string): void {
		const allSettings = this.containerEl.querySelectorAll('.setting-item');
		const allCards = this.containerEl.querySelectorAll('.ls-card');
		
		if (!query) {
			// Show all if no query
			allSettings.forEach(item => (item as HTMLElement).style.display = '');
			allCards.forEach(card => (card as HTMLElement).style.display = '');
			return;
		}
		
		allSettings.forEach(item => {
			const text = item.textContent?.toLowerCase() || '';
			(item as HTMLElement).style.display = text.includes(query) ? '' : 'none';
		});
		
		// Hide empty cards
		allCards.forEach(card => {
			const visibleSettings = card.querySelectorAll('.setting-item:not([style*="display: none"])');
			(card as HTMLElement).style.display = visibleSettings.length > 0 ? '' : 'none';
		});
	}

	// Setup Wizard: Guide new users through configuration
	showSetupWizard(): void {
		new SetupWizardModal(this.app, this.plugin).open();
	}

	// Presets: Quick configuration templates
	showPresets(): void {
		new PresetsModal(this.app, this.plugin, this).open();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Header
		const headerEl = containerEl.createDiv({ cls: 'ls-header' });
		headerEl.createEl('h1', { text: 'OB English Learner', cls: 'ls-title' });
		headerEl.createEl('p', { text: 'Import and manage YouTube/Bilibili video transcripts for language learning.', cls: 'ls-subtitle' });

		// Quick Access Bar & Search
		const quickBar = containerEl.createDiv({ cls: 'ls-quick-bar' });
		
		// Search Box
		const searchContainer = quickBar.createDiv({ cls: 'ls-search-container' });
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: '🔍 Search settings... / 搜索设置',
			cls: 'ls-search-input'
		});
		
		searchInput.addEventListener('input', (e) => {
			const query = (e.target as HTMLInputElement).value.toLowerCase();
			this.filterSettings(query);
		});
		
		// Quick Access Buttons
		const quickActions = quickBar.createDiv({ cls: 'ls-quick-actions' });
		
		// Setup Wizard Button
		const wizardBtn = quickActions.createEl('button', {
			text: '🧙 Setup Wizard',
			cls: 'ls-quick-btn'
		});
		wizardBtn.onclick = () => this.showSetupWizard();
		
		// Presets Button
		const presetsBtn = quickActions.createEl('button', {
			text: '📋 Presets',
			cls: 'ls-quick-btn'
		});
		presetsBtn.onclick = () => this.showPresets();

		// Tab Navigation (Reorganized: 4 tabs instead of 6)
		const navEl = containerEl.createDiv({ cls: 'ls-tab-nav' });
		const tabs = [
			{ id: 'content', label: '📝 Content', labelCn: '内容' },
			{ id: 'ai', label: '🤖 AI', labelCn: '智能' },
			{ id: 'audio', label: '🎙️ Audio', labelCn: '音频' },
			{ id: 'advanced', label: '⚙️ Advanced', labelCn: '高级' }
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
			case 'content': this.renderContent(contentEl); break;
			case 'ai': this.renderAI(contentEl); break;
			case 'audio': this.renderAudio(contentEl); break;
			case 'advanced': this.renderAdvanced(contentEl); break;
			default: 
				// Redirect old tabs to new structure
				if (this.activeTab === 'general' || this.activeTab === 'video') {
					this.activeTab = 'content';
					this.renderContent(contentEl);
				} else if (this.activeTab === 'voice') {
					this.activeTab = 'audio';
					this.renderAudio(contentEl);
				} else if (this.activeTab === 'template' || this.activeTab === 'account') {
					this.activeTab = 'advanced';
					this.renderAdvanced(contentEl);
				}
				break;
		}
	}

	// === Content Tab (General + Video) ===
	renderContent(container: HTMLElement) {
		// General Settings Card
		const generalCard = container.createDiv({ cls: 'ls-card' });
		generalCard.createEl('div', { text: '⚙️ General Settings', cls: 'ls-card-title' });

		new Setting(generalCard)
			.setName(this.createBilingualLabel('Default Language', '默认语言'))
			.setDesc('Default transcript language (e.g., en, zh, es)')
			.addText(text => text
				.setPlaceholder('en')
				.setValue(this.plugin.settings.defaultLanguage)
				.onChange(async (value) => {
					this.plugin.settings.defaultLanguage = value;
					this.debouncedSave();
				}));

		// Video & Assets Card
		const videoCard = container.createDiv({ cls: 'ls-card' });
		videoCard.createEl('div', { text: '🎥 Video & Assets', cls: 'ls-card-title' });
		
		this.renderVideoSettings(videoCard);
	}

	private renderVideoSettings(container: HTMLElement) {
		new Setting(container)
			.setName(this.createBilingualLabel('Video Notes Folder', '视频笔记目录'))
			.setDesc('Folder where video notes (MD files) will be saved')
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

		new Setting(container)
			.setName(this.createBilingualLabel('Subtitles Folder', '字幕文件目录'))
			.setDesc('Folder where SRT subtitle files will be saved')
			.addText(text => {
				text
					.setPlaceholder('Languages/Subtitles')
					.setValue(this.plugin.settings.subtitlesFolder)
					.onChange(async (value) => {
						this.plugin.settings.subtitlesFolder = value;
						this.debouncedSave();
					});
				new FolderSuggest(this.app, text.inputEl);
			});

		new Setting(container)
			.setName(this.createBilingualLabel('Thumbnails Folder', '封面图片目录'))
			.setDesc('Folder where video thumbnails will be saved')
			.addText(text => {
				text
					.setPlaceholder('Languages/Thumbnails')
					.setValue(this.plugin.settings.thumbnailsFolder)
					.onChange(async (value) => {
						this.plugin.settings.thumbnailsFolder = value;
						this.debouncedSave();
					});
				new FolderSuggest(this.app, text.inputEl);
			});
		
		new Setting(container)
			.setName(this.createBilingualLabel('Auto-download Thumbnails', '自动下载封面图'))
			.setDesc('Automatically download video thumbnails')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoDownloadThumbnails)
				.onChange(async (value) => {
					this.plugin.settings.autoDownloadThumbnails = value;
					this.saveAndNotify();
				}));
	}

	renderAI(container: HTMLElement) {
		const section = container.createDiv({ cls: 'ls-section' });
		
		// Section title with status
		const titleContainer = section.createDiv({ cls: 'ls-section-title' });
		titleContainer.createEl('span', { text: 'AI Translation / 智能翻译' });
		const aiStatus = this.getAIStatus();
		titleContainer.appendChild(this.createStatusBadge(aiStatus.status, aiStatus.message));

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
			],
			'siliconflow': [
				{ id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3' },
				{ id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1' },
				{ id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B' },
				{ id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder 32B' }
			],
			'videocaptioner': [
				{ id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini (最新小型)' },
				{ id: 'gpt-4.1', name: 'GPT-4.1 (最新旗舰)' },
				{ id: 'gpt-4o', name: 'GPT-4o' },
				{ id: 'claude-3.5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
				{ id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
			]
		};

		// === Features Card ===
		const featuresCard = section.createDiv({ cls: 'ls-card' });
		featuresCard.createEl('div', { text: '🤖 AI Features', cls: 'ls-card-title' });
		
		new Setting(featuresCard)
			.setName(this.createBilingualLabel('Enable AI Translation', '启用 AI 翻译'))
			.setDesc('Translate English transcripts to Chinese using AI')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAITranslation)
				.onChange(async (value) => {
					this.plugin.settings.enableAITranslation = value;
					this.saveAndNotify();
				}));

		new Setting(featuresCard)
			.setName(this.createBilingualLabel('Enable AI Formatting', '智能笔记格式化'))
			.setDesc('Auto-add punctuation and break paragraphs for Note content')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAIFormatting)
				.onChange(async (value) => {
					this.plugin.settings.enableAIFormatting = value;
					await this.saveAndNotify();
					this.display(); // Refresh to show/hide prompt
				}));

		new Setting(featuresCard)
			.setName(this.createBilingualLabel('Enable AI Subtitles', '智能字幕生成'))
			.setDesc('Apply AI punctuation and segmentation to generated SRT files')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAISubtitles)
				.onChange(async (value) => {
					this.plugin.settings.enableAISubtitles = value;
					await this.saveAndNotify();
				}));

		if (this.plugin.settings.enableAIFormatting) {
			new Setting(featuresCard)
				.setName(this.createBilingualLabel('Formatting Prompt', '格式化提示词'))
				.setDesc('Custom instructions for AI formatting')
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
					.setTooltip('Reset to Default')
					.onClick(async () => {
						this.plugin.settings.aiFormattingPrompt = DEFAULT_FORMATTING_PROMPT;
						await this.saveAndNotify();
						this.display(); // Refresh to show new value
					})
				)
				.settingEl.querySelector('.setting-item-control .setting-item-description')?.remove();
				
				const textAreas = featuresCard.querySelectorAll('textarea');
				const lastTextArea = textAreas[textAreas.length - 1];
				if (lastTextArea) {
					lastTextArea.style.width = '100%';
					lastTextArea.style.marginTop = '10px';
				}
		}

		// === Provider Configuration Card ===
		const providerCard = section.createDiv({ cls: 'ls-card' });
		providerCard.createEl('div', { text: '⚙️ Provider Configuration', cls: 'ls-card-title' });
		
		new Setting(providerCard)
			.setName(this.createBilingualLabel('AI Provider', 'AI 服务提供商'))
			.setDesc('Choose your AI service provider / 选择 AI 服务商')
			.addDropdown(dropdown => dropdown
				.addOption('deepseek', 'DeepSeek')
				.addOption('siliconflow', 'SiliconFlow')
				.addOption('videocaptioner', 'VideoCaptioner')
				.addOption('openai', 'OpenAI')
				.addOption('gemini', 'Gemini')
				.addOption('custom', 'Custom')
				.setValue(this.plugin.settings.aiProvider)
				.onChange(async (value: any) => {
					this.plugin.settings.aiProvider = value;
					
					if (value === 'custom') {
						// Keep existing values or set defaults
					} else if (value === 'videocaptioner') {
						this.plugin.settings.aiBaseUrl = 'https://api.videocaptioner.cn/v1/chat/completions';
					} else {
						this.plugin.settings.aiBaseUrl = '';
					}
						// Reset model to the first option of the new provider
						const newModels = models[value] || [];
						if (newModels.length > 0) {
							this.plugin.settings.aiModel = newModels[0].id;
						}
					
					await this.saveAndNotify();
					this.display(); // Refresh UI
				}));

		new Setting(providerCard)
			.setName(this.createBilingualLabel('API Key', 'API 密钥'))
			.setDesc('Your AI API key')
			.addText(text => text
				.setPlaceholder('sk-...')
				.setValue(this.plugin.settings.aiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.aiApiKey = value;
					this.debouncedSave();
					this.display(); // Refresh status
				}));

		// Base URL (Only for Custom)
		if (this.plugin.settings.aiProvider === 'custom') {
			new Setting(providerCard)
				.setName(this.createBilingualLabel('Base URL', 'API 地址'))
				.setDesc('Custom API Base URL (e.g. https://api.example.com/v1/chat/completions)')
				.addText(text => text
					.setPlaceholder('https://api.openai.com/v1/chat/completions')
					.setValue(this.plugin.settings.aiBaseUrl)
					.onChange(async (value) => {
						this.plugin.settings.aiBaseUrl = value;
						this.debouncedSave();
					}));
		}

		// Model Selection (Dynamic based on provider)
		if (this.plugin.settings.aiProvider === 'custom') {
			new Setting(providerCard)
				.setName(this.createBilingualLabel('Model Name', '模型名称'))
				.setDesc('Enter the model ID manually')
				.addText(text => text
					.setPlaceholder('e.g. gpt-4o-mini')
					.setValue(this.plugin.settings.aiModel)
					.onChange(async (value) => {
						this.plugin.settings.aiModel = value;
						this.debouncedSave();
					}));
		} else {
			new Setting(providerCard)
				.setName(this.createBilingualLabel('Model', '模型选择'))
				.setDesc('Select the AI model to use')
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
		}
		
		// === Testing Card ===
		const testCard = section.createDiv({ cls: 'ls-card' });
		testCard.createEl('div', { text: '🧪 Testing', cls: 'ls-card-title' });
		
		new Setting(testCard)
			.setName(this.createBilingualLabel('Test Connection', '测试连接'))
			.setDesc('Test if your API configuration works')
			.addButton(button => button
				.setButtonText('Test / 测试')
				.setClass('ls-button')
				.onClick(async () => {
					await this.testAIConnection();
				}));
	}

	// === Audio Tab (STT + TTS) ===
	renderAudio(container: HTMLElement) {
		const section = container.createDiv({ cls: 'ls-section' });
		
		// Section title
		section.createEl('div', { text: 'Audio / 音频', cls: 'ls-section-title' });

		// === Voice to Text (STT) Card ===
		const sttCard = section.createDiv({ cls: 'ls-card' });
		const sttTitle = sttCard.createDiv({ cls: 'ls-card-title' });
		sttTitle.createEl('span', { text: '🎙️ Voice to Text (STT)', cls: 'ls-card-icon' });
		
		// Add status badge if enabled
		if (this.plugin.settings.enableVoice2Text) {
			const sttStatus = this.getSTTStatus();
			sttTitle.appendChild(this.createStatusBadge(sttStatus.status, sttStatus.message));
		}

		new Setting(sttCard)
			.setName(this.createBilingualLabel('Enable Voice to Text', '启用语音转文字'))
			.setDesc('Enable voice recording and transcription commands')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableVoice2Text)
				.onChange(async (value) => {
					this.plugin.settings.enableVoice2Text = value;
					this.saveAndNotify();
					this.display();
				}));

		if (this.plugin.settings.enableVoice2Text) {
			new Setting(sttCard)
				.setName(this.createBilingualLabel('STT Provider', '语音识别服务商'))
				.setDesc('Service provider for Speech-to-Text')
				.addDropdown(dropdown => dropdown
					.addOption('openai', 'OpenAI')
					.addOption('custom', 'Custom')
					.addOption('assemblyai', 'AssemblyAI')
					.addOption('azure', 'Azure')
					.setValue(this.plugin.settings.sttProvider)
				.onChange(async (value: any) => {
					this.plugin.settings.sttProvider = value;
					// Set default base URLs if needed
					if (value === 'openai') {
						this.plugin.settings.sttBaseUrl = 'https://api.openai.com/v1/audio/transcriptions';
					}
					await this.saveAndNotify();
					this.display();
				}));

			// API Key
			const provider = this.plugin.settings.sttProvider;
			let keyDesc = 'API Key for Speech-to-Text';
			if (provider === 'openai') keyDesc = 'Leave empty to use main AI Key';
			
			new Setting(sttCard)
				.setName(this.createBilingualLabel('STT API Key', '语音识别 API 密钥'))
				.setDesc(keyDesc)
				.addText(text => text
					.setPlaceholder(provider === 'openai' ? 'Leave empty to use main AI Key' : 'sk-...')
					.setValue(this.plugin.settings.sttApiKey)
					.onChange(async (value) => {
						this.plugin.settings.sttApiKey = value;
						this.debouncedSave();
						this.display(); // Refresh status
					}));

			// Base URL for Custom
			if (provider === 'custom' || provider === 'azure') {
				let urlDesc = 'Custom API Endpoint';
				let placeHolder = 'https://api.openai.com/v1/audio/transcriptions';
				if (provider === 'azure') {
					urlDesc = 'Azure Region';
					placeHolder = 'eastus';
				}
				
				new Setting(sttCard)
					.setName(this.createBilingualLabel(provider === 'azure' ? 'Region' : 'Endpoint URL', provider === 'azure' ? '区域' : '接口地址'))
					.setDesc(urlDesc)
					.addText(text => text
						.setPlaceholder(placeHolder)
						.setValue(this.plugin.settings.sttBaseUrl)
						.onChange(async (value) => {
							this.plugin.settings.sttBaseUrl = value;
							this.debouncedSave();
						}));
			}

			// Language
			new Setting(sttCard)
				.setName(this.createBilingualLabel('Language', '语言'))
				.setDesc('Spoken language code (e.g., en, zh). Leave empty for auto-detection')
				.addText(text => text
					.setPlaceholder('e.g. zh')
					.setValue(this.plugin.settings.sttLanguage)
					.onChange(async (value) => {
						this.plugin.settings.sttLanguage = value;
						this.debouncedSave();
					}));

			// Model (for OpenAI/Custom)
			if (provider === 'openai' || provider === 'custom') {
				new Setting(sttCard)
				.setName(this.createBilingualLabel('Model', '模型'))
				.setDesc('Whisper model name')
				.addText(text => text
					.setPlaceholder('whisper-1')
					.setValue(this.plugin.settings.sttModel)
					.onChange(async (value) => {
						this.plugin.settings.sttModel = value;
						this.debouncedSave();
					}));
			}

			// Save Audio Settings
			new Setting(sttCard)
				.setName(this.createBilingualLabel('Audio file format', '音频文件格式'))
				.setDesc('Choose the format for saving audio recordings')
				.addDropdown(dropdown => dropdown
					.addOption('wav', 'WAV')
					.addOption('webm', 'WebM')
					.addOption('mp3', 'MP3')
					.setValue(this.plugin.settings.audioFormat || 'wav')
					.onChange(async (value) => {
						this.plugin.settings.audioFormat = value as any;
						this.saveAndNotify();
					}));

			new Setting(sttCard)
				.setName(this.createBilingualLabel('Save Audio File', '保存音频文件'))
				.setDesc('Save recorded audio to vault')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.saveAudio)
					.onChange(async (value) => {
						this.plugin.settings.saveAudio = value;
						this.saveAndNotify();
					}));

			new Setting(sttCard)
				.setName(this.createBilingualLabel('Filename Template', '录音文件名模板'))
				.setDesc('Available variables: {{date}}, {{time}}, {{title}}, {{timestamp}}')
				.addText(text => text
					.setPlaceholder('Recording_{{date:YYYY-MM-DD}}_{{time:HH-mm-ss}}')
					.setValue(this.plugin.settings.audioFilenameTemplate)
					.onChange(async (value) => {
						this.plugin.settings.audioFilenameTemplate = value;
						this.debouncedSave();
					}));

			new Setting(sttCard)
				.setName(this.createBilingualLabel('Audio Folder', '音频保存路径'))
				.setDesc('Folder to save audio recordings')
				.addText(text => {
					text
						.setPlaceholder('recordings')
						.setValue(this.plugin.settings.audioFolder)
						.onChange(async (value) => {
							this.plugin.settings.audioFolder = value;
							this.debouncedSave();
						});
					new FolderSuggest(this.app, text.inputEl);
				});
		}

		// === Text to Speech (TTS) Card ===
		const ttsCard = section.createDiv({ cls: 'ls-card' });
		const ttsTitle = ttsCard.createDiv({ cls: 'ls-card-title' });
		ttsTitle.createEl('span', { text: '🔊 Text to Speech (TTS)', cls: 'ls-card-icon' });
		
		// Add status badge if enabled
		if (this.plugin.settings.enableTTS) {
			const ttsStatus = this.getTTSStatus();
			ttsTitle.appendChild(this.createStatusBadge(ttsStatus.status, ttsStatus.message));
		}
		
		new Setting(ttsCard)
			.setName(this.createBilingualLabel('Enable TTS', '启用文本转语音'))
			.setDesc('Enable "Speak Selection" command and context menu')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableTTS)
				.onChange(async (value) => {
					this.plugin.settings.enableTTS = value;
					this.saveAndNotify();
					this.display();
				}));

		if (this.plugin.settings.enableTTS) {
            // Provider Selection
            new Setting(ttsCard)
                .setName(this.createBilingualLabel('TTS Provider', 'TTS 服务商'))
                .addDropdown(dropdown => dropdown
                    .addOption('openai', 'OpenAI')
                    .addOption('azure', 'Azure')
                    .addOption('elevenlabs', 'ElevenLabs')
                    .addOption('custom', 'Custom')
                    .setValue(this.plugin.settings.ttsProvider || 'openai')
                    .onChange(async (value: any) => {
                        this.plugin.settings.ttsProvider = value;
                        this.saveAndNotify();
                        this.display();
                    }));

            const provider = this.plugin.settings.ttsProvider || 'openai';

            // API Key (Optional Override)
            new Setting(section)
                .setName(this.createBilingualLabel('TTS API Key', 'TTS API 密钥'))
                .setDesc('Leave empty to use global API Key (if available) / 留空则使用全局 Key')
                .addText(text => text
                    .setPlaceholder('sk-...')
                    .setValue(this.plugin.settings.ttsApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.ttsApiKey = value;
                        this.debouncedSave();
                    }));

            // OpenAI / Custom Settings
            if (provider === 'openai' || provider === 'custom') {
                new Setting(section)
                    .setName(this.createBilingualLabel('TTS Model', 'TTS 模型'))
                    .addDropdown(dropdown => dropdown
                        .addOption('tts-1', 'TTS-1')
                        .addOption('tts-1-hd', 'TTS-1-HD')
                        .setValue(this.plugin.settings.ttsModel || 'tts-1')
                        .onChange(async (value) => {
                            this.plugin.settings.ttsModel = value;
                            this.debouncedSave();
                        }));
                
                new Setting(section)
                    .setName(this.createBilingualLabel('TTS Voice', 'TTS 音色'))
                    .addDropdown(dropdown => dropdown
                        .addOption('alloy', 'Alloy')
                        .addOption('echo', 'Echo')
                        .addOption('fable', 'Fable')
                        .addOption('onyx', 'Onyx')
                        .addOption('nova', 'Nova')
                        .addOption('shimmer', 'Shimmer')
                        .setValue(this.plugin.settings.ttsVoice || 'alloy')
                        .onChange(async (value) => {
                            this.plugin.settings.ttsVoice = value;
                            this.debouncedSave();
                        }));
                
                if (provider === 'custom') {
                     new Setting(section)
                        .setName(this.createBilingualLabel('TTS Base URL', 'TTS 接口地址'))
                        .setDesc('e.g. https://api.openai.com/v1/audio/speech')
                        .addText(text => text
                            .setPlaceholder('https://api.openai.com/v1/audio/speech')
                            .setValue(this.plugin.settings.ttsBaseUrl)
                            .onChange(async (value) => {
                                this.plugin.settings.ttsBaseUrl = value;
                                this.debouncedSave();
                            }));
                }
            }

            // Azure Settings
            if (provider === 'azure') {
                // Azure Regions
                const azureRegions = [
                    'eastus', 'eastus2', 'westus', 'westus2', 'westus3',
                    'centralus', 'northcentralus', 'southcentralus', 'westcentralus',
                    'canadacentral', 'brazilsouth',
                    'northeurope', 'westeurope', 'uksouth', 'francecentral',
                    'germanywestcentral', 'norwayeast', 'switzerlandnorth', 'switzerlandwest', 'swedencentral',
                    'eastasia', 'southeastasia', 'japaneast', 'japanwest', 'koreacentral',
                    'australiaeast', 'centralindia', 'jioindiawest', 'uaenorth'
                ];

                new Setting(section)
                    .setName(this.createBilingualLabel('Region', '区域'))
                    .setDesc('The Azure region for your Speech Services resource')
                    .addDropdown(dropdown => {
                        azureRegions.forEach(region => {
                            const label = region.charAt(0).toUpperCase() + region.slice(1);
                            dropdown.addOption(region, label);
                        });
                        dropdown.setValue(this.plugin.settings.ttsBaseUrl || 'eastus');
                        dropdown.onChange(async (value) => {
                            this.plugin.settings.ttsBaseUrl = value;
                            await this.saveAndNotify();
                            // Auto-reload voices when region changes
                            this.display();
                        });
                    });

                // Azure Voice (Auto-load)
                const apiKey = this.plugin.settings.ttsApiKey || this.plugin.settings.aiApiKey;
                const region = this.plugin.settings.ttsBaseUrl || 'eastus';
                
                if (apiKey && region) {
                    const voiceSetting = new Setting(section)
                        .setName(this.createBilingualLabel('Voice', '语音'))
                        .setDesc('The Azure voice to use for speech synthesis');
                    
                    voiceSetting.addDropdown(dropdown => {
                        dropdown.addOption('', 'Loading voices... / 加载中...');
                        dropdown.setDisabled(true);
                        
                        // Auto-load voices
                        this.plugin.ttsManager.getAzureVoices().then((voices: any[]) => {
                            if (!voices || voices.length === 0) {
                                dropdown.selectEl.innerHTML = '';
                                dropdown.addOption('', '❌ No voices found / 未找到语音');
                                dropdown.setDisabled(true);
                                return;
                            }
                            
                            voices.sort((a: any, b: any) => a.Locale.localeCompare(b.Locale) || a.DisplayName.localeCompare(b.DisplayName));
                            
                            const selectEl = dropdown.selectEl;
                            selectEl.innerHTML = '';
                            
                            voices.forEach((v: any) => {
                                const label = `${v.DisplayName} (${v.Gender}) - ${v.Locale}`;
                                const option = document.createElement('option');
                                option.value = v.ShortName;
                                option.text = label;
                                selectEl.appendChild(option);
                            });
                            
                            const current = this.plugin.settings.ttsVoice;
                            if (voices.find((v: any) => v.ShortName === current)) {
                                dropdown.setValue(current);
                            } else if (voices.length > 0) {
                                dropdown.setValue(voices[0].ShortName);
                                this.plugin.settings.ttsVoice = voices[0].ShortName;
                                this.saveAndNotify();
                            }
                            
                            dropdown.setDisabled(false);
                            dropdown.onChange(async (value) => {
                                this.plugin.settings.ttsVoice = value;
                                this.debouncedSave();
                            });
                        }).catch((err: any) => {
                            dropdown.selectEl.innerHTML = '';
                            const errorMsg = err.message || err.toString();
                            
                            // Provide helpful error messages
                            let displayMsg = '❌ Failed to load voices / 加载失败';
                            if (errorMsg.includes('401') || errorMsg.includes('403')) {
                                displayMsg = '❌ Invalid API Key / API密钥无效';
                            } else if (errorMsg.includes('404')) {
                                displayMsg = '❌ Invalid Region / 区域无效';
                            }
                            
                            dropdown.addOption('', displayMsg);
                            dropdown.setDisabled(true);
                            console.error('[Azure TTS] Failed to load voices:', err);
                            console.error('[Azure TTS] API Key (first 8 chars):', apiKey.substring(0, 8) + '...');
                            console.error('[Azure TTS] Region:', region);
                            
                            // Show notice to user
                            new Notice(`${displayMsg}\nCheck console for details / 详见控制台`, 5000);
                        });
                    });
                } else {
                    new Setting(section)
                        .setName(this.createBilingualLabel('Voice', '语音'))
                        .setDesc('⚠️ Enter your Azure API Key above to load available voices / 请先在上方输入 Azure API 密钥');
                }

                // Azure Output Format
                const azureFormats = [
                    { label: 'MP3 16kHz 128kbps', value: 'audio-16khz-128kbitrate-mono-mp3' },
                    { label: 'MP3 24kHz 96kbps', value: 'audio-24khz-96kbitrate-mono-mp3' },
                    { label: 'MP3 48kHz 192kbps', value: 'audio-48khz-192kbitrate-mono-mp3' },
                    { label: 'WAV 16kHz 16bit', value: 'riff-16khz-16bit-mono-pcm' },
                    { label: 'WAV 24kHz 16bit', value: 'riff-24khz-16bit-mono-pcm' },
                    { label: 'WAV 48kHz 16bit', value: 'riff-48khz-16bit-mono-pcm' }
                ];

                new Setting(section)
                    .setName(this.createBilingualLabel('Output Format', '输出格式'))
                    .setDesc('The audio format for the generated speech')
                    .addDropdown(dropdown => {
                        azureFormats.forEach(fmt => {
                            dropdown.addOption(fmt.value, fmt.label);
                        });
                        dropdown.setValue(this.plugin.settings.ttsOutputFormat || 'audio-16khz-128kbitrate-mono-mp3');
                        dropdown.onChange(async (value) => {
                            this.plugin.settings.ttsOutputFormat = value;
                            this.debouncedSave();
                        });
                    });
            }

            // ElevenLabs Settings
            if (provider === 'elevenlabs') {
                new Setting(section)
                    .setName(this.createBilingualLabel('Voice ID', 'Voice ID'))
                    .setDesc('ElevenLabs Voice ID')
                    .addText(text => text
                        .setPlaceholder('21m00Tcm4TlvDq8ikWAM')
                        .setValue(this.plugin.settings.ttsVoice)
                        .onChange(async (value) => {
                            this.plugin.settings.ttsVoice = value;
                            this.debouncedSave();
                        }));
                 
                 new Setting(section)
                    .setName(this.createBilingualLabel('Model ID', '模型 ID'))
                    .setDesc('e.g. eleven_monolingual_v1')
                    .addText(text => text
                        .setPlaceholder('eleven_monolingual_v1')
                        .setValue(this.plugin.settings.ttsModel)
                        .onChange(async (value) => {
                            this.plugin.settings.ttsModel = value;
                            this.debouncedSave();
                        }));
            }
            
            // Speed Control (Common)
            new Setting(section)
                .setName(this.createBilingualLabel('Playback Speed', '播放速度'))
                .setDesc('0.25x - 4.0x')
                .addSlider(slider => slider
                    .setLimits(0.25, 4.0, 0.25)
                    .setValue(this.plugin.settings.ttsSpeed || 1.0)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.ttsSpeed = value;
                        this.debouncedSave();
                    }));

            // Test Voice Button
            new Setting(section)
                .setName(this.createBilingualLabel('Test Voice', '测试语音'))
                .setDesc('Test your current TTS configuration')
                .addButton(btn => btn
                    .setButtonText('Test / 测试')
                    .onClick(async () => {
                        btn.setDisabled(true);
                        btn.setButtonText('Testing...');
                        try {
                            const testText = 'Hello, this is a test of the text to speech system.';
                            await this.plugin.ttsManager.speak(testText);
                            new Notice('TTS Test successful!');
                        } catch (err) {
                            new Notice('TTS Test failed: ' + err.message);
                            console.error(err);
                        } finally {
                            btn.setDisabled(false);
                            btn.setButtonText('Test / 测试');
                        }
                    }));

            // === User Interface ===
            section.createEl('h4', { text: 'User Interface / 用户界面' });
            
            new Setting(section)
                .setName(this.createBilingualLabel('Show player toolbar', '显示播放器工具栏'))
                .setDesc('Show the player toolbar under these conditions')
                .addDropdown(dropdown => dropdown
                    .addOption('always', 'Always')
                    .addOption('auto', 'Auto')
                    .addOption('never', 'Never')
                    .setValue(this.plugin.settings.ttsShowPlayer || 'always')
                    .onChange(async (value: any) => {
                        this.plugin.settings.ttsShowPlayer = value;
                        this.saveAndNotify();
                    }));

            new Setting(section)
                .setName(this.createBilingualLabel('Autoscroll Player View', '自动滚动播放视图'))
                .setDesc('Automatically scroll the player view to keep the active text visible.')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.ttsAutoscroll)
                    .onChange(async (value) => {
                        this.plugin.settings.ttsAutoscroll = value;
                        this.saveAndNotify();
                    }));

            // === Storage ===
            section.createEl('h4', { text: 'Storage / 存储' });

            new Setting(section)
                .setName(this.createBilingualLabel('Cache type', '缓存类型'))
                .setDesc('Local device based cache (recommended), or vault based.')
                .addDropdown(dropdown => dropdown
                    .addOption('local', 'Local')
                    .addOption('vault', 'Vault')
                    .setValue(this.plugin.settings.ttsCacheType || 'local')
                    .onChange(async (value: any) => {
                        this.plugin.settings.ttsCacheType = value;
                        this.saveAndNotify();
                    }));

            new Setting(section)
                .setName(this.createBilingualLabel('Cache duration', '缓存时长'))
                .setDesc('Cache duration in hours.')
                .addText(text => text
                    .setPlaceholder('24')
                    .setValue(String(this.plugin.settings.ttsCacheDuration || 24))
                    .onChange(async (value) => {
                        const num = parseInt(value);
                        if (!isNaN(num)) {
                            this.plugin.settings.ttsCacheDuration = num;
                            this.debouncedSave();
                        }
                    }));

            const cacheSizeSetting = new Setting(section)
                .setName(this.createBilingualLabel('Cache Disk Usage', '缓存占用'))
                .setDesc('Calculating...');
            
            const updateCacheSize = async () => {
                try {
                    const size = await this.plugin.ttsManager.getCacheSize();
                    const humanSize = this.humanFileSize(size);
                    cacheSizeSetting.setDesc(humanSize);
                } catch (err) {
                    cacheSizeSetting.setDesc('Error calculating size');
                    console.error(err);
                }
            };

            cacheSizeSetting
                .addButton(btn => btn
                    .setIcon('rotate-cw')
                    .setTooltip('Refresh')
                    .onClick(async () => {
                        btn.setDisabled(true);
                        await updateCacheSize();
                        btn.setDisabled(false);
                    }))
                .addButton(btn => btn
                    .setIcon('trash')
                    .setTooltip('Clear Cache')
                    .onClick(async () => {
                        if (confirm('Clear TTS Cache? This will delete all cached audio files.')) {
                            btn.setDisabled(true);
                            try {
                                await this.plugin.ttsManager.clearCache();
                                await updateCacheSize();
                            } catch (err) {
                                new Notice('Failed to clear cache: ' + err.message);
                            } finally {
                                btn.setDisabled(false);
                            }
                        }
                    }));
            
            // Initial load
            updateCacheSize();

            new Setting(section)
                .setName(this.createBilingualLabel('Audio Folder', '音频缓存目录'))
                .setDesc('The folder to store audio files (for Vault cache)')
                .addText(text => {
                    text
                        .setPlaceholder('03-Resources/aloud')
                        .setValue(this.plugin.settings.ttsAudioFolder)
                        .onChange(async (value) => {
                            this.plugin.settings.ttsAudioFolder = value;
                            this.debouncedSave();
                        });
                    new FolderSuggest(this.app, text.inputEl);
                });

            // === Audio ===
            section.createEl('h4', { text: 'Audio / 音频' });

            new Setting(section)
                .setName(this.createBilingualLabel('Text chunking', '文本分块'))
                .setDesc('Split text into sentences or paragraphs for playback')
                .addDropdown(dropdown => dropdown
                    .addOption('sentence', 'Sentence')
                    .addOption('paragraph', 'Paragraph')
                    .setValue(this.plugin.settings.ttsChunking || 'sentence')
                    .onChange(async (value: any) => {
                        this.plugin.settings.ttsChunking = value;
                        this.saveAndNotify();
                    }));
		}

		// Test Connection for STT
		new Setting(section)
			.setName(this.createBilingualLabel('Test STT Connection', '测试语音服务连接'))
			.setDesc('Test if your Voice-to-Text configuration works / 测试语音转文字服务配置')
			.addButton(button => button
				.setButtonText('Test Connection / 测试')
				.setClass('ls-button')
				.onClick(async () => {
					await this.testSTTConnection();
				}));
	}

	// === Advanced Tab (Template + Account) ===
	renderAdvanced(container: HTMLElement) {
		// Note Template Card
		const templateCard = container.createDiv({ cls: 'ls-card' });
		templateCard.createEl('div', { text: '📝 Note Template', cls: 'ls-card-title' });
		
		this.renderTemplateSettings(templateCard);
		
		// Account Management Card
		const accountCard = container.createDiv({ cls: 'ls-card' });
		accountCard.createEl('div', { text: '🔐 Account Management', cls: 'ls-card-title' });
		
		this.renderAccountSettings(accountCard);
	}

	private renderTemplateSettings(container: HTMLElement) {
		const section = container;

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

	private renderAccountSettings(container: HTMLElement) {
		new Setting(container)
			.setName(this.createBilingualLabel('Password Manager', '密码管理器'))
			.setDesc('Manage credentials for protected media sources')
			.addButton(button => button
				.setButtonText('Open Manager / 打开管理')
				.setClass('ls-button')
				.onClick(() => new PasswordManagerModal(this.app, this.plugin).open()));
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
		
		// Strict validation
		if (!aiApiKey || !aiApiKey.trim()) {
			new Notice('❌ Please enter your API key first / 请先输入 API 密钥', 5000);
			return;
		}
		
		const notice = new Notice('🔄 Testing connection... / 正在测试连接...', 0);
		
		try {
			// Determine the correct URL for each provider (same logic as translator.ts)
			let finalUrl = 'https://api.openai.com/v1/chat/completions';
			
			if (aiProvider === 'custom') {
				finalUrl = aiBaseUrl || finalUrl;
			} else if (aiProvider === 'deepseek') {
				finalUrl = 'https://api.deepseek.com/v1/chat/completions';
			} else if (aiProvider === 'siliconflow') {
				finalUrl = 'https://api.siliconflow.cn/v1/chat/completions';
			} else if (aiProvider === 'videocaptioner') {
				finalUrl = 'https://api.videocaptioner.cn/v1/chat/completions';
			} else if (aiProvider === 'gemini') {
				// Gemini uses different API format
				const modelName = aiModel || 'gemini-1.5-flash';
				finalUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${aiApiKey.trim()}`;
				
				const response = await requestUrl({
					url: finalUrl,
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						contents: [{
							parts: [{
								text: 'Hi'
							}]
						}]
					})
				});
				
				if (response.status === 200) {
					notice.hide();
					new Notice('✅ Connection Successful! / 连接成功！');
				} else {
					notice.hide();
					new Notice(`❌ Connection Failed / 连接失败\nStatus: ${response.status}`, 5000);
				}
				return;
			}
			
			// For OpenAI-compatible APIs (OpenAI, DeepSeek, SiliconFlow, VideoCaptioner, Custom)
			const body = {
				messages: [{ role: 'user', content: 'Hi' }],
				model: aiModel,
				stream: false
			};
			
			const response = await requestUrl({
				url: finalUrl,
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${aiApiKey.trim()}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});
			
			if (response.status === 200) {
				notice.hide();
				new Notice('✅ Connection Successful! / 连接成功！');
			} else {
				notice.hide();
				const errorText = response.text;
				let detail = `Status: ${response.status}`;
				if (response.status === 401) detail = 'Unauthorized (401). Check your API key.';
				if (response.status === 429) detail = 'Rate Limit Exceeded (429). Check your quota.';
				
				new Notice(`❌ Connection Failed / 连接失败\n${detail}\n${errorText.substring(0, 100)}`, 5000);
			}
		} catch (error) {
			notice.hide();
			let detail = error.message;
			if (detail.includes('401')) detail = 'Unauthorized (401). Check your API key.';
			else if (detail.includes('429')) detail = 'Rate Limit Exceeded (429). Check your quota.';
			else if (detail.includes('403')) detail = 'Access Forbidden (403). Region or permission issue.';
			else if (detail.includes('404')) detail = 'Model Not Found (404). Check model name.';
			
			new Notice(`❌ Connection Error: ${detail}`, 5000);
			console.error('Connection test failed:', error);
		}
	}

	/**
	 * Test STT Connection
	 */
	private async testSTTConnection() {
		const { sttProvider, sttApiKey, sttBaseUrl } = this.plugin.settings;
		const notice = new Notice('🔄 Testing STT connection... / 正在测试语音服务...', 0);

		try {
			if (sttProvider === 'openai' || sttProvider === 'custom') {
				const apiKey = sttApiKey || this.plugin.settings.aiApiKey;
				if (!apiKey) throw new Error('API Key is missing');

				// Try to list models as a simple auth check
				const response = await requestUrl({
					url: 'https://api.openai.com/v1/models',
					method: 'GET',
					headers: { 'Authorization': `Bearer ${apiKey}` }
				});

				if (response.status === 200) {
					notice.hide();
					new Notice('✅ OpenAI STT Connection Successful!');
				} else {
					throw new Error(`Status ${response.status}`);
				}

			} else if (sttProvider === 'assemblyai') {
				if (!sttApiKey) throw new Error('API Key is missing');
				
				const response = await requestUrl({
					url: 'https://api.assemblyai.com/v2/transcript?limit=1',
					method: 'GET',
					headers: { 'Authorization': sttApiKey }
				});

				if (response.status === 200) {
					notice.hide();
					new Notice('✅ AssemblyAI Connection Successful!');
				} else {
					throw new Error(`Status ${response.status}`);
				}

			} else if (sttProvider === 'azure') {
				if (!sttApiKey || !sttBaseUrl) throw new Error('API Key or Region missing');
				
				// sttBaseUrl here stores the region for Azure
				const region = sttBaseUrl; 
				const response = await requestUrl({
					url: `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
					method: 'POST',
					headers: { 'Ocp-Apim-Subscription-Key': sttApiKey }
				});

				if (response.status === 200) {
					notice.hide();
					new Notice('✅ Azure Connection Successful!');
				} else {
					throw new Error(`Status ${response.status}`);
				}
			}

		} catch (error) {
			notice.hide();
			new Notice(`❌ Connection Failed: ${error.message}`, 5000);
			console.error('STT Test failed:', error);
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

// Setup Wizard Modal
class SetupWizardModal extends Modal {
	plugin: LinguaSyncPlugin;
	currentStep: number = 0;
	steps: string[] = ['welcome', 'ai', 'audio', 'folders', 'complete'];

	constructor(app: App, plugin: LinguaSyncPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ls-wizard-modal');
		
		this.renderStep();
	}

	renderStep() {
		const { contentEl } = this;
		contentEl.empty();
		
		const step = this.steps[this.currentStep];
		
		// Header
		const header = contentEl.createDiv({ cls: 'ls-wizard-header' });
		header.createEl('h2', { text: '🧙 Setup Wizard / 设置向导' });
		header.createEl('p', { text: `Step ${this.currentStep + 1} of ${this.steps.length} / 第 ${this.currentStep + 1} 步，共 ${this.steps.length} 步` });
		
		// Progress bar
		const progress = contentEl.createDiv({ cls: 'ls-wizard-progress' });
		const bar = progress.createDiv({ cls: 'ls-wizard-progress-bar' });
		bar.style.width = `${((this.currentStep + 1) / this.steps.length) * 100}%`;
		
		// Content
		const content = contentEl.createDiv({ cls: 'ls-wizard-content' });
		
		switch(step) {
			case 'welcome':
				this.renderWelcome(content);
				break;
			case 'ai':
				this.renderAISetup(content);
				break;
			case 'audio':
				this.renderAudioSetup(content);
				break;
			case 'folders':
				this.renderFolders(content);
				break;
			case 'complete':
				this.renderComplete(content);
				break;
		}
		
		// Navigation
		const nav = contentEl.createDiv({ cls: 'ls-wizard-nav' });
		
		if (this.currentStep > 0 && step !== 'complete') {
			const backBtn = nav.createEl('button', { text: '← Back / 上一步', cls: 'ls-wizard-btn' });
			backBtn.onclick = () => {
				this.currentStep--;
				this.renderStep();
			};
		}
		
		if (step !== 'complete') {
			const nextBtn = nav.createEl('button', { 
				text: this.currentStep === this.steps.length - 2 ? 'Finish / 完成' : 'Next / 下一步 →', 
				cls: 'ls-wizard-btn ls-wizard-btn-primary' 
			});
			nextBtn.onclick = () => {
				this.currentStep++;
				this.renderStep();
			};
		} else {
			const closeBtn = nav.createEl('button', { text: 'Close / 关闭', cls: 'ls-wizard-btn ls-wizard-btn-primary' });
			closeBtn.onclick = async () => {
				// Mark setup as completed
				this.plugin.settings.hasCompletedSetup = true;
				await this.plugin.saveSettings();
				new Notice('✅ Setup completed! You can access settings anytime. / 设置完成！您可以随时访问设置。');
				this.close();
			};
		}
	}

	renderWelcome(container: HTMLElement) {
		container.createEl('h3', { text: '👋 Welcome to OB English Learner! / 欢迎使用 OB English Learner！' });
		container.createEl('p', { text: 'This wizard will help you configure the plugin for optimal use. / 此向导将帮助您配置插件以获得最佳使用体验。' });
		container.createEl('p', { text: 'You can always change these settings later in the plugin settings. / 您可以随时在插件设置中更改这些配置。' });
		
		const features = container.createEl('ul');
		features.createEl('li', { text: '📝 Import YouTube video transcripts / 导入 YouTube 视频字幕' });
		features.createEl('li', { text: '🤖 AI-powered translation and formatting / AI 智能翻译和格式化' });
		features.createEl('li', { text: '🎙️ Voice-to-text transcription / 语音转文字' });
		features.createEl('li', { text: '🔊 Text-to-speech audio generation / 文本转语音' });
	}

	renderAISetup(container: HTMLElement) {
		container.createEl('h3', { text: '🤖 AI Configuration / AI 配置' });
		container.createEl('p', { text: 'Configure AI for translation and text formatting. / 配置 AI 用于翻译和文本格式化。' });
		
		new Setting(container)
			.setName('AI Provider / AI 服务商')
			.addDropdown(dropdown => dropdown
				.addOption('deepseek', 'DeepSeek (推荐)')
				.addOption('openai', 'OpenAI')
				.addOption('gemini', 'Gemini')
				.setValue(this.plugin.settings.aiProvider || 'deepseek')
				.onChange(async (value: any) => {
					this.plugin.settings.aiProvider = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(container)
			.setName('API Key / API 密钥')
			.addText(text => text
				.setPlaceholder('sk-...')
				.setValue(this.plugin.settings.aiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.aiApiKey = value;
					await this.plugin.saveSettings();
				}));
	}

	renderAudioSetup(container: HTMLElement) {
		container.createEl('h3', { text: '🎙️ Audio Configuration / 音频配置' });
		container.createEl('p', { text: 'Configure voice-to-text and text-to-speech. / 配置语音转文字和文本转语音。' });
		
		// === Voice-to-Text (STT) Section ===
		const sttSection = container.createDiv({ cls: 'ls-wizard-section' });
		sttSection.createEl('h4', { text: '🎤 Voice-to-Text (STT) / 语音转文字' });
		
		new Setting(sttSection)
			.setName('Enable Voice-to-Text / 启用语音转文字')
			.setDesc('Record audio and convert to text / 录音并转换为文字')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableVoice2Text)
				.onChange(async (value) => {
					this.plugin.settings.enableVoice2Text = value;
					await this.plugin.saveSettings();
					this.renderStep(); // Refresh to show/hide settings
				}));
		
		// Show STT settings if enabled
		if (this.plugin.settings.enableVoice2Text) {
			new Setting(sttSection)
				.setName('STT Provider / STT 服务商')
				.setDesc('Service provider for speech recognition / 语音识别服务提供商')
				.addDropdown(dropdown => dropdown
					.addOption('openai', 'OpenAI (Whisper)')
					.addOption('azure', 'Azure')
					.addOption('assemblyai', 'AssemblyAI')
					.setValue(this.plugin.settings.sttProvider || 'openai')
					.onChange(async (value: any) => {
						this.plugin.settings.sttProvider = value;
						await this.plugin.saveSettings();
					}));
			
			new Setting(sttSection)
				.setName('STT API Key / STT API 密钥')
				.setDesc('Leave empty to use AI API Key (OpenAI only) / 留空则使用 AI API 密钥（仅限 OpenAI）')
				.addText(text => text
					.setPlaceholder('sk-... (optional for OpenAI)')
					.setValue(this.plugin.settings.sttApiKey)
					.onChange(async (value) => {
						this.plugin.settings.sttApiKey = value;
						await this.plugin.saveSettings();
					}));
		}
		
		// === Text-to-Speech (TTS) Section ===
		const ttsSection = container.createDiv({ cls: 'ls-wizard-section' });
		ttsSection.createEl('h4', { text: '🔊 Text-to-Speech (TTS) / 文本转语音' });
		
		new Setting(ttsSection)
			.setName('Enable Text-to-Speech / 启用文本转语音')
			.setDesc('Convert text to audio / 将文字转换为语音')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableTTS)
				.onChange(async (value) => {
					this.plugin.settings.enableTTS = value;
					await this.plugin.saveSettings();
					this.renderStep(); // Refresh to show/hide settings
				}));
		
		// Show TTS settings if enabled
		if (this.plugin.settings.enableTTS) {
			new Setting(ttsSection)
				.setName('TTS Provider / TTS 服务商')
				.setDesc('Service provider for text-to-speech / 文本转语音服务提供商')
				.addDropdown(dropdown => dropdown
					.addOption('openai', 'OpenAI')
					.addOption('azure', 'Azure')
					.addOption('elevenlabs', 'ElevenLabs')
					.setValue(this.plugin.settings.ttsProvider || 'openai')
					.onChange(async (value: any) => {
						this.plugin.settings.ttsProvider = value;
						await this.plugin.saveSettings();
					}));
			
			new Setting(ttsSection)
				.setName('TTS API Key / TTS API 密钥')
				.setDesc('Leave empty to use AI API Key / 留空则使用 AI API 密钥')
				.addText(text => text
					.setPlaceholder('sk-... (optional)')
					.setValue(this.plugin.settings.ttsApiKey)
					.onChange(async (value) => {
						this.plugin.settings.ttsApiKey = value;
						await this.plugin.saveSettings();
					}));
		}
	}

	renderFolders(container: HTMLElement) {
		container.createEl('h3', { text: '📁 Folder Configuration / 文件夹配置' });
		container.createEl('p', { text: 'Set up where your files will be saved. / 设置文件保存位置。' });
		
		new Setting(container)
			.setName('Video Notes Folder / 视频笔记目录')
			.addText(text => text
				.setPlaceholder('Languages/Videos')
				.setValue(this.plugin.settings.videoFolder)
				.onChange(async (value) => {
					this.plugin.settings.videoFolder = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(container)
			.setName('Audio Recordings Folder / 录音文件目录')
			.addText(text => text
				.setPlaceholder('recordings')
				.setValue(this.plugin.settings.audioFolder)
				.onChange(async (value) => {
					this.plugin.settings.audioFolder = value;
					await this.plugin.saveSettings();
				}));
	}

	renderComplete(container: HTMLElement) {
		container.createEl('h3', { text: '✅ Setup Complete! / 设置完成！' });
		container.createEl('p', { text: 'Your plugin is now configured and ready to use. / 您的插件现已配置完成，可以开始使用了。' });
		
		const tips = container.createEl('div', { cls: 'ls-wizard-tips' });
		tips.createEl('h4', { text: 'Quick Tips / 快速提示：' });
		const tipsList = tips.createEl('ul');
		tipsList.createEl('li', { text: 'Use Ctrl/Cmd + P and search "YouTube" to import videos / 按 Ctrl/Cmd + P 搜索 "YouTube" 导入视频' });
		tipsList.createEl('li', { text: 'Right-click selected text for AI translation options / 右键选中文本使用 AI 翻译' });
		tipsList.createEl('li', { text: 'Click the microphone icon to start voice recording / 点击麦克风图标开始录音' });
		tipsList.createEl('li', { text: 'Try the preset configurations for quick setup / 尝试预设配置快速设置' });
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Presets Modal
class PresetsModal extends Modal {
	plugin: LinguaSyncPlugin;
	settingTab: LinguaSyncSettingTab;

	constructor(app: App, plugin: LinguaSyncPlugin, settingTab: LinguaSyncSettingTab) {
		super(app);
		this.plugin = plugin;
		this.settingTab = settingTab;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ls-presets-modal');
		
		contentEl.createEl('h2', { text: '📋 Configuration Presets' });
		contentEl.createEl('p', { text: 'Choose a preset to quickly configure the plugin for your use case.' });
		
		this.renderPresets(contentEl);
	}

	renderPresets(container: HTMLElement) {
		const presets = [
			{
				name: '🎓 Language Learner',
				description: 'Optimized for learning languages from YouTube videos',
				config: {
					enableAITranslation: true,
					enableAIFormatting: true,
					enableVoice2Text: true,
					enableTTS: true,
					aiProvider: 'deepseek',
					defaultLanguage: 'en'
				}
			},
			{
				name: '📝 Content Creator',
				description: 'For creating notes and transcripts from videos',
				config: {
					enableAITranslation: false,
					enableAIFormatting: true,
					enableVoice2Text: true,
					enableTTS: false,
					aiProvider: 'openai',
					defaultLanguage: 'en'
				}
			},
			{
				name: '🎙️ Podcast Note-Taker',
				description: 'Voice recording and transcription focused',
				config: {
					enableAITranslation: false,
					enableAIFormatting: true,
					enableVoice2Text: true,
					enableTTS: true,
					saveAudio: true,
					sttProvider: 'openai'
				}
			},
			{
				name: '🚀 Minimal Setup',
				description: 'Basic configuration with minimal features',
				config: {
					enableAITranslation: false,
					enableAIFormatting: false,
					enableVoice2Text: false,
					enableTTS: false
				}
			}
		];

		presets.forEach(preset => {
			const card = container.createDiv({ cls: 'ls-preset-card' });
			card.createEl('h3', { text: preset.name });
			card.createEl('p', { text: preset.description });
			
			const applyBtn = card.createEl('button', { 
				text: 'Apply Preset', 
				cls: 'ls-preset-btn' 
			});
			applyBtn.onclick = async () => {
				await this.applyPreset(preset.config);
			};
		});
	}

	async applyPreset(config: any) {
		Object.assign(this.plugin.settings, config);
		await this.plugin.saveSettings();
		
		new Notice('✅ Preset applied successfully!');
		this.close();
		this.settingTab.display(); // Refresh settings UI
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
