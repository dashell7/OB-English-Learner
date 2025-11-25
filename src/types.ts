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
}

export interface LinguaSyncSettings {
    defaultLanguage: string;
    targetLanguage: string;
    videoFolder: string;
    assetsFolder: string;
    autoDownloadThumbnails: boolean;
    generateBilingualTranscript: boolean;
    // AI Translation
    enableAITranslation: boolean;
    enableAIFormatting: boolean;  // AI punctuation and paragraph formatting
    aiFormattingPrompt: string;  // Custom prompt for text formatting
    aiProvider: 'openai' | 'deepseek' | 'gemini' | 'siliconflow' | 'videocaptioner' | 'custom';
    aiApiKey: string;
    aiModel: string;
    aiBaseUrl: string;
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
