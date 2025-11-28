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
    ttsCacheType: 'local' | 'vault';
    ttsCacheDuration: number; // hours
    ttsAudioFolder: string;
    ttsChunking: 'sentence' | 'paragraph';
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
