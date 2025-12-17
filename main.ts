import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, setIcon, TFile, AbstractInputSuggest, TFolder, debounce, requestUrl, moment } from 'obsidian';
import { YouTubeScraper } from './src/scraper';
import { NoteGenerator } from './src/generator';
import { BasesIntegration } from './src/bases';
import { LinguaSyncSettings, CustomCommand, VideoData } from './src/types';
import { ProgressNotice } from './src/progress-notice';
import { PasswordManagerModal } from './src/password-manager';
import { AudioRecorder } from './src/voice/audio-recorder';
import { TranscriptionService } from './src/voice/transcription-service';
import { RecordingModal } from './src/voice/recording-modal';
import { TTSManager } from './src/tts/tts-manager';
import { ttsPanelExtension } from './src/tts/codemirror-extension';
import { CustomCommandManager } from './src/copilot/custom-commands';
import { CustomCommandSettingsUI } from './src/copilot/command-settings-ui';
import { YtDlpFetcher } from './src/yt-dlp-fetcher';

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
	// General - 优化后的默认文件夹结构
	defaultLanguage: 'en',
	targetLanguage: 'zh',
	videoFolder: '01-Videos',  // 简化路径，更直观
	assetsFolder: 'Languages/Assets',  // 已废弃，保留用于兼容
	subtitlesFolder: '02-Subtitles',  // 简化路径
	thumbnailsFolder: '01-Videos',  // 封面图与视频笔记放在一起
	autoDownloadThumbnails: true,
	generateBilingualTranscript: true,
	// AI Translation & Formatting - 默认开启核心功能
	enableAITranslation: true,  // ✅ 默认开启 AI 翻译
	enableAIFormatting: true,   // ✅ 默认开启智能分段（Note content）
	enableAISubtitles: true,    // ✅ 默认开启 SRT 优化
	aiFormattingPrompt: DEFAULT_FORMATTING_PROMPT,
	aiProvider: 'deepseek',  // DeepSeek 性价比最高
	aiApiKey: '',  // ⚠️ 需要用户配置
	aiModel: 'deepseek-chat',
	aiBaseUrl: 'https://api.deepseek.com/v1/chat/completions',
	aiPerformanceMode: 'fast',  // ⚡ 快速模式（已优化）
	// Voice to Text - 默认配置
	enableVoice2Text: true,  // ✅ 默认开启语音识别
	sttProvider: 'openai',  // Whisper 质量最好
	sttApiKey: '',  // ⚠️ 可留空，使用主 API Key
	sttLanguage: '',  // 自动检测
	sttModel: 'whisper-1',
	sttBaseUrl: 'https://api.openai.com/v1/audio/transcriptions',
	saveAudio: true,  // 默认保存录音文件
	audioFolder: '03-Recordings',  // 统一的录音文件夹
	audioFormat: 'wav',  // 无损格式
	audioFilenameTemplate: 'Recording_{{date:YYYY-MM-DD}}_{{time:HH-mm-ss}}',
	recordOnlyMode: false,  // 默认关闭只录音模式
	// Text to Speech - 优化后的默认设置
	enableTTS: true,  // ✅ 默认开启 TTS
	ttsProvider: 'openai',  // OpenAI 质量最好
	ttsApiKey: '',  // ⚠️ 可留空，使用主 API Key
	ttsModel: 'tts-1-hd',  // 默认高清模型
	ttsVoice: 'nova',  // Nova 女声，发音清晰自然
	ttsSpeed: 1.0,
	ttsBaseUrl: '',
	ttsOutputFormat: 'mp3',  // MP3 格式，兼容性好
	// TTS Advanced - 匹配 Aloud 的体验
	ttsShowPlayer: 'always',  // 始终显示播放器
	ttsAutoscroll: true,  // 自动滚动到当前句子
	ttsCacheType: 'local',  // 本地缓存，节省成本
	ttsCacheDuration: 168,  // 缓存 7 天（24 * 7）
	ttsAudioFolder: '03-Resources/aloud',  // 音频文件存储位置
	ttsChunking: 'sentence',  // 按句子分块
	// Template
	noteTemplate: DEFAULT_TEMPLATE,
	// Account / Credentials
	credentials: [],
	// Custom Commands
	customCommandsFolder: '03-Resources/copilot-custom-prompts',
	customCommandTemplating: true,
	customCommandSortStrategy: 'recency',
	customCommands: [],
	ribbonCommandId: '',  // Will be set to first custom command on load
	ribbonCommandId2: '', // Second quick action button
	// Vault QA
	enableVaultQA: false,
	qaSearchFolders: [],
	qaExcludeFolders: ['.obsidian'],
	qaMaxSources: 5,
};

export default class LinguaSyncPlugin extends Plugin {
	settings: LinguaSyncSettings;
	recorder: AudioRecorder;
	transcriptionService: TranscriptionService;
	ttsManager: TTSManager;
	customCommandManager: CustomCommandManager;
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
		this.customCommandManager = new CustomCommandManager(this.app);

		// Load custom commands after workspace is ready
		this.app.workspace.onLayoutReady(async () => {
			await this.loadCustomCommands();
			console.log('[LinguaSync] Custom commands loaded on workspace ready');

			// Check yt-dlp installation on first load
			await this.checkYtDlpInstallation();
		});

		// Add ribbon icon
		this.addRibbonIcon('video', 'Import YouTube Video', () => {
			new YouTubeInputModal(this.app, async (url) => {
				await this.importVideo(url);
			}).open();
		});

		// Add customizable quick action ribbon button
		this.addCustomRibbonButton();

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
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'r' }],
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.startRecording(editor, view);
			}
		});

		// ==================== TTS Commands (Aloud-style) ====================

		// Command: Play/Pause (with hotkey)
		this.addCommand({
			id: 'tts-play-pause',
			name: 'Aloud: Play/Pause',
			hotkeys: [{ modifiers: ['Mod'], key: 'Space' }],
			editorCallback: (editor: Editor) => {
				const state = this.ttsManager.getState();
				if (state === 'playing') {
					this.ttsManager.pause();
					new Notice('⏸ Paused');
				} else if (state === 'paused') {
					this.ttsManager.resume();
					new Notice('▶ Resumed');
				} else {
					this.speakSelection(editor);
				}
			}
		});

		// Command: Stop (with hotkey)
		this.addCommand({
			id: 'tts-stop',
			name: 'Aloud: Stop',
			hotkeys: [{ modifiers: [], key: 'Escape' }],
			callback: () => {
				this.ttsManager.stop();
				new Notice('⏹ Stopped');
			}
		});

		// Command: Next sentence (with hotkey)
		this.addCommand({
			id: 'tts-next-sentence',
			name: 'Aloud: Next sentence',
			hotkeys: [{ modifiers: ['Mod'], key: 'ArrowRight' }],
			callback: () => {
				this.ttsManager.next();
				new Notice('⏭ Next sentence');
			}
		});

		// Command: Previous sentence (with hotkey)
		this.addCommand({
			id: 'tts-previous-sentence',
			name: 'Aloud: Previous sentence',
			hotkeys: [{ modifiers: ['Mod'], key: 'ArrowLeft' }],
			callback: () => {
				this.ttsManager.previous();
				new Notice('⏮ Previous sentence');
			}
		});

		// Command: Increase playback speed (with hotkey)
		this.addCommand({
			id: 'tts-increase-speed',
			name: 'Aloud: Increase playback speed',
			hotkeys: [{ modifiers: ['Mod'], key: 'ArrowUp' }],
			callback: () => {
				const currentSpeed = this.settings.ttsSpeed || 1.0;
				const newSpeed = Math.min(Math.round((currentSpeed + 0.1) * 20) / 20, 2.5);
				this.settings.ttsSpeed = newSpeed;
				this.ttsManager.setPlaybackSpeed(newSpeed);
				this.saveSettings();
				new Notice(`⚡ Speed: ${newSpeed.toFixed(2)}x`);
			}
		});

		// Command: Decrease playback speed (with hotkey)
		this.addCommand({
			id: 'tts-decrease-speed',
			name: 'Aloud: Decrease playback speed',
			hotkeys: [{ modifiers: ['Mod'], key: 'ArrowDown' }],
			callback: () => {
				const currentSpeed = this.settings.ttsSpeed || 1.0;
				const newSpeed = Math.max(Math.round((currentSpeed - 0.1) * 20) / 20, 0.5);
				this.settings.ttsSpeed = newSpeed;
				this.ttsManager.setPlaybackSpeed(newSpeed);
				this.saveSettings();
				new Notice(`⚡ Speed: ${newSpeed.toFixed(2)}x`);
			}
		});

		// Command: Toggle autoscroll
		this.addCommand({
			id: 'tts-toggle-autoscroll',
			name: 'Aloud: Toggle autoscroll',
			callback: () => {
				this.settings.ttsAutoscroll = !this.settings.ttsAutoscroll;
				this.saveSettings();
				const icon = this.settings.ttsAutoscroll ? '👁️' : '🚫';
				const status = this.settings.ttsAutoscroll ? 'enabled' : 'disabled';
				new Notice(`${icon} Autoscroll ${status}`);
			}
		});

		// Command: Play selection
		this.addCommand({
			id: 'tts-play-selection',
			name: 'Aloud: Play selection',
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'p' }],
			editorCallback: (editor: Editor) => {
				this.speakSelection(editor);
			}
		});

		// Command: Play from clipboard
		this.addCommand({
			id: 'tts-play-clipboard',
			name: 'Aloud: Play from clipboard',
			callback: async () => {
				try {
					const text = await navigator.clipboard.readText();
					if (text) {
						// Create a dummy editor for clipboard playback
						const dummyEditor: any = {
							getCursor: () => ({ line: 0, ch: 0 }),
							posToOffset: (pos: any) => 0,
							offsetToPos: (offset: number) => ({ line: 0, ch: 0 }),
							scrollIntoView: () => { }
						};
						this.ttsManager.playSelection(text, dummyEditor, { line: 0, ch: 0 }, { line: 0, ch: text.length });
					} else {
						new Notice('Clipboard is empty');
					}
				} catch (err) {
					new Notice('Failed to read clipboard: ' + err.message);
					console.error(err);
				}
			}
		});

		// Command: Export selection to audio file
		this.addCommand({
			id: 'tts-export-selection',
			name: 'Aloud: Export selection to audio',
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'e' }],
			editorCallback: async (editor: Editor) => {
				const text = editor.getSelection();
				if (text) {
					await this.exportTextToAudio(text, false);
				} else {
					new Notice('No text selected');
				}
			}
		});

		// Command: Paste clipboard as audio embed
		this.addCommand({
			id: 'tts-paste-as-audio',
			name: 'Aloud: Paste clipboard as audio',
			editorCallback: async (editor: Editor) => {
				try {
					const text = await navigator.clipboard.readText();
					if (text) {
						await this.exportTextToAudio(text, true, editor);
					} else {
						new Notice('Clipboard is empty');
					}
				} catch (err) {
					new Notice('Failed to read clipboard: ' + err.message);
					console.error(err);
				}
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

				// Add Custom Commands submenu
				if (!this.customCommandManager) {
					console.error('[LinguaSync] customCommandManager not initialized');
					return;
				}

				const contextMenuCommands = this.customCommandManager.getContextMenuCommands();

				if (contextMenuCommands.length > 0) {
					menu.addItem((item) => {
						item.setTitle('English Learner');
						item.setIcon('languages');

						// Create submenu
						(item as any).setSubmenu();
						const submenu = (item as any).submenu;

						if (!submenu) {
							console.error('[LinguaSync] Failed to create submenu');
							return;
						}

						// Add each custom command to submenu
						contextMenuCommands.forEach(command => {
							submenu.addItem((subItem: any) => {
								subItem.setTitle(command.title).onClick(async () => {
									await this.executeCustomCommand(command, editor);
								});
							});
						});
					});
				}
			})
		);

		// Command: Import YouTube Video
		this.addCommand({
			id: 'import-youtube-video',
			name: 'Import YouTube Video',
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'y' }],
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

	/**
	 * Check if yt-dlp is installed and show installation guidance if not
	 * @returns Object with installation status and version (if installed)
	 */
	async checkYtDlpInstallation(): Promise<{ installed: boolean; version?: string }> {
		try {
			const installed = await YtDlpFetcher.isYtDlpInstalled();

			if (installed) {
				const version = await YtDlpFetcher.getVersion();
				console.log(`[LinguaSync] ✅ yt-dlp detected: v${version}`);
				
				// Mark setup as completed if yt-dlp is installed
				if (!this.settings.hasCompletedSetup) {
					this.settings.hasCompletedSetup = true;
					await this.saveSettings();
				}
				
				return { installed: true, version };
			} else {
				console.warn('[LinguaSync] ⚠️ yt-dlp not installed');

				// Show installation modal only if not completed setup
				// Or if user explicitly wants to see it
				if (!this.settings.hasCompletedSetup) {
					new YtDlpInstallModal(this.app, async (dontShowAgain) => {
						if (dontShowAgain) {
							this.settings.hasCompletedSetup = true;
							await this.saveSettings();
						}
					}).open();
				}
				
				return { installed: false };
			}
		} catch (error) {
			console.error('[LinguaSync] Failed to check yt-dlp:', error);
			return { installed: false };
		}
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

						// 2. Transcribe (跳过如果是只录音模式)
						let transcription = '';

						if (this.settings.recordOnlyMode) {
							// 只录音模式：跳过转录
							new Notice('✅ Audio saved! (Record-only mode, no transcription)');
						} else {
							// 正常模式：进行转录
							const notice = new Notice('Transcribing audio... ⏳', 0);

							try {
								transcription = await this.transcriptionService.transcribe(audioBlob, this.settings.audioFormat);
								notice.hide();
								new Notice('✅ Transcription complete!');
							} catch (err) {
								notice.hide();
								new Notice('❌ Transcription failed: ' + err.message);
								console.error(err);
							}
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

		// Get selection range
		const from = editor.getCursor('from');
		const to = editor.getCursor('to');

		try {
			await this.ttsManager.playSelection(selection, editor, from, to);
		} catch (error) {
			new Notice('TTS Failed: ' + error.message);
			console.error(error);
		}
	}

	async exportTextToAudio(text: string, replaceSelection: boolean = false, providedEditor?: Editor) {
		if (!this.settings.enableTTS) {
			new Notice('Please enable Text to Speech in settings first.');
			return;
		}

		if (!text || text.trim().length === 0) {
			new Notice('No text to export.');
			return;
		}

		// Generate filename: prefix-hash.ext (like Aloud)
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

		// Determine file extension based on output format
		let extension = 'mp3'; // Default
		if (this.settings.ttsProvider === 'azure' && this.settings.ttsOutputFormat) {
			const format = this.settings.ttsOutputFormat.toLowerCase();
			// Azure WAV formats: riff-*-pcm
			if (format.includes('riff') || format.includes('pcm') || format.includes('wav')) {
				extension = 'wav';
			} else if (format.includes('mp3')) {
				extension = 'mp3';
			} else if (format.includes('ogg') || format.includes('opus')) {
				extension = 'ogg';
			} else if (format.includes('webm')) {
				extension = 'webm';
			}
		}

		const folder = this.settings.ttsAudioFolder || '03-Resources/aloud';
		const filename = `${prefix}-${hashStr}.${extension}`;
		const filepath = `${folder}/${filename}`;

		// Get editor (use provided editor or get active one)
		const editor = providedEditor || this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

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
			try {
				await this.app.vault.createFolder(folderPath);
			} catch (err) {
				if (!err.message || !err.message.includes('Folder already exists')) {
					throw err;
				}
			}
		}

		const arrayBuffer = await audioBlob.arrayBuffer();
		await this.app.vault.createBinary(filePath, arrayBuffer);

		return filePath;
	}

	async importVideo(url: string) {
		// 流程：
		// 1. 同步：获取字幕 → AI格式化 → 创建笔记 → 开始学习
		// 2. 异步后台：翻译 + SRT导出 → 完成通知
		const totalSteps = 6;
		const progress = new ProgressNotice(totalSteps);

		try {
			// Step 1: Extract video ID (0% -> 5%)
			progress.setProgress(0, 'Extracting video ID...');
			const videoId = YouTubeScraper.extractVideoId(url);
			if (!videoId) {
				throw new Error('Invalid YouTube URL');
			}
			progress.setProgress(5, 'Video ID extracted');

			// Check if this video was already imported
			const existingNote = await this.findExistingNote(url, videoId);
			const isUpdate = existingNote !== null;

			if (isUpdate) {
				console.log('[LinguaSync] 🔄 Video already imported, updating note only...');
				progress.updateMessage('Video already exists, updating...');
			}

			// Step 2: Fetch English subtitles (5% -> 20%)
			progress.setProgress(10, 'Fetching English subtitles...');
			console.log('[LinguaSync] 📥 Fetching English subtitles...');

			// Fetch video data WITHOUT AI translation (translation goes to background)
			const videoData = await YouTubeScraper.fetchVideoData(url, undefined);

			progress.setProgress(20, 'Subtitles fetched');
			console.log(`[LinguaSync] ✅ Got ${videoData.transcript.length} transcript lines`);

			// Step 3: AI Formatting - SYNC (20% -> 60%)
			// This is required for Language Learner plugin to work properly
			if (this.settings.enableAIFormatting && this.settings.aiApiKey &&
				videoData.transcript[0]?.lang?.startsWith('en')) {

				progress.setProgress(25, 'AI formatting transcript...');
				console.log('[LinguaSync] 🤖 AI formatting transcript (sync - required for learning)...');

				try {
					const { AITranslator } = await import('./src/translator');
					const translator = new AITranslator({
						provider: this.settings.aiProvider,
						apiKey: this.settings.aiApiKey,
						model: this.settings.aiModel,
						baseUrl: this.settings.aiBaseUrl,
						performanceMode: this.settings.aiPerformanceMode
					});

					// Format transcript with punctuation and paragraphs
					const customPrompt = this.settings.aiFormattingPrompt || undefined;
					videoData.formattedTranscriptText = await translator.formatTranscript(
						videoData.transcript,
						customPrompt
					);

					progress.setProgress(55, 'AI formatting completed');
					console.log(`[LinguaSync] ✅ AI formatting completed (${videoData.formattedTranscriptText.length} chars)`);
				} catch (error) {
					console.error('[LinguaSync] AI formatting failed:', error);
					new Notice(`AI formatting failed: ${error.message}. Using default format.`);
					// Continue without formatting
				}
			}

			// Step 4: Create note with formatted English content (60% -> 85%)
			progress.setProgress(60, 'Creating note...');
			console.log('[LinguaSync] 📝 Creating note with formatted English content...');

			const generator = new NoteGenerator(this.app, this.settings);

			// Create note WITH formatting but WITHOUT SRT files (SRT goes to background)
			const file = await generator.createVideoNote(videoData, isUpdate, true);

			// Step 5: Success! Open note for learning (85% -> 100%)
			progress.setProgress(90, 'Opening note...');

			if (isUpdate) {
				progress.success(`✅ Updated: ${file.basename}`);
			} else {
				progress.success(`✅ Created: ${file.basename}`);
			}

			// Open the note immediately - user can start learning with Language Learner!
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);

			console.log('[LinguaSync] ✅ Note ready for learning with Language Learner!');

			// ===============================================
			// 🔄 BACKGROUND: Translation + SRT Export
			// ===============================================

			// User is now learning. Background: translate and export SRT
			this.processInBackground(videoData, generator);

		} catch (error) {
			progress.error(error.message);
			console.error('Import failed:', error);
		}
	}


	/**
	 * Background task: Handle ALL AI processing and SRT generation
	 * This runs AFTER the note is created, so user can start learning immediately
	 */
	private async processInBackground(videoData: VideoData, generator: NoteGenerator) {
		const fileName = generator.getFileName(videoData.metadata.title);
		const title = videoData.metadata.title.substring(0, 30);

		console.log('[LinguaSync] 🔄 Starting background processing...');

		try {
			// Step 1: AI Translation (if needed and enabled)
			const needsTranslation = !videoData.translatedTranscript &&
				this.settings.enableAITranslation &&
				this.settings.aiApiKey;

			if (needsTranslation) {
				console.log('[LinguaSync] 🔄 Background: Performing AI translation...');

				// Show initial notice
				new Notice(`🔄 开始翻译字幕: ${title}...`, 3000);

				const { AITranslator } = await import('./src/translator');
				const translator = new AITranslator({
					provider: this.settings.aiProvider,
					apiKey: this.settings.aiApiKey,
					model: this.settings.aiModel,
					baseUrl: this.settings.aiBaseUrl,
					performanceMode: this.settings.aiPerformanceMode
				});

				const startTime = Date.now();

				// Use progress callback for real-time updates
				videoData.translatedTranscript = await translator.translateTranscript(
					videoData.transcript,
					(currentBatch, totalBatches, percentage) => {
						// Calculate estimated time remaining
						const elapsed = (Date.now() - startTime) / 1000;
						const estimatedTotal = (elapsed / currentBatch) * totalBatches;
						const remaining = Math.max(0, estimatedTotal - elapsed);

						// Show progress notification
						new Notice(
							`🔄 翻译中: ${currentBatch}/${totalBatches} (${Math.round(percentage)}%) | 剩余 ~${Math.round(remaining)}秒`,
							2500
						);
					}
				);

				const totalTime = Math.round((Date.now() - startTime) / 1000);
				console.log(`[LinguaSync] ✅ Background translation completed: ${videoData.translatedTranscript.length} lines in ${totalTime}s`);
				new Notice(`✅ 翻译完成! 用时 ${totalTime}秒`, 3000);
			}

			// Step 2: Generate SRT files
			console.log('[LinguaSync] 🔄 Background: Generating SRT files...');
			new Notice(`📝 正在生成字幕文件...`, 2000);

			await generator.ensureSRTFiles(
				videoData.transcript,
				videoData.translatedTranscript,
				fileName
			);

			// Notify user that background tasks are complete
			new Notice(`🎉 字幕文件已生成: ${title}...`, 5000);
			console.log('[LinguaSync] ✅ Background processing completed!');

		} catch (error) {
			console.error('[LinguaSync] ❌ Background processing failed:', error);
			new Notice(`⚠️ 后台处理失败: ${error.message}`, 8000);
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
		// Fetch transcript from YouTube (10% -> 15%)
		progress.setProgress(10, 'Fetching video data...');

		// Note: AI translation is handled separately in importVideo with fine-grained progress
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
		// Cleanup styles
		const styleEl = document.getElementById('ls-mac-styles');
		if (styleEl) {
			styleEl.remove();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.transcriptionService.updateSettings(this.settings);
	}

	async loadCustomCommands() {
		try {
			console.log('[Custom Commands] Loading from folder:', this.settings.customCommandsFolder);
			const commands = await this.customCommandManager.loadCommandsFromFolder(this.settings.customCommandsFolder);
			console.log('[Custom Commands] Loaded', commands.length, 'commands:', commands.map(c => c.title));
			this.settings.customCommands = commands;

			// Update the manager's commands list
			this.customCommandManager.setCustomCommands(commands);

			// Set default ribbon command to first custom command if not set
			if (!this.settings.ribbonCommandId && commands.length > 0) {
				this.settings.ribbonCommandId = `custom-${commands[0].title}`;
				await this.saveSettings();
				console.log('[Custom Commands] Set default ribbon command to:', commands[0].title);
			}
		} catch (err) {
			console.error('Failed to load custom commands:', err);
			new Notice('⚠️ Failed to load custom commands. Check console for details.');
		}
	}

	async executeCustomCommand(command: CustomCommand, editor: any) {
		// Get the selected text or use empty string
		const selection = editor.getSelection() || '';

		if (!selection) {
			new Notice('⚠️ Please select some text first');
			return;
		}

		// Execute command to get processed content
		const processedContent = this.customCommandManager.executeCommand(command.title, selection);

		// Check if AI is configured
		if (!this.settings.aiApiKey || !this.settings.aiApiKey.trim()) {
			new Notice('❌ AI API Key not configured. Please set it in Settings → AI.');
			return;
		}

		// Show loading notice
		const loadingNotice = new Notice(`⏳ ${command.title}...`, 0);

		try {
			// Import and create AI translator
			const { AITranslator } = await import('./src/translator');
			const translator = new AITranslator({
				provider: this.settings.aiProvider,
				apiKey: this.settings.aiApiKey,
				model: this.settings.aiModel,
				baseUrl: this.settings.aiBaseUrl,
				performanceMode: this.settings.aiPerformanceMode
			});

			// Prepare initial output: original text + separator
			const initialOutput = `${selection}\n\n`;

			// Get cursor position
			const cursorStart = editor.getCursor();

			// Replace selection with original text + newlines
			editor.replaceSelection(initialOutput);

			// Move cursor to end of inserted text
			const doc = editor.getDoc();
			const insertedLines = initialOutput.split('\n').length - 1;
			const newCursor = {
				line: cursorStart.line + insertedLines,
				ch: 0
			};
			editor.setCursor(newCursor);

			// Hide loading notice now that we're streaming
			loadingNotice.hide();
			new Notice(`🤖 ${command.title} streaming...`);

			// Stream AI response and insert in real-time
			await translator.callAIStream(processedContent, (chunk) => {
				// Insert chunk at current cursor position
				const cursor = editor.getCursor();
				editor.replaceRange(chunk, cursor);

				// Move cursor to end of inserted chunk
				const lines = chunk.split('\n');
				const lastLineLength = lines[lines.length - 1].length;
				const newPos = {
					line: cursor.line + lines.length - 1,
					ch: lines.length === 1 ? cursor.ch + lastLineLength : lastLineLength
				};
				editor.setCursor(newPos);
			});

			// Show success notice
			new Notice(`✅ ${command.title} completed`);

		} catch (error: any) {
			console.error('AI generation error:', error);
			loadingNotice.hide();
			new Notice(`❌ Error: ${error.message}`);
		}
	}

	// Get available commands for Ribbon quick action (Custom Commands)
	getAvailableCommands(): Array<{ id: string, name: string, icon: string }> {
		const commands: Array<{ id: string, name: string, icon: string }> = [];

		// Add custom commands if loaded
		if (this.customCommandManager && this.settings.customCommands) {
			this.settings.customCommands.forEach(cmd => {
				commands.push({
					id: `custom-${cmd.title}`,  // Prefix to identify as custom command
					name: cmd.title,
					icon: 'zap'  // Lightning icon for all custom commands
				});
			});
		}

		// Fallback: if no custom commands, add some default options
		if (commands.length === 0) {
			commands.push(
				{ id: 'import-youtube-video', name: 'Import YouTube Video', icon: 'video' },
				{ id: 'start-voice-recording', name: 'Start Voice Recording', icon: 'microphone' }
			);
		}

		return commands;
	}

	// Store ribbon icon references for dynamic updates
	private ribbonIcon1: HTMLElement | null = null;
	private ribbonIcon2: HTMLElement | null = null;

	// Add customizable Ribbon button based on settings
	addCustomRibbonButton() {
		// Create first button (icon: zap ⚡)
		this.ribbonIcon1 = this.createRibbonButton(
			this.settings.ribbonCommandId,
			'zap',
			'Quick Action 1'
		);

		// Create second button (icon: star ⭐)
		this.ribbonIcon2 = this.createRibbonButton(
			this.settings.ribbonCommandId2,
			'star',
			'Quick Action 2'
		);
	}

	// Helper to create a single ribbon button
	private createRibbonButton(commandId: string, icon: string, label: string): HTMLElement | null {
		if (!commandId) return null;

		// Check if it's a custom command
		if (commandId.startsWith('custom-')) {
			const commandTitle = commandId.replace('custom-', '');
			const command = this.settings.customCommands.find(cmd => cmd.title === commandTitle);

			if (command) {
				return this.addRibbonIcon(icon, `${label}: ${command.title}`, async () => {
					// Execute custom command
					const view = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (view && view.editor) {
						await this.executeCustomCommand(command, view.editor);
					} else {
						new Notice('⚠️ Please open a note to use this command');
					}
				});
			}
		} else {
			// Fallback: built-in command
			const builtInCommands = [
				{ id: 'import-youtube-video', name: 'Import YouTube Video', icon: 'video' },
				{ id: 'start-voice-recording', name: 'Start Voice Recording', icon: 'microphone' }
			];

			const commandInfo = builtInCommands.find(cmd => cmd.id === commandId);
			if (commandInfo) {
				return this.addRibbonIcon(icon, `${label}: ${commandInfo.name}`, () => {
					(this.app as any).commands.executeCommandById(commandInfo.id);
				});
			}
		}
		return null;
	}

	// Update ribbon buttons dynamically (without reload)
	updateRibbonButton(buttonNum: 1 | 2, newCommandId: string) {
		if (buttonNum === 1) {
			// Remove old button
			if (this.ribbonIcon1) {
				this.ribbonIcon1.remove();
			}
			// Create new button
			this.settings.ribbonCommandId = newCommandId;
			this.ribbonIcon1 = this.createRibbonButton(newCommandId, 'zap', 'Quick Action 1');
		} else {
			// Remove old button 2
			if (this.ribbonIcon2) {
				this.ribbonIcon2.remove();
			}
			// Create new button 2
			this.settings.ribbonCommandId2 = newCommandId;
			this.ribbonIcon2 = this.createRibbonButton(newCommandId, 'star', 'Quick Action 2');
		}
	}


	injectStyles() {
		// Remove existing styles to ensure updates are applied
		const existingStyle = document.getElementById('ls-mac-styles');
		if (existingStyle) {
			existingStyle.remove();
		}

		const styleEl = document.createElement('style');
		styleEl.id = 'ls-mac-styles';
		styleEl.textContent = `
			/* === Apple Style Settings UI === */
			/* Variables */
			:root {
				--ls-color-primary: #007AFF; /* Apple Blue */
				--ls-color-success: #34C759; /* Apple Green */
				--ls-color-warning: #FF9500; /* Apple Orange */
				--ls-color-danger: #FF3B30;  /* Apple Red */
				--ls-bg-card: var(--background-primary);
				--ls-bg-page: var(--background-secondary);
				--ls-border-color: var(--background-modifier-border);
				--ls-text-primary: var(--text-normal);
				--ls-text-secondary: var(--text-muted);
				--ls-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
				--ls-radius-lg: 10px;
				--ls-radius-md: 8px;
				--ls-radius-sm: 6px;
			}

			/* Reset & Base */
			.ls-header, .ls-tab-nav, .ls-tab-content {
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			}

			/* === Header === */
			.ls-header { 
				text-align: center;
				margin-bottom: 32px; 
				padding: 24px 20px 16px;
				background: transparent;
			}
			.ls-title { 
				font-size: 24px; 
				font-weight: 600; 
				margin-bottom: 0;
				color: var(--ls-text-primary);
				letter-spacing: -0.02em;
			}

			/* === Tab Navigation (Segmented Control Style) === */
			.ls-tab-nav {
				display: flex;
				justify-content: center;
				background: var(--background-modifier-form-field);
				border-radius: 8px;
				padding: 2px;
				margin: 0 auto 32px;
				width: fit-content;
				max-width: 100%;
				overflow-x: auto;
			}
			
			.ls-tab-item {
				cursor: pointer;
				padding: 6px 16px;
				border-radius: 6px;
				font-size: 13px;
				font-weight: 500;
				color: var(--ls-text-secondary);
				transition: all 0.2s ease;
				white-space: nowrap;
				user-select: none;
				border: none; /* Removed bottom border */
				margin: 0;    /* Removed margin */
			}
			
			.ls-tab-item:hover {
				color: var(--ls-text-primary);
			}
			
			.ls-tab-item.is-active {
				background: var(--background-primary);
				color: var(--ls-text-primary);
				box-shadow: 0 1px 3px rgba(0,0,0,0.1);
				font-weight: 600;
			}
			
			/* Removed bilingual labels structure */
			.ls-tab-label-en { display: none; } 
			.ls-tab-label-cn { font-size: 13px; }

			/* === Content Area === */
			.ls-tab-content {
				max-width: 720px; /* Optimal reading width */
				margin: 0 auto;
				padding: 0 16px;
			}
			
			.ls-section {
				margin-bottom: 32px;
			}
			
			/* Section Title (Group Label) */
			.ls-section-title {
				font-size: 13px;
				font-weight: 500;
				color: var(--ls-text-secondary);
				text-transform: uppercase;
				letter-spacing: 0.05em;
				margin: 0 0 8px 12px;
				padding: 0;
				border: none; /* Removed left border */
			}
			
			/* Card (Settings Group) */
			.ls-card {
				background: var(--ls-bg-card);
				border-radius: var(--ls-radius-lg);
				border: 1px solid var(--ls-border-color);
				overflow: hidden;
				margin-bottom: 24px;
			}
			
			/* Card Title - Removed (Use Section Title instead) */
			.ls-card-title {
				display: none; 
			}

			/* Setting Item */
			.ls-card .setting-item {
				border-bottom: 1px solid var(--ls-border-color);
				padding: 14px 16px;
			}
			
			.ls-card .setting-item:last-child {
				border-bottom: none;
			}

			.ls-card .setting-item-info {
				margin-right: 12px;
				min-width: 0;
				flex: 1;
			}

			.ls-card .setting-item-name {
				font-size: 15px;
				font-weight: 400;
				color: var(--ls-text-primary);
				word-wrap: break-word;
			}

			.ls-card .setting-item-description {
				font-size: 12px;
				color: var(--ls-text-secondary);
				margin-top: 4px;
				line-height: 1.4;
				word-wrap: break-word;
				white-space: normal;
			}

			/* Inputs & Controls */
			.ls-card input[type="text"], 
			.ls-card select, 
			.ls-card textarea {
				background: var(--background-modifier-form-field);
				border: 1px solid transparent;
				border-radius: 6px;
				padding: 6px 10px;
				font-size: 14px;
				transition: all 0.2s ease;
			}

			.ls-card input[type="text"] {
				min-width: 260px !important;
				max-width: 100%;
			}

			.ls-card select {
				min-width: 400px !important;
				max-width: 100%;
				width: auto !important;
				padding: 8px 30px 8px 10px !important;
				line-height: 1.6 !important;
				height: auto !important;
			}

			.ls-card textarea {
				min-width: 260px !important;
				max-width: 100%;
			}

			/* Exception for Property Manager */
			.ls-card .ls-property-row input[type="text"] {
				min-width: 50px;
			}

			.ls-card input[type="text"]:focus, 
			.ls-card select:focus, 
			.ls-card textarea:focus {
				border-color: var(--ls-color-primary);
				outline: none;
			}

			/* Buttons */
			button.mod-cta {
				background-color: var(--ls-color-primary);
				font-weight: 500;
			}
			
			button:not(.mod-cta) {
				background-color: var(--background-modifier-form-field);
			}

			/* Status Badges */
			.ls-status-badge {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				padding: 2px 8px;
				border-radius: 12px; /* Pill shape */
				font-size: 11px;
				font-weight: 500;
				margin-left: 8px;
				background: var(--background-secondary);
			}
			.ls-status-dot {
				width: 6px;
				height: 6px;
				border-radius: 50%;
				background-color: currentColor;
			}
			.ls-status-configured { color: var(--color-green); border-color: var(--color-green); }
			.ls-status-warning { color: var(--color-orange); border-color: var(--color-orange); }
			.ls-status-not-set { color: var(--color-red); border-color: var(--color-red); }

			/* === Animations === */
			/* Removed animations for minimal feel */


			/* === TTS Player Panel (Aloud Style) === */
			.tts-toolbar {
				display: flex;
				width: 100%;
				padding: 8px 12px;
				background: var(--background-secondary);
				border-bottom: 1px solid var(--background-modifier-border);
				z-index: 1000;
			}
			
			.tts-toolbar-player {
				display: flex;
				flex-direction: row;
				align-items: center;
				gap: 8px;
				width: 100%;
			}
			
			.tts-toolbar-player-button-group {
				display: flex;
				flex-direction: row;
				align-items: center;
				gap: 4px;
			}
			
			.tts-toolbar-button {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 28px;
				height: 28px;
				padding: 4px;
				border-radius: 4px;
				background: transparent;
				border: none;
				cursor: pointer;
				transition: all 0.2s ease;
			}
			
			.tts-toolbar-button.tts-toolbar-button-active {
				color: var(--interactive-accent);
			}
			
			.tts-toolbar-button:not(.tts-toolbar-button-active) {
				color: var(--text-muted);
			}
			
			.tts-toolbar-button:hover {
				color: var(--interactive-accent) !important;
				background: var(--background-modifier-hover);
			}
			
			.tts-toolbar-button.is-disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
			
			.tts-toolbar-button.speed {
				font-size: 11px;
				font-weight: 600;
				width: auto;
				min-width: 40px;
				padding: 4px 8px;
			}
			
			.tts-audio-status-container {
				flex: 1 1 auto;
				display: flex;
				overflow: hidden;
				align-items: center;
				justify-content: center;
				font-size: var(--font-ui-small);
				color: var(--text-muted);
				min-width: 60px;
			}
			
			.tts-progress-bar-container {
				position: absolute;
				bottom: 0;
				left: 0;
				right: 0;
				height: 2px;
				background: var(--background-modifier-border);
			}
			
			.tts-progress-bar-fill {
				height: 100%;
				background: var(--interactive-accent);
				transition: width 0.3s ease;
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

			/* Audio Visualizer */
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

			/* === Voice Recording Modal === */
			.voice2text-modeless-container {
				pointer-events: none;
			}
			
			.recording-modal {
				width: 300px;
				max-width: 90vw;
				border-radius: 12px;
				box-shadow: 0 8px 24px rgba(0,0,0,0.3);
			}
			
			.voice2text-modal-container {
				padding: 16px;
				background: var(--background-primary);
			}
			
			.voice2text-waveform-container {
				margin-bottom: 12px;
				background: #1a1a1a;
				border-radius: 8px;
				overflow: hidden;
			}
			
			.voice2text-waveform {
				display: block;
				width: 100%;
				height: 60px;
			}
			
			.voice2text-timer {
				text-align: center;
				font-size: 16px;
				font-weight: 600;
				margin-bottom: 12px;
				color: var(--text-normal);
			}
			
			.voice2text-controls {
				display: flex;
				justify-content: center;
				gap: 8px;
			}
			
			.voice2text-button {
				width: 48px;
				height: 48px;
				border-radius: 8px;
				border: none;
				cursor: pointer;
				display: flex;
				align-items: center;
				justify-content: center;
				transition: all 0.2s ease;
				color: white;
			}
			
			.voice2text-button:hover {
				transform: scale(1.05);
				box-shadow: 0 4px 12px rgba(0,0,0,0.2);
			}
			
			.voice2text-button:active {
				transform: scale(0.95);
			}
			
			.voice2text-button svg {
				width: 24px;
				height: 24px;
			}
			
			.voice2text-transcription {
				margin-top: 12px;
				padding: 12px;
				background: var(--background-secondary);
				border-radius: 8px;
				font-size: 14px;
				line-height: 1.5;
				max-height: 200px;
				overflow-y: auto;
			}
			
			.voice2text-transcribing {
				margin-top: 12px;
				padding: 12px;
				text-align: center;
				font-size: 14px;
				color: var(--text-muted);
			}
			
			.voice2text-transcribing-text {
				margin-right: 4px;
			}
			
			.voice2text-transcribing-dots span {
				animation: voice2text-blink 1.4s infinite;
			}
			
			.voice2text-transcribing-dots span:nth-child(2) {
				animation-delay: 0.2s;
			}
			
			.voice2text-transcribing-dots span:nth-child(3) {
				animation-delay: 0.4s;
			}

			@keyframes voice2text-blink {
				0%, 60%, 100% { opacity: 0; }
				30% { opacity: 1; }
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

	// Helper to create simple labels (Chinese only)
	createBilingualLabel(en: string, cn: string): string {
		return cn;
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
		badge.className = `ls-status-badge ls-status-${status}`;

		const dot = badge.createEl('span', { cls: 'ls-status-dot' });
		badge.createEl('span', { text: message });

		return badge;
	}

	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();

		// Header
		const headerEl = containerEl.createDiv({ cls: 'ls-header' });
		headerEl.createEl('h1', { text: 'OB English Learner', cls: 'ls-title' });

		// Tab Navigation
		const navEl = containerEl.createDiv({ cls: 'ls-tab-nav' });
		const tabs = [
			{ id: 'content', label: 'Content', labelCn: '内容配置' },
			{ id: 'ai', label: 'AI', labelCn: '智能服务' },
			{ id: 'audio', label: 'Audio', labelCn: '音频设置' },
			{ id: 'commands', label: 'Commands', labelCn: '快捷命令' },
			{ id: 'advanced', label: 'Advanced', labelCn: '高级选项' }
		];

		tabs.forEach(tab => {
			const tabEl = navEl.createDiv({ cls: `ls-tab-item ${this.activeTab === tab.id ? 'is-active' : ''}` });
			tabEl.textContent = tab.labelCn;
			
			tabEl.onclick = () => {
				this.activeTab = tab.id;
				this.display();
			};
		});

		// Content Container
		const contentEl = containerEl.createDiv({ cls: 'ls-tab-content' });

		// Render based on active tab
		switch (this.activeTab) {
			case 'content': this.renderContent(contentEl); break;
			case 'ai': this.renderAI(contentEl); break;
			case 'audio': this.renderAudio(contentEl); break;
			case 'commands': await this.renderCommands(contentEl); break;
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

	// === Content Tab (General + Video + Config Backup) ===
	renderContent(container: HTMLElement) {
		// General Settings
		container.createEl('div', { text: '通用设置', cls: 'ls-section-title' });
		const generalCard = container.createDiv({ cls: 'ls-card' });

		new Setting(generalCard)
			.setName('默认语言')
			.setDesc('视频字幕的默认语言')
			.addDropdown(dropdown => dropdown
				.addOption('en', '英语 (English)')
				.addOption('zh', '中文')
				.addOption('zh-CN', '简体中文')
				.addOption('zh-TW', '繁体中文')
				.addOption('ja', '日语')
				.addOption('ko', '韩语')
				.addOption('es', '西班牙语')
				.addOption('fr', '法语')
				.addOption('de', '德语')
				.addOption('ru', '俄语')
				.addOption('pt', '葡萄牙语')
				.addOption('it', '意大利语')
				.setValue(this.plugin.settings.defaultLanguage || 'en')
				.onChange(async (value) => {
					this.plugin.settings.defaultLanguage = value;
					this.debouncedSave();
				}));

		// Video & Assets
		container.createEl('div', { text: '视频与资源', cls: 'ls-section-title' });
		const videoCard = container.createDiv({ cls: 'ls-card' });

		// yt-dlp Setup Guide
		new Setting(videoCard)
			.setName('yt-dlp 设置')
			.setDesc('下载 YouTube 字幕的核心组件')
			.addButton(button => button
				.setButtonText('安装指南')
				.setClass('mod-cta')
				.onClick(() => {
					new YtDlpInstallModal(this.app).open();
				}))
			.addButton(button => button
				.setButtonText('重新检测')
				.onClick(async () => {
					new Notice('正在检测 yt-dlp...');
					const result = await this.plugin.checkYtDlpInstallation();
					
					if (result.installed) {
						new Notice(`✅ 检测成功！yt-dlp 已安装 (版本: ${result.version})`, 5000);
					} else {
						new Notice('❌ 检测失败：未找到 yt-dlp，请先安装', 5000);
					}
				}));

		this.renderVideoSettings(videoCard);

		// === Settings Backup ===
		container.createEl('div', { text: '配置备份', cls: 'ls-section-title' });
		const backupCard = container.createDiv({ cls: 'ls-card' });

		// Export settings
		new Setting(backupCard)
			.setName('导出配置')
			.setDesc('将当前设置导出为 JSON 文件')
			.addButton(button => button
				.setButtonText('导出')
				.onClick(async () => {
					const settings = JSON.stringify(this.plugin.settings, null, 2);
					const blob = new Blob([settings], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `linguasync - settings - ${new Date().toISOString().slice(0, 10)}.json`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
					new Notice('✅ 配置已导出');
				}));

		// Import settings
		new Setting(backupCard)
			.setName('导入配置')
			.setDesc('从 JSON 文件恢复设置')
			.addButton(button => button
				.setButtonText('导入')
				.onClick(() => {
					const input = document.createElement('input');
					input.type = 'file';
					input.accept = '.json';
					input.onchange = async (e: Event) => {
						const file = (e.target as HTMLInputElement).files?.[0];
						if (!file) return;

						try {
							const text = await file.text();
							const importedSettings = JSON.parse(text);

							if (typeof importedSettings !== 'object' || !importedSettings.hasOwnProperty('videoFolder')) {
								throw new Error('无效的配置文件');
							}

							Object.assign(this.plugin.settings, importedSettings);
							await this.plugin.saveSettings();

							new Notice('✅ 配置已导入！正在刷新...');
							this.display();
						} catch (error) {
							new Notice(`❌ 导入失败: ${error.message} `);
						}
					};
					input.click();
				}));
	}

	private renderVideoSettings(container: HTMLElement) {
		new Setting(container)
			.setName('视频笔记目录')
			.setDesc('存放视频笔记 (MD) 的文件夹')
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
			.setName('字幕文件目录')
			.setDesc('存放 SRT 字幕文件的文件夹')
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
			.setName('封面图片目录')
			.setDesc('存放视频封面图的文件夹')
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
			.setName('自动下载封面图')
			.setDesc('导入视频时自动下载封面')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoDownloadThumbnails)
				.onChange(async (value) => {
					this.plugin.settings.autoDownloadThumbnails = value;
					this.saveAndNotify();
				}));
	}

	renderAI(container: HTMLElement) {
		const section = container.createDiv({ cls: 'ls-section' });

		// AI 功能
		container.createEl('div', { text: 'AI 功能', cls: 'ls-section-title' });
		const featuresCard = container.createDiv({ cls: 'ls-card' });

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
				{ id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3 ' },
				{ id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1 (推理增强)' },
				{ id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B' },
				{ id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder 32B' },
				{ id: 'Qwen/QwQ-32B-Preview', name: 'QwQ 32B (长思考链)' },
				{ id: 'moonshotai/Kimi-K2-Thinking', name: 'Kimi K2 Thinking (深度推理)' },
				{ id: 'zai-org/GLM-4.6', name: 'GLM-4.6 (智谱)' },
				{ id: 'THUDM/glm-4-9b-chat', name: 'GLM-4 9B Chat' },
				{ id: 'Pro/THUDM/glm-4-plus', name: 'GLM-4 Plus (旗舰)' },
				{ id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen 2.5 7B (轻量)' },
				{ id: 'Qwen/Qwen2.5-14B-Instruct', name: 'Qwen 2.5 14B' },
				{ id: 'meta-llama/Meta-Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B' },
				{ id: 'meta-llama/Meta-Llama-3.1-405B-Instruct', name: 'Llama 3.1 405B (超大)' }
			],
			'videocaptioner': [
				{ id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini (最新小型)' },
				{ id: 'gpt-4.1', name: 'GPT-4.1 (最新旗舰)' },
				{ id: 'gpt-4o', name: 'GPT-4o' },
				{ id: 'claude-3.5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
				{ id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
			],
			'custom': [
				{ id: 'custom-model', name: 'Custom Model' }
			]
		};

		new Setting(featuresCard)
			.setName('启用 AI 翻译')
			.setDesc('使用 AI 将英文字幕翻译成中文')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAITranslation)
				.onChange(async (value) => {
					this.plugin.settings.enableAITranslation = value;
					this.saveAndNotify();
				}));

		new Setting(featuresCard)
			.setName('智能笔记格式化')
			.setDesc('自动添加标点符号并分段，优化笔记内容')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAIFormatting)
				.onChange(async (value) => {
					this.plugin.settings.enableAIFormatting = value;
					await this.saveAndNotify();
					this.display(); // Refresh to show/hide prompt
				}));

		new Setting(featuresCard)
			.setName('智能字幕生成')
			.setDesc('为生成的 SRT 字幕文件添加 AI 标点和分段')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAISubtitles)
				.onChange(async (value) => {
					this.plugin.settings.enableAISubtitles = value;
					await this.saveAndNotify();
				}));

		if (this.plugin.settings.enableAIFormatting) {
			new Setting(featuresCard)
				.setName('格式化提示词')
				.setDesc('自定义 AI 格式化的指令')
				.addTextArea(text => text
					.setPlaceholder('请格式化...')
					.setValue(this.plugin.settings.aiFormattingPrompt)
					.onChange(async (value) => {
						this.plugin.settings.aiFormattingPrompt = value;
						this.debouncedSave();
					})
					.inputEl.rows = 6
				)
				.addExtraButton(btn => btn
					.setIcon('reset')
					.setTooltip('恢复默认')
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

		// 服务配置
		container.createEl('div', { text: '服务配置', cls: 'ls-section-title' });
		const providerCard = container.createDiv({ cls: 'ls-card' });

		new Setting(providerCard)
			.setName('AI 服务提供商')
			.setDesc('选择 AI 服务提供商')
			.addDropdown(dropdown => dropdown
				.addOption('deepseek', 'DeepSeek ⭐ (推荐 - 性价比高)')
				.addOption('siliconflow', 'SiliconFlow (国内快速)')
				.addOption('videocaptioner', 'VideoCaptioner (视频专用)')
				.addOption('openai', 'OpenAI (强大但较贵)')
				.addOption('gemini', 'Gemini (免费额度高)')
				.addOption('custom', 'Custom (自定义)')
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
			.setName('API 密钥')
			.setDesc('您的 AI API 密钥')
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
				.setName('API 地址')
				.setDesc('自定义 API 地址（例如 https://api.example.com/v1/chat/completions）')
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
				.setName('模型名称')
				.setDesc('手动输入模型 ID')
				.addText(text => text
					.setPlaceholder('e.g. gpt-4o-mini')
					.setValue(this.plugin.settings.aiModel)
					.onChange(async (value) => {
						this.plugin.settings.aiModel = value;
						this.debouncedSave();
					}));
		} else {
			new Setting(providerCard)
				.setName('模型选择')
				.setDesc('选择要使用的 AI 模型')
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

		// ⚡ 性能优化
		container.createEl('div', { text: '⚡ 性能优化', cls: 'ls-section-title' });
		const perfCard = container.createDiv({ cls: 'ls-card' });

		new Setting(perfCard)
			.setName('性能模式')
			.setDesc('调整 AI 处理速度与 API 限流的平衡策略')
			.addDropdown(dropdown => dropdown
				.addOption('balanced', '🐢 平衡模式 - 保守策略，避免限流（推荐免费 API）')
				.addOption('fast', '⚡ 快速模式 - 优化平衡，推荐使用（默认）')
				.addOption('turbo', '🚀 极速模式 - 最快速度，需要充足 API 额度')
				.setValue(this.plugin.settings.aiPerformanceMode || 'fast')
				.onChange(async (value: 'balanced' | 'fast' | 'turbo') => {
					this.plugin.settings.aiPerformanceMode = value;
					this.saveAndNotify();
					
					// 显示详细说明
					const descriptions = {
						'balanced': '平衡模式：小批次处理，长延迟，少并发。适合免费 API 或限流严格的服务。',
						'fast': '快速模式：优化后的配置，在速度和稳定性之间取得平衡。推荐大多数用户使用。',
						'turbo': '极速模式：大批次，短延迟，多并发。需要充足的 API 额度，可能触发限流（已内置重试）。'
					};
					new Notice(descriptions[value], 5000);
				}));

		perfCard.createDiv({ cls: 'setting-item-description', text: `
当前配置影响：
• 平衡模式：最安全，处理时间约为快速模式的 1.5 倍
• 快速模式：推荐配置，已优化性能，比原版快 60%+
• 极速模式：最快速度，比快速模式再快 30-40%，但可能触发限流
		`.trim() });

		// 测试连接
		container.createEl('div', { text: '测试连接', cls: 'ls-section-title' });
		const testCard = container.createDiv({ cls: 'ls-card' });

		new Setting(testCard)
			.setName('测试 AI 连接')
			.setDesc('测试 API 配置是否正常工作')
			.addButton(button => button
				.setButtonText('测试')
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
			.setName('启用语音转文字')
			.setDesc('启用语音录制和转写功能')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableVoice2Text)
				.onChange(async (value) => {
					this.plugin.settings.enableVoice2Text = value;
					this.saveAndNotify();
					this.display();
				}));

		if (this.plugin.settings.enableVoice2Text) {
			new Setting(sttCard)
				.setName('语音识别服务商')
				.setDesc('选择语音转文字的服务提供商')
				.addDropdown(dropdown => dropdown
					.addOption('openai', 'OpenAI (Whisper ⭐ 推荐)')
					.addOption('custom', 'Custom (自定义)')
					.addOption('assemblyai', 'AssemblyAI (专业转录)')
					.addOption('azure', 'Azure (企业级)')
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
			let keyDesc = '语音识别 API 密钥';
			if (provider === 'openai') keyDesc = '留空则使用主 AI 密钥';

			new Setting(sttCard)
				.setName('语音识别 API 密钥')
				.setDesc(keyDesc)
				.addText(text => text
					.setPlaceholder(provider === 'openai' ? '留空使用主 AI 密钥' : 'sk-...')
					.setValue(this.plugin.settings.sttApiKey)
					.onChange(async (value) => {
						this.plugin.settings.sttApiKey = value;
						this.debouncedSave();
						this.display(); // Refresh status
					}));

			// Base URL for Custom
			if (provider === 'custom') {
				new Setting(sttCard)
					.setName('接口地址')
					.setDesc('自定义 API 接口地址')
					.addText(text => text
						.setPlaceholder('https://api.openai.com/v1/audio/transcriptions')
						.setValue(this.plugin.settings.sttBaseUrl)
						.onChange(async (value) => {
							this.plugin.settings.sttBaseUrl = value;
							this.debouncedSave();
						}));
			}

			// Azure Region dropdown
			if (provider === 'azure') {
				const azureRegions = [
					'eastus', 'eastus2', 'westus', 'westus2', 'westus3',
					'centralus', 'northcentralus', 'southcentralus', 'westcentralus',
					'canadacentral', 'brazilsouth',
					'northeurope', 'westeurope', 'uksouth', 'francecentral',
					'germanywestcentral', 'norwayeast', 'switzerlandnorth', 'switzerlandwest', 'swedencentral',
					'eastasia', 'southeastasia', 'japaneast', 'japanwest', 'koreacentral',
					'australiaeast', 'centralindia', 'jioindiawest', 'uaenorth'
				];

				new Setting(sttCard)
					.setName('区域')
					.setDesc('Azure 服务区域')
					.addDropdown(dropdown => {
						azureRegions.forEach(region => {
							const label = region.charAt(0).toUpperCase() + region.slice(1);
							dropdown.addOption(region, label);
						});
						dropdown.setValue(this.plugin.settings.sttBaseUrl || 'eastus');
						dropdown.onChange(async (value) => {
							this.plugin.settings.sttBaseUrl = value;
							await this.debouncedSave();
						});
					});
			}

			// Language
			new Setting(sttCard)
				.setName('语言')
				.setDesc('语音识别语言')
				.addDropdown(dropdown => dropdown
					.addOption('', '自动检测')
					.addOption('en', '英语')
					.addOption('en-US', '英语（美国）')
					.addOption('en-GB', '英语（英国）')
					.addOption('zh', '中文')
					.addOption('zh-CN', '简体中文')
					.addOption('zh-TW', '繁体中文')
					.addOption('ja', '日语')
					.addOption('ja-JP', '日语（日本）')
					.addOption('ko', '韩语')
					.addOption('ko-KR', '韩语（韩国）')
					.addOption('es', '西班牙语')
					.addOption('es-ES', '西班牙语（西班牙）')
					.addOption('fr', '法语')
					.addOption('fr-FR', '法语（法国）')
					.addOption('de', '德语')
					.addOption('de-DE', '德语（德国）')
					.addOption('ru', '俄语')
					.addOption('pt', '葡萄牙语')
					.addOption('it', '意大利语')
					.addOption('ar', '阿拉伯语')
					.addOption('hi', '印地语')
					.setValue(this.plugin.settings.sttLanguage || '')
					.onChange(async (value) => {
						this.plugin.settings.sttLanguage = value;
						this.debouncedSave();
					}));

			// Model (for OpenAI/Custom)
			if (provider === 'openai' || provider === 'custom') {
				new Setting(sttCard)
					.setName('模型')
					.setDesc('Whisper 模型名称')
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
				.setName('音频文件格式')
				.setDesc('选择录音文件格式')
				.addDropdown(dropdown => dropdown
					.addOption('wav', 'WAV (无损，文件大)')
					.addOption('webm', 'WebM (兼容性好)')
					.addOption('mp3', 'MP3 (压缩，文件小)')
					.setValue(this.plugin.settings.audioFormat || 'wav')
					.onChange(async (value) => {
						this.plugin.settings.audioFormat = value as any;
						this.saveAndNotify();
					}));

			new Setting(sttCard)
				.setName('保存音频文件')
				.setDesc('将录制的音频保存到仓库')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.saveAudio)
					.onChange(async (value) => {
						this.plugin.settings.saveAudio = value;
						this.saveAndNotify();
					}));

			new Setting(sttCard)
				.setName('只录音模式')
				.setDesc('仅录音不转写，只保存音频文件')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.recordOnlyMode)
					.onChange(async (value) => {
						this.plugin.settings.recordOnlyMode = value;
						// 如果开启只录音模式，自动开启保存音频
						if (value && !this.plugin.settings.saveAudio) {
							this.plugin.settings.saveAudio = true;
						}
						this.saveAndNotify();
						this.display(); // 刷新界面
					}));

			const filenameSetting = new Setting(sttCard)
				.setName('录音文件名模板')
				.setDesc('可用变量: {{date}}, {{time}}, {{title}}, {{timestamp}}');

			filenameSetting.addText(text => {
				text
					.setPlaceholder('Recording_{{date:YYYY-MM-DD}}_{{time:HH-mm-ss}}')
					.setValue(this.plugin.settings.audioFilenameTemplate)
					.onChange(async (value) => {
						this.plugin.settings.audioFilenameTemplate = value;
						this.debouncedSave();
						// Update preview
						updatePreview(value);
					});
				text.inputEl.style.width = '100%';
			});

			// Add preview
			const previewContainer = sttCard.createDiv({ cls: 'ls-template-preview' });
			previewContainer.style.marginTop = '12px';
			previewContainer.style.padding = '10px 14px';
			previewContainer.style.backgroundColor = 'var(--background-secondary)';
			previewContainer.style.borderRadius = '8px';
			previewContainer.style.border = '1px solid var(--background-modifier-border)';

			const previewLabel = previewContainer.createDiv();
			previewLabel.style.fontSize = '11px';
			previewLabel.style.fontWeight = '500';
			previewLabel.style.color = 'var(--text-muted)';
			previewLabel.style.marginBottom = '6px';
			previewLabel.style.textTransform = 'uppercase';
			previewLabel.style.letterSpacing = '0.05em';
			previewLabel.setText('Preview / 预览');

			const previewValue = previewContainer.createDiv();
			previewValue.style.fontSize = '13px';
			previewValue.style.fontFamily = 'var(--font-monospace)';
			previewValue.style.color = 'var(--text-normal)';
			previewValue.style.wordBreak = 'break-all';
			previewValue.style.lineHeight = '1.4';

			const updatePreview = (template: string) => {
				const now = new Date();
				const preview = template
					.replace(/\{\{date:YYYY-MM-DD\}\}/g, now.toISOString().split('T')[0])
					.replace(/\{\{date\}\}/g, now.toISOString().split('T')[0])
					.replace(/\{\{time:HH-mm-ss\}\}/g, now.toTimeString().split(' ')[0].replace(/:/g, '-'))
					.replace(/\{\{time\}\}/g, now.toTimeString().split(' ')[0].replace(/:/g, '-'))
					.replace(/\{\{timestamp\}\}/g, String(now.getTime()))
					.replace(/\{\{title\}\}/g, 'UntitledNote');
				previewValue.setText(`${preview}.${this.plugin.settings.audioFormat || 'wav'}`);
			};

			// Initial preview
			updatePreview(this.plugin.settings.audioFilenameTemplate);

			new Setting(sttCard)
				.setName('音频保存路径')
				.setDesc('存放录制音频的文件夹')
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

			// Test STT Connection button
			new Setting(sttCard)
				.setName('测试语音服务连接')
				.setDesc('测试语音转文字配置是否正常')
				.addButton(button => button
					.setButtonText('测试')
					.setClass('ls-button')
					.onClick(async () => {
						await this.testSTTConnection();
					}));
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
			.setName('启用文本转语音')
			.setDesc('启用“朗读选中文本”命令和菜单')
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
				.setName('TTS 服务商')
				.setDesc('选择文本转语音服务提供商')
				.addDropdown(dropdown => dropdown
					.addOption('openai', 'OpenAI ⭐ (推荐 - 质量好)')
					.addOption('azure', 'Azure (多语言支持)')
					.addOption('elevenlabs', 'ElevenLabs (最自然)')
					.addOption('custom', 'Custom (自定义)')
					.setValue(this.plugin.settings.ttsProvider || 'openai')
					.onChange(async (value: any) => {
						this.plugin.settings.ttsProvider = value;
						this.saveAndNotify();
						this.display();
					}));

			const provider = this.plugin.settings.ttsProvider || 'openai';

			// API Key (Optional Override)
			new Setting(ttsCard)
				.setName('TTS API 密钥')
				.setDesc('留空则使用全局 API 密钥')
				.addText(text => text
					.setPlaceholder('sk-...')
					.setValue(this.plugin.settings.ttsApiKey)
					.onChange(async (value) => {
						this.plugin.settings.ttsApiKey = value;
						this.debouncedSave();
					}));

			// OpenAI / Custom Settings
			if (provider === 'openai' || provider === 'custom') {
				new Setting(ttsCard)
					.setName('TTS 模型')
					.addDropdown(dropdown => dropdown
						.addOption('tts-1', 'TTS-1')
						.addOption('tts-1-hd', 'TTS-1-HD')
						.setValue(this.plugin.settings.ttsModel || 'tts-1')
						.onChange(async (value) => {
							this.plugin.settings.ttsModel = value;
							this.debouncedSave();
						}));

				new Setting(ttsCard)
					.setName('TTS 音色')
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
					new Setting(ttsCard)
						.setName('TTS 接口地址')
						.setDesc('例如: https://api.openai.com/v1/audio/speech')
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

				new Setting(ttsCard)
					.setName('区域')
					.setDesc('选择 Speech Services 资源所在的 Azure 区域')
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
					const voiceSetting = new Setting(ttsCard)
						.setName('语音')
						.setDesc('选择用于语音合成的 Azure 声音');

					voiceSetting.addDropdown(dropdown => {
						dropdown.addOption('', '加载中...');
						dropdown.setDisabled(true);

						// Auto-load voices
						this.plugin.ttsManager.getAzureVoices().then((voices: any[]) => {
							if (!voices || voices.length === 0) {
								dropdown.selectEl.innerHTML = '';
								dropdown.addOption('', '❌ 未找到语音');
								dropdown.setDisabled(true);
								return;
							}

							voices.sort((a: any, b: any) => a.Locale.localeCompare(b.Locale) || a.DisplayName.localeCompare(b.DisplayName));

							const selectEl = dropdown.selectEl;
							selectEl.innerHTML = '';

							voices.forEach((v: any) => {
								const label = `${v.DisplayName} (${v.Gender}) - ${v.Locale} `;
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
							let displayMsg = '❌ 加载失败';
							if (errorMsg.includes('401') || errorMsg.includes('403')) {
								displayMsg = '❌ API 密钥无效';
							} else if (errorMsg.includes('404')) {
								displayMsg = '❌ 区域无效';
							}

							dropdown.addOption('', displayMsg);
							dropdown.setDisabled(true);
							console.error('[Azure TTS] Failed to load voices:', err);
							console.error('[Azure TTS] API Key (first 8 chars):', apiKey.substring(0, 8) + '...');
							console.error('[Azure TTS] Region:', region);

							// Show notice to user
							new Notice(`${displayMsg} \n详见控制台`, 5000);
						});
					});
				} else {
					new Setting(ttsCard)
						.setName('语音')
						.setDesc('⚠️ 请先在上方输入 Azure API 密钥以加载可用语音');
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

				new Setting(ttsCard)
					.setName('输出格式')
					.setDesc('生成语音的音频格式')
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
				new Setting(ttsCard)
					.setName(this.createBilingualLabel('Voice ID', 'Voice ID'))
					.setDesc('ElevenLabs Voice ID')
					.addText(text => text
						.setPlaceholder('21m00Tcm4TlvDq8ikWAM')
						.setValue(this.plugin.settings.ttsVoice)
						.onChange(async (value) => {
							this.plugin.settings.ttsVoice = value;
							this.debouncedSave();
						}));

				new Setting(ttsCard)
					.setName('模型 ID')
					.setDesc('例如: eleven_monolingual_v1')
					.addText(text => text
						.setPlaceholder('eleven_monolingual_v1')
						.setValue(this.plugin.settings.ttsModel)
						.onChange(async (value) => {
							this.plugin.settings.ttsModel = value;
							this.debouncedSave();
						}));
			}

			// Speed Control (Common)
			new Setting(ttsCard)
				.setName('播放速度')
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
			new Setting(ttsCard)
				.setName('测试语音')
				.setDesc('测试当前 TTS 配置')
				.addButton(btn => btn
					.setButtonText('测试')
					.onClick(async () => {
						btn.setDisabled(true);
						btn.setButtonText('测试中...');
						try {
							const testText = '你好，这是一个语音合成测试。';
							await this.plugin.ttsManager.testSpeak(testText);
							new Notice('✅ 测试成功！');
						} catch (err) {
							new Notice('❌ 测试失败: ' + err.message);
							console.error(err);
						} finally {
							btn.setDisabled(false);
							btn.setButtonText('测试');
						}
					}));

			// === User Interface ===
			container.createEl('div', { text: '用户界面', cls: 'ls-section-title' });
			const uiCard = container.createDiv({ cls: 'ls-card' });

			new Setting(uiCard)
				.setName('显示播放器工具栏')
				.setDesc('设置播放器工具栏的显示条件')
				.addDropdown(dropdown => dropdown
					.addOption('always', '始终显示')
					.addOption('auto', '播放时显示')
					.addOption('never', '从不显示')
					.setValue(this.plugin.settings.ttsShowPlayer || 'always')
					.onChange(async (value: any) => {
						this.plugin.settings.ttsShowPlayer = value;
						this.saveAndNotify();
					}));

			new Setting(uiCard)
				.setName('自动滚动播放器')
				.setDesc('自动滚动以保持当前播放的文本可见')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.ttsAutoscroll)
					.onChange(async (value) => {
						this.plugin.settings.ttsAutoscroll = value;
						this.saveAndNotify();
					}));

			// === Storage ===
			container.createEl('div', { text: '存储设置', cls: 'ls-section-title' });
			const storageCard = container.createDiv({ cls: 'ls-card' });

			new Setting(storageCard)
				.setName('缓存类型')
				.setDesc('本地：设备缓存（推荐）\n仓库：跨设备共享')
				.addDropdown(dropdown => dropdown
					.addOption('local', '本地缓存')
					.addOption('vault', '仓库缓存')
					.setValue(this.plugin.settings.ttsCacheType === 'none' ? 'local' : this.plugin.settings.ttsCacheType)
					.onChange(async (value: any) => {
						this.plugin.settings.ttsCacheType = value;
						this.saveAndNotify();
					}));

			const cacheDurationSetting = new Setting(storageCard)
				.setName('缓存时长')
				.setDesc('音频缓存保留时长（小时）');

			cacheDurationSetting.addText(text => {
				text.setPlaceholder('24')
					.setValue(String(this.plugin.settings.ttsCacheDuration || 24))
					.onChange(async (value) => {
						const num = parseInt(value);
						if (!isNaN(num)) {
							this.plugin.settings.ttsCacheDuration = num;
							this.debouncedSave();
						}
					});
				text.inputEl.style.width = '100px';
			});

			// Add "hours" label after input
			const hoursLabel = cacheDurationSetting.controlEl.createSpan();
			hoursLabel.setText('小时');
			hoursLabel.style.marginLeft = '8px';
			hoursLabel.style.color = 'var(--text-muted)';

			const cacheSizeSetting = new Setting(storageCard)
				.setName('缓存磁盘占用')
				.setDesc('计算中...');

			const updateCacheSize = async () => {
				try {
					const size = await this.plugin.ttsManager.getCacheSize();
					const humanSize = this.humanFileSize(size);
					cacheSizeSetting.setDesc(humanSize);
				} catch (err) {
					cacheSizeSetting.setDesc('计算失败');
					console.error(err);
				}
			};

			cacheSizeSetting
				.addButton(btn => btn
					.setIcon('rotate-cw')
					.setTooltip('刷新')
					.onClick(async () => {
						btn.setDisabled(true);
						await updateCacheSize();
						btn.setDisabled(false);
					}))
				.addButton(btn => btn
					.setIcon('trash')
					.setTooltip('清除缓存')
					.onClick(async () => {
						if (confirm('确认清除 TTS 缓存？这将删除所有缓存的音频文件。')) {
							btn.setDisabled(true);
							try {
								await this.plugin.ttsManager.clearCache();
								await updateCacheSize();
							} catch (err) {
								new Notice('清除缓存失败: ' + err.message);
							} finally {
								btn.setDisabled(false);
							}
						}
					}));

			// Initial load
			updateCacheSize();

			new Setting(storageCard)
				.setName('音频文件夹')
				.setDesc('导出音频文件的保存位置')
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
			container.createEl('div', { text: '文本分段', cls: 'ls-section-title' });
			const audioConfigCard = container.createDiv({ cls: 'ls-card' });

			new Setting(audioConfigCard)
				.setName('分段方式')
				.setDesc('播放时按句子或段落分割文本')
				.addDropdown(dropdown => dropdown
					.addOption('sentence', '按句子')
					.addOption('paragraph', '按段落')
					.setValue(this.plugin.settings.ttsChunking || 'sentence')
					.onChange(async (value: any) => {
						this.plugin.settings.ttsChunking = value;
						this.saveAndNotify();
					}));
		}
	}

	// === Commands Tab ===
	async renderCommands(container: HTMLElement) {
		// Load commands first to ensure they are up to date
		await this.plugin.loadCustomCommands();

		// Custom Commands Card
		const commandsCard = container.createDiv({ cls: 'ls-card' });
		container.createEl('div', { text: '自定义命令', cls: 'ls-section-title' });

		// Commands folder setting
		new Setting(commandsCard)
			.setName('自定义命令文件夹')
			.setDesc('存储自定义命令文件的文件夹 (.md)')
			.addText(text => {
				text
					.setPlaceholder('03-Resources/copilot-custom-prompts')
					.setValue(this.plugin.settings.customCommandsFolder)
					.onChange(async (value) => {
						this.plugin.settings.customCommandsFolder = value;
						this.debouncedSave();
						await this.plugin.loadCustomCommands();
						this.display(); // Refresh UI
					});
				// Make input wider to show full path
				text.inputEl.style.width = '100%';
				text.inputEl.style.minWidth = '400px';
			});

		// Templating setting
		new Setting(commandsCard)
			.setName('提示词模板化')
			.setDesc('在提示词中处理 {{selection}} 变量')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.customCommandTemplating)
				.onChange(async (value) => {
					this.plugin.settings.customCommandTemplating = value;
					this.saveAndNotify();
				}));

		// Sort strategy
		new Setting(commandsCard)
			.setName('排序策略')
			.setDesc('命令列表的排序方式')
			.addDropdown(dropdown => dropdown
				.addOption('recency', '最近使用')
				.addOption('alphabetical', '字母顺序')
				.addOption('order', '手动排序')
				.setValue(this.plugin.settings.customCommandSortStrategy)
				.onChange(async (value: any) => {
					this.plugin.settings.customCommandSortStrategy = value;
					this.saveAndNotify();
				}));

		// Ribbon Quick Action Buttons
		container.createEl('div', { text: '快捷操作按钮', cls: 'ls-section-title' });
		const ribbonCard = container.createDiv({ cls: 'ls-card' });

		// Button 1 (⚡ zap icon)
		new Setting(ribbonCard)
			.setName('按钮 1 (⚡)')
			.setDesc('左侧工具栏第一个快捷按钮')
			.addDropdown(dropdown => {
				// Add empty option
				dropdown.addOption('', '-- 无 --');
				// Add available commands
				const commands = this.plugin.getAvailableCommands();
				commands.forEach(cmd => {
					dropdown.addOption(cmd.id, cmd.name);
				});

				dropdown.setValue(this.plugin.settings.ribbonCommandId)
					.onChange(async (value) => {
						// Instant update - no reload needed!
						this.plugin.updateRibbonButton(1, value);
						await this.plugin.saveSettings();
						new Notice('✅ 按钮 1 已更新');
					});
			});

		// Button 2 (⭐ star icon)
		new Setting(ribbonCard)
			.setName('按钮 2 (⭐)')
			.setDesc('左侧工具栏第二个快捷按钮')
			.addDropdown(dropdown => {
				// Add empty option
				dropdown.addOption('', '-- 无 --');
				// Add available commands
				const commands = this.plugin.getAvailableCommands();
				commands.forEach(cmd => {
					dropdown.addOption(cmd.id, cmd.name);
				});

				dropdown.setValue(this.plugin.settings.ribbonCommandId2)
					.onChange(async (value) => {
						// Instant update - no reload needed!
						this.plugin.updateRibbonButton(2, value);
						await this.plugin.saveSettings();
						new Notice('✅ 按钮 2 已更新');
					});
			});

		// Info box
		const infoBox = ribbonCard.createDiv({ cls: 'ls-info-box' });
		infoBox.style.marginTop = '15px';
		infoBox.innerHTML = `
			<div style="display: flex; gap: 10px; align-items: start;">
				<span style="font-size: 20px;">✨</span>
				<div style="font-size: 0.9em; color: var(--text-muted);">
					<strong>提示：</strong>按钮会即时更新 - 无需重新加载！
				</div>
			</div>
		`;

		// Commands UI
		const commandsUIContainer = commandsCard.createDiv({ cls: 'custom-commands-ui-container' });
		commandsUIContainer.style.marginTop = '20px';

		const commandsUI = new CustomCommandSettingsUI(
			commandsUIContainer,
			this.app,
			this.plugin.settings.customCommands || [],
			this.plugin.customCommandManager,
			this.plugin.settings.customCommandsFolder,
			async () => {
				await this.plugin.loadCustomCommands();
			}
		);
		commandsUI.render();
	}

	// === Advanced Tab (Template + Account) ===
	renderAdvanced(container: HTMLElement) {
		// Note Template Card
		container.createEl('div', { text: '笔记模板', cls: 'ls-section-title' });
		const templateCard = container.createDiv({ cls: 'ls-card' });

		this.renderTemplateSettings(templateCard);

		// Account Management Card
		container.createEl('div', { text: '账户管理', cls: 'ls-section-title' });
		const accountCard = container.createDiv({ cls: 'ls-card' });

		this.renderAccountSettings(accountCard);
	}

	private renderTemplateSettings(container: HTMLElement) {
		const section = container;

		// Properties Manager
		const headerSetting = new Setting(section)
			.setName('顶部属性')
			.setDesc('管理笔记顶部的 YAML 属性');
		headerSetting.settingEl.addClass('ls-sub-section-header');
		headerSetting.settingEl.style.borderBottom = 'none';
		headerSetting.settingEl.style.paddingBottom = '0';

		const propertiesDiv = section.createDiv({ cls: 'ls-properties-card' });
		let templateTextArea: any;

		const refreshProperties = () => {
			propertiesDiv.empty();
			const properties = this.parseFrontmatter(this.plugin.settings.noteTemplate);

			if (properties.length === 0) {
				const emptyMsg = propertiesDiv.createDiv({ text: '未找到属性' });
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
			const addBtn = addBtnContainer.createEl('button', { text: '+ 添加属性' });
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
		varInfo.innerHTML = `<p style="margin: 0 0 8px 16px;"><strong>可用变量: </strong></p>
	<div style="margin: 0 16px 16px; line-height: 1.6;">
		<code style="color:var(--ls-color-primary)">{{title}}</code>, <code style="color:var(--ls-color-primary)">{{url}}</code>, 
		<code style="color:var(--ls-color-primary)">{{channel}}</code>, <code style="color:var(--ls-color-primary)">{{cover}}</code>, 
		<code style="color:var(--ls-color-primary)">{{transcript}}</code> ...
	</div>`;

		new Setting(section)
			.setName('模板源码')
			.setDesc('编辑原始 Markdown 模板')
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
			.setName('重置模板')
			.setDesc('恢复默认模板设置')
			.addButton(button => button
				.setButtonText('重置')
				.setClass('ls-button') // Use safe class adding
				.onClick(async () => {
					if (confirm('确认重置模板？')) {
						this.plugin.settings.noteTemplate = DEFAULT_TEMPLATE;
						await this.saveAndNotify();
						this.display();
					}
				}));
	}

	private renderAccountSettings(container: HTMLElement) {
		new Setting(container)
			.setName('密码管理器')
			.setDesc('管理受保护媒体源的凭证')
			.addButton(button => button
				.setButtonText('打开管理')
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
			yamlLines.push(`${prefix}${p.key}: ${p.value} `);
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

// Setup Wizard and Presets modals removed

/**
 * Modal to guide users through yt-dlp installation
 * Shows on first plugin load if yt-dlp is not detected
 */
class YtDlpInstallModal extends Modal {
	private onDismiss: (dontShowAgain: boolean) => void;

	constructor(app: App, onDismiss?: (dontShowAgain: boolean) => void) {
		super(app);
		this.onDismiss = onDismiss || (() => {});
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ytdlp-modal');

		// Header
		contentEl.createEl('h2', { text: '📺 YouTube 字幕功能设置' });

		contentEl.createEl('p', {
			text: '本插件使用 yt-dlp 工具来获取 YouTube 字幕。请按照以下步骤完成安装：',
			cls: 'setting-item-description'
		});

		// Detect OS
		const isWindows = navigator.platform.toLowerCase().includes('win');
		const isMac = navigator.platform.toLowerCase().includes('mac');

		// Step 1: Open Terminal
		const step1 = contentEl.createDiv({ cls: 'install-step' });
		step1.createEl('h3', { text: '步骤 1：打开终端' });

		if (isWindows) {
			const terminalInfo = step1.createDiv({ cls: 'terminal-guide' });
			terminalInfo.createEl('p', { text: '🪟 Windows 用户请选择以下任一方式打开终端：' });
			const methods = terminalInfo.createEl('ul');
			methods.createEl('li', { text: '按 Win + X，选择「Windows PowerShell」或「终端」' });
			methods.createEl('li', { text: '按 Win + R，输入 cmd 后回车' });
			methods.createEl('li', { text: '在开始菜单搜索「命令提示符」或「PowerShell」' });
		} else if (isMac) {
			const terminalInfo = step1.createDiv({ cls: 'terminal-guide' });
			terminalInfo.createEl('p', { text: '🍎 macOS 用户请：' });
			const methods = terminalInfo.createEl('ul');
			methods.createEl('li', { text: '按 Cmd + 空格，搜索「Terminal」或「终端」' });
			methods.createEl('li', { text: '或在「应用程序 → 实用工具 → 终端」中打开' });
		} else {
			const terminalInfo = step1.createDiv({ cls: 'terminal-guide' });
			terminalInfo.createEl('p', { text: '🐧 Linux 用户请：' });
			const methods = terminalInfo.createEl('ul');
			methods.createEl('li', { text: '按 Ctrl + Alt + T 打开终端' });
			methods.createEl('li', { text: '或在应用程序菜单中搜索「Terminal」' });
		}

		// Step 2: Run Command
		const step2 = contentEl.createDiv({ cls: 'install-step' });
		step2.createEl('h3', { text: '步骤 2：复制并粘贴命令' });
		step2.createEl('p', {
			text: '在打开的终端窗口中，粘贴以下命令并按回车执行：',
			cls: 'setting-item-description'
		});

		// Platform-specific commands
		if (isWindows) {
			this.createCommandBlock(step2, 'winget install yt-dlp', '推荐方式 - 使用 Windows 包管理器');
		} else if (isMac) {
			this.createCommandBlock(step2, 'brew install yt-dlp', '推荐方式 - 使用 Homebrew');
		} else {
			this.createCommandBlock(step2, 'pip install yt-dlp', '推荐方式 - 使用 Python pip');
		}

		// Alternative
		const altSection = step2.createDiv({ cls: 'alt-method' });
		altSection.createEl('span', { text: '或者使用：', cls: 'alt-label' });
		this.createCommandBlock(altSection, 'pip install yt-dlp', '通用方式 - 需要已安装 Python');

		// Step 3: Verify
		const step3 = contentEl.createDiv({ cls: 'install-step' });
		step3.createEl('h3', { text: '步骤 3：验证安装' });
		step3.createEl('p', {
			text: '安装完成后，在终端中输入以下命令验证是否成功：',
			cls: 'setting-item-description'
		});
		this.createCommandBlock(step3, 'yt-dlp --version', '应显示版本号，如 2024.12.13');

		// Step 4: Restart
		const step4 = contentEl.createDiv({ cls: 'install-step' });
		step4.createEl('h3', { text: '步骤 4：重启 Obsidian' });
		step4.createEl('p', {
			text: '验证成功后，按 Ctrl+R（Mac: Cmd+R）重新加载 Obsidian，插件将自动检测 yt-dlp。',
			cls: 'setting-item-description'
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'ytdlp-buttons' });

		const helpButton = buttonContainer.createEl('button', { text: '📖 查看官方文档', cls: 'mod-cta' });
		helpButton.addEventListener('click', () => {
			window.open('https://github.com/yt-dlp/yt-dlp#installation', '_blank');
		});

		const dontShowButton = buttonContainer.createEl('button', { text: '⏭️ 跳过，不再提示' });
		dontShowButton.addEventListener('click', () => {
			this.onDismiss(true);
			this.close();
		});

		const closeButton = buttonContainer.createEl('button', { text: '我稍后安装' });
		closeButton.addEventListener('click', () => {
			this.onDismiss(false);
			this.close();
		});

		// Add styles
		this.addStyles();
	}

	createCommandBlock(container: HTMLElement, command: string, description: string) {
		const block = container.createDiv({ cls: 'command-block' });

		const codeWrapper = block.createDiv({ cls: 'code-wrapper' });
		codeWrapper.createEl('code', { text: command });

		const copyBtn = codeWrapper.createEl('button', { text: '📋', cls: 'copy-btn' });
		copyBtn.setAttribute('title', '复制命令');
		copyBtn.addEventListener('click', async () => {
			await navigator.clipboard.writeText(command);
			copyBtn.textContent = '✅';
			setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
		});

		block.createEl('span', { text: description, cls: 'command-desc' });
	}

	addStyles() {
		// Check if styles already added
		if (document.getElementById('ytdlp-modal-styles')) return;

		const style = document.createElement('style');
		style.id = 'ytdlp-modal-styles';
		style.textContent = `
			.ytdlp-modal {
				max-width: 600px;
			}
			.install-step {
				margin: 16px 0;
				padding: 12px;
				background: var(--background-secondary);
				border-radius: 8px;
			}
			.install-step h3 {
				margin: 0 0 8px 0;
				color: var(--text-accent);
			}
			.terminal-guide ul {
				margin: 8px 0 0 20px;
				padding: 0;
			}
			.terminal-guide li {
				margin: 4px 0;
			}
			.command-block {
				display: flex;
				align-items: center;
				gap: 8px;
				margin: 8px 0;
				flex-wrap: wrap;
			}
			.code-wrapper {
				display: flex;
				align-items: center;
				background: var(--background-primary);
				border-radius: 4px;
				padding: 6px 10px;
				border: 1px solid var(--background-modifier-border);
			}
			.code-wrapper code {
				font-family: var(--font-monospace);
				font-size: 14px;
				color: var(--text-accent);
			}
			.copy-btn {
				margin-left: 8px;
				padding: 2px 6px;
				border: none;
				background: transparent;
				cursor: pointer;
				font-size: 14px;
			}
			.copy-btn:hover {
				background: var(--background-modifier-hover);
				border-radius: 4px;
			}
			.command-desc {
				color: var(--text-muted);
				font-size: 12px;
			}
			.alt-method {
				margin-top: 8px;
				padding-top: 8px;
				border-top: 1px dashed var(--background-modifier-border);
			}
			.alt-label {
				color: var(--text-muted);
				font-size: 12px;
				margin-right: 8px;
			}
			.ytdlp-buttons {
				display: flex;
				gap: 12px;
				margin-top: 20px;
				justify-content: flex-end;
			}
		`;
		document.head.appendChild(style);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
