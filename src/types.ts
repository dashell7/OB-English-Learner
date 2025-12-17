// Core types for LinguaSync

export interface TranscriptLine {
    start: number;  // Start time in seconds
    duration: number;  // Duration in seconds
    text: string;  // Transcript text
    lang?: string;  // Language code (e.g., 'en', 'zh')
}

export interface VideoMetadata {
    videoId: string;
    title: string;
    author: string;
    channel: string;
    duration: number;  // Duration in seconds
    thumbnailUrl: string;
    uploadDate?: string;
    url?: string;  // Original video URL (YouTube/Bilibili)
}

export interface VideoData {
    metadata: VideoMetadata;
    transcript: TranscriptLine[];
    translatedTranscript?: TranscriptLine[];  // For bilingual support
    refinedTranscript?: TranscriptLine[];     // AI segmented & punctuated transcript
    refinedTranslatedTranscript?: TranscriptLine[]; // Translated version of refined transcript
    formattedTranscriptText?: string;  // AI formatted text for article content (with punctuation & paragraphs)
}

export interface LinguaSyncSettings {
    // Setup
    hasCompletedSetup: boolean;
    // General
    defaultLanguage: string;
    targetLanguage: string;
    videoFolder: string;
    assetsFolder: string;  // 已废弃，保留用于兼容
    subtitlesFolder: string;  // 新增：字幕文件夹
    thumbnailsFolder: string;  // 新增：封面图片文件夹
    autoDownloadThumbnails: boolean;
    generateBilingualTranscript: boolean;
    // AI Translation
    enableAITranslation: boolean;
    enableAIFormatting: boolean;  // For Note content
    enableAISubtitles: boolean;   // For SRT files
    aiFormattingPrompt: string;  // Custom prompt for text formatting
    aiProvider: 'openai' | 'deepseek' | 'gemini' | 'siliconflow' | 'videocaptioner' | 'custom';
    aiApiKey: string;
    aiModel: string;
    aiBaseUrl: string;
    aiPerformanceMode: 'balanced' | 'fast' | 'turbo';  // Performance optimization mode
    // Voice to Text
    enableVoice2Text: boolean;
    sttProvider: 'openai' | 'azure' | 'assemblyai' | 'custom';
    sttApiKey: string;
    sttLanguage: string;
    sttModel: string;
    sttBaseUrl: string;
    saveAudio: boolean;
    audioFolder: string;
    audioFormat: 'wav' | 'webm' | 'mp3';
    audioFilenameTemplate: string;
    recordOnlyMode: boolean;  // 只录音不转录模式
    // Text to Speech
    enableTTS: boolean;
    ttsProvider: 'openai' | 'azure' | 'elevenlabs' | 'gemini' | 'custom';
    ttsApiKey: string;
    ttsModel: string;
    ttsVoice: string;
    ttsSpeed: number;
    ttsBaseUrl: string; // For Custom or Azure Region
    ttsOutputFormat: string; // Azure Output Format
    // TTS Advanced
    ttsShowPlayer: 'always' | 'auto' | 'never';
    ttsAutoscroll: boolean;
    ttsCacheType: 'none' | 'local' | 'vault';
    ttsCacheDuration: number; // hours
    ttsAudioFolder: string;
    ttsChunking: 'sentence' | 'paragraph';
    // Vault QA (Learning Assistant)
    enableVaultQA: boolean;
    qaSearchFolders: string[];  // Folders to search (e.g., ['01-Videos', '02-Subtitles'])
    qaExcludeFolders: string[]; // Folders to exclude (e.g., ['.obsidian', '03-Recordings'])
    qaMaxSources: number;       // Maximum number of source notes to include
    // Custom Commands
    customCommandsFolder: string;  // Folder where custom command files are stored
    customCommandTemplating: boolean;  // Enable variable templating
    customCommandSortStrategy: 'recency' | 'alphabetical' | 'order';  // Sort strategy
    customCommands: CustomCommand[];  // List of custom commands
    ribbonCommandId: string;  // Command ID to bind to Ribbon quick action button
    ribbonCommandId2: string; // Command ID for second quick action button
    // Template
    noteTemplate: string;
    // Account / Credentials
    credentials: Credential[];
}

export interface Credential {
    id: string;
    type: 'webdav' | 'nextcloud' | 'baiduyun' | 'other';
    name: string;
    url: string;
    username: string;
    password: string;
}

// Custom Commands
export interface CustomCommand {
    title: string;
    content: string;
    showInContextMenu?: boolean;
    showInSlashMenu?: boolean;
    order?: number;
    modelKey?: string;
    lastUsedMs: number;
}
