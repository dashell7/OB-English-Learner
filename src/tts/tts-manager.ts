// Complete TTS Manager - Full Aloud-style implementation
import { App, requestUrl, Editor, EditorPosition, Notice } from 'obsidian';
import { LinguaSyncSettings, TranscriptLine } from '../types';
import { TTSCache } from './tts-cache';

export interface TTSChunk {
    text: string;
    start: number;  // Character offset (like Aloud)
    end: number;    // Character offset (like Aloud)
}

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused';

export class TTSManager {
    app: App;
    settings: LinguaSyncSettings;
    cache: TTSCache;
    private cacheReady: Promise<void>;
    
    // Playback state
    currentState: PlaybackState = 'idle';
    chunks: TTSChunk[] = [];
    currentChunkIndex: number = 0;
    editor: Editor | null = null;
    audioElement: HTMLAudioElement | null = null;
    currentAudioUrl: string | null = null;
    isPaused: boolean = false;
    pausedAt: number = 0;
    
    // Preloading for seamless playback
    private preloadedAudio: Map<number, ArrayBuffer> = new Map();
    private preloadQueue: number[] = [];
    
    // Listeners for UI updates
    private stateListeners: Array<(state: PlaybackState) => void> = [];
    private chunkListeners: Array<(index: number, total: number) => void> = [];

    constructor(app: App, settings: LinguaSyncSettings) {
        this.app = app;
        this.settings = settings;
        this.cache = new TTSCache();
        
        // Always initialize cache (needed for settings UI)
        this.cacheReady = this.cache.init().catch(err => {
            console.error('[TTSManager] Cache initialization failed:', err);
            console.warn('[TTSManager] TTS will work without caching');
            // Return a resolved promise so other code doesn't break
            return Promise.resolve();
        });
        
        // Setup Media Session API for OS integration (Aloud feature)
        this.setupMediaSession();
    }
    
    private setupMediaSession() {
        if ('mediaSession' in navigator) {
            // Set action handlers for OS controls
            navigator.mediaSession.setActionHandler('play', () => {
                if (this.currentState === 'paused') {
                    this.resume();
                }
            });
            
            navigator.mediaSession.setActionHandler('pause', () => {
                if (this.currentState === 'playing') {
                    this.pause();
                }
            });
            
            navigator.mediaSession.setActionHandler('stop', () => {
                this.stop();
            });
            
            navigator.mediaSession.setActionHandler('previoustrack', () => {
                this.previous();
            });
            
            navigator.mediaSession.setActionHandler('nexttrack', () => {
                this.next();
            });
            
            console.log('[TTSManager] Media Session API initialized for OS integration');
        }
    }
    
    private updateMediaSessionMetadata(text: string) {
        if ('mediaSession' in navigator) {
            const preview = text.slice(0, 100) + (text.length > 100 ? '...' : '');
            navigator.mediaSession.metadata = new MediaMetadata({
                title: 'Aloud TTS',
                artist: 'Obsidian',
                album: 'Text to Speech',
                artwork: []
            });
        }
    }
    
    private updateMediaSessionPlaybackState(state: 'playing' | 'paused' | 'none') {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = state;
        }
    }

    // ====================== State Management ======================
    
    getState(): PlaybackState {
        return this.currentState;
    }
    
    onStateChange(callback: (state: PlaybackState) => void) {
        this.stateListeners.push(callback);
    }

    onChunkChange(callback: (index: number, total: number) => void) {
        this.chunkListeners.push(callback);
    }

    private setState(state: PlaybackState) {
        this.currentState = state;
        this.stateListeners.forEach(cb => cb(state));
    }

    private notifyChunkChange() {
        this.chunkListeners.forEach(cb => cb(this.currentChunkIndex, this.chunks.length));
    }

    // ====================== Text Chunking ======================

    chunkText(text: string, editor: Editor, from: EditorPosition, to: EditorPosition): TTSChunk[] {
        const chunkingMode = this.settings.ttsChunking || 'sentence';
        
        if (chunkingMode === 'paragraph') {
            return this.chunkByParagraph(text, editor, from, to);
        } else {
            return this.chunkBySentence(text, editor, from, to);
        }
    }

    private chunkBySentence(text: string, editor: Editor, from: EditorPosition, to: EditorPosition): TTSChunk[] {
        // Split by sentence boundaries (., !, ?, etc.)
        const sentenceRegex = /[^.!?]+[.!?]+/g;
        const sentences = text.match(sentenceRegex) || [text];
        
        const chunks: TTSChunk[] = [];
        const baseOffset = editor.posToOffset(from);
        let offset = 0; // Offset within the original text
        
        for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (trimmed.length === 0) {
                offset += sentence.length;
                continue;
            }
            
            // Find the actual start position of this sentence in the original text
            const sentenceStart = text.indexOf(sentence, offset);
            const trimStart = sentenceStart + (sentence.length - sentence.trimStart().length);
            const trimEnd = trimStart + trimmed.length;
            
            // Calculate absolute offsets (Aloud style: just numbers)
            const startOffset = baseOffset + trimStart;
            const endOffset = baseOffset + trimEnd;
            
            // Only add chunk if it has valid range
            if (endOffset > startOffset) {
                chunks.push({
                    text: trimmed,
                    start: startOffset,  // Direct number offset
                    end: endOffset       // Direct number offset
                });
                console.log('[TTSManager] Chunk:', trimmed.substring(0, 30) + '...', `(${startOffset}-${endOffset})`);
            } else {
                console.warn('[TTSManager] Skipping empty chunk:', trimmed);
            }
            
            offset = sentenceStart + sentence.length;
        }
        
        console.log('[TTSManager] Created', chunks.length, 'chunks');
        return chunks;
    }

    private chunkByParagraph(text: string, editor: Editor, from: EditorPosition, to: EditorPosition): TTSChunk[] {
        const paragraphs = text.split(/\n\n+/);
        const chunks: TTSChunk[] = [];
        const baseOffset = editor.posToOffset(from);
        let offset = 0;
        
        for (const para of paragraphs) {
            const trimmed = para.trim();
            if (trimmed.length === 0) {
                offset += para.length + 2; // +2 for \n\n
                continue;
            }
            
            // Find the actual start position
            const paraStart = text.indexOf(para, offset);
            const trimStart = paraStart + (para.length - para.trimStart().length);
            const trimEnd = trimStart + trimmed.length;
            
            const startOffset = baseOffset + trimStart;
            const endOffset = baseOffset + trimEnd;
            
            // Only add chunk if it has valid range
            if (endOffset > startOffset) {
                chunks.push({
                    text: trimmed,
                    start: startOffset,  // Direct number offset
                    end: endOffset       // Direct number offset
                });
            }
            
            offset = paraStart + para.length;
        }
        
        return chunks;
    }

    // ====================== Playback Control ======================

    async playSelection(text: string, editor: Editor, from: EditorPosition, to: EditorPosition): Promise<void> {
        // Stop any current playback
        this.stop();
        
        // Chunk the text
        this.chunks = this.chunkText(text, editor, from, to);
        
        if (this.chunks.length === 0) {
            new Notice('No text to speak');
            return;
        }
        
        // User-friendly notification
        const sentenceWord = this.chunks.length === 1 ? 'sentence' : 'sentences';
        new Notice(`🔊 Playing ${this.chunks.length} ${sentenceWord}`);
        
        // Update Media Session metadata
        this.updateMediaSessionMetadata(text);
        
        this.currentChunkIndex = 0;
        this.editor = editor;
        this.setState('loading');
        
        await this.playCurrentChunk();
    }

    async playCurrentChunk(): Promise<void> {
        if (this.currentChunkIndex < 0 || this.currentChunkIndex >= this.chunks.length) {
            console.error('[TTS] Invalid chunk index:', this.currentChunkIndex);
            this.stop();
            return;
        }
        
        const chunk = this.chunks[this.currentChunkIndex];
        console.log('[TTS] Playing chunk:', this.currentChunkIndex, '/', this.chunks.length, chunk.text.substring(0, 50));
        
        // Preload next 2-3 chunks in background
        this.preloadNextChunks();
        
        this.setState('loading');
        this.notifyChunkChange();
        
        try {
            // Try to use preloaded audio first
            let audioBuffer = this.preloadedAudio.get(this.currentChunkIndex);
            if (audioBuffer) {
                console.log('[TTS] 🎯 Using preloaded audio for chunk', this.currentChunkIndex);
                this.preloadedAudio.delete(this.currentChunkIndex);
            } else {
                console.log('[TTS] 📡 Fetching audio for chunk', this.currentChunkIndex);
                audioBuffer = await this.fetchAudio(chunk.text);
            }
            
            await this.playAudioBuffer(audioBuffer);
            
            // Auto-advance to next chunk (seamless, no gap)
            if (this.currentState !== 'idle') {
                this.currentChunkIndex++;
                
                // Check if we've reached the end BEFORE notifying
                if (this.currentChunkIndex >= this.chunks.length) {
                    this.stop();
                    return;
                }
                
                this.notifyChunkChange();
                // Immediately play next chunk (no await for state change)
                this.playCurrentChunk(); // Fire and forget for seamless playback
            }
        } catch (error) {
            console.error('TTS playback error:', error);
            new Notice(`TTS Error: ${error.message}`);
            this.stop();
        }
    }
    
    private async preloadNextChunks(): Promise<void> {
        const PRELOAD_COUNT = 2; // Preload 2 chunks ahead
        
        for (let i = 1; i <= PRELOAD_COUNT; i++) {
            const nextIndex = this.currentChunkIndex + i;
            if (nextIndex < this.chunks.length && !this.preloadedAudio.has(nextIndex)) {
                const chunk = this.chunks[nextIndex];
                
                // Preload in background without blocking
                this.fetchAudio(chunk.text).then(buffer => {
                    this.preloadedAudio.set(nextIndex, buffer);
                    console.log('[TTS] ✅ Preloaded chunk', nextIndex);
                }).catch(err => {
                    console.warn('[TTS] Failed to preload chunk', nextIndex, err);
                });
            }
        }
    }

    async pause(): Promise<void> {
        if (this.currentState !== 'playing') return;
        
        if (this.audioElement) {
            this.pausedAt = this.audioElement.currentTime;
            this.audioElement.pause();
            this.isPaused = true;
            this.setState('paused');
            this.updateMediaSessionPlaybackState('paused');
            console.log('[TTS] Paused at:', this.pausedAt);
        }
    }

    async resume(): Promise<void> {
        if (this.currentState !== 'paused' || !this.isPaused) return;
        
        this.isPaused = false;
        
        if (this.audioElement) {
            // HTMLAudioElement can resume directly
            this.audioElement.play().then(() => {
                console.log('[TTS] Resumed from:', this.pausedAt);
                this.setState('playing');
                this.updateMediaSessionPlaybackState('playing');
            }).catch((error) => {
                console.error('[TTS] Failed to resume:', error);
                this.stop();
            });
        }
    }

    stop(): void {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
        if (this.currentAudioUrl) {
            URL.revokeObjectURL(this.currentAudioUrl);
            this.currentAudioUrl = null;
        }
        this.isPaused = false;
        this.pausedAt = 0;
        
        // Clear preloaded audio
        this.preloadedAudio.clear();
        
        this.setState('idle');
        this.updateMediaSessionPlaybackState('none');
        console.log('[TTS] Stopped');
    }

    async next(): Promise<void> {
        if (this.currentChunkIndex < this.chunks.length - 1) {
            this.currentChunkIndex++;
            this.notifyChunkChange();
            
            // Stop current playback
            if (this.audioElement) {
                this.audioElement.pause();
            }
            
            // Play next chunk
            await this.playCurrentChunk();
        }
    }

    async previous(): Promise<void> {
        if (this.currentChunkIndex > 0) {
            this.currentChunkIndex--;
            this.notifyChunkChange();
            
            // Stop current playback
            if (this.audioElement) {
                this.audioElement.pause();
            }
            
            // Play previous chunk
            await this.playCurrentChunk();
        }
    }

    setPlaybackSpeed(speed: number): void {
        console.log('[TTSManager] setPlaybackSpeed called, speed:', speed);
        
        // Update setting
        this.settings.ttsSpeed = speed;
        
        // Apply to HTMLAudioElement (can change anytime!)
        if (this.audioElement) {
            this.audioElement.playbackRate = speed;
            console.log('[TTSManager] ✅ Playback speed changed instantly to:', speed);
        } else {
            console.log('[TTSManager] Not playing, speed will apply on next play');
        }
    }

    // ====================== Audio Fetching & Caching ======================

    private async fetchAudio(text: string): Promise<ArrayBuffer> {
        const provider = this.settings.ttsProvider || 'openai';
        const voice = this.settings.ttsVoice || 'alloy';
        const speed = 1.0;  // Always cache at normal speed, apply playbackRate during playback
        const model = this.settings.ttsModel || 'tts-1';
        
        console.log('[TTS] fetchAudio - caching at speed 1.0, playback speed:', this.settings.ttsSpeed, 'text:', text.substring(0, 30));
        
        // Check cache (local or vault, not none)
        const usesCache = this.settings.ttsCacheType !== 'none';
        if (usesCache) {
            try {
                // Ensure cache is ready before using it
                await this.cacheReady;
                
                const cacheKey = this.cache.generateKey(text, provider, voice, speed, model);
                console.log('[TTS] Cache key generated with speed:', speed, 'key:', cacheKey);
                
                const cached = await this.cache.get(cacheKey);
                if (cached) {
                    console.log('[TTS] ✅ Cache HIT for speed:', speed, 'text:', text.substring(0, 30));
                    return cached;
                } else {
                    console.log('[TTS] ❌ Cache MISS for speed:', speed, 'text:', text.substring(0, 30));
                }
            } catch (err) {
                console.warn('[TTS] Cache read failed, fetching from API:', err);
                // Continue to fetch from API
            }
        }
        
        // Fetch from API
        console.log('[TTS] 🔄 Calling API with provider:', provider, 'speed:', speed);
        let audioBuffer: ArrayBuffer;
        
        switch (provider) {
            case 'openai':
                audioBuffer = await this.speakOpenAI(text);
                console.log('[TTS] ✅ API call completed, received audio buffer');
                break;
            case 'azure':
                audioBuffer = await this.speakAzure(text);
                break;
            case 'elevenlabs':
                audioBuffer = await this.speakElevenLabs(text);
                break;
            default:
                throw new Error(`Unsupported TTS provider: ${provider}`);
        }
        
        console.log('[TTS] 📦 Audio buffer size:', audioBuffer.byteLength, 'bytes');
        
        // Save to cache
        if (usesCache) {
            try {
                await this.cacheReady;
                const cacheKey = this.cache.generateKey(text, provider, voice, speed, model);
                await this.cache.set(cacheKey, audioBuffer);
                console.log('[TTS] Cached audio for:', text.substring(0, 50));
            } catch (err) {
                console.warn('[TTS] Failed to cache audio:', err);
                // Continue without caching
            }
        }
        
        return audioBuffer;
    }

    private async playAudioBuffer(audioBuffer: ArrayBuffer, startOffset: number = 0): Promise<void> {
        return new Promise((resolve, reject) => {
            // Create or reuse HTMLAudioElement (Aloud's approach)
            if (!this.audioElement) {
                this.audioElement = new Audio();
                console.log('[TTS] Created new HTMLAudioElement');
            }
            
            // Pause current playback to avoid conflicts
            this.audioElement.pause();
            
            // Clean up previous audio URL
            if (this.currentAudioUrl) {
                URL.revokeObjectURL(this.currentAudioUrl);
                this.currentAudioUrl = null;
            }
            
            // Create Blob from ArrayBuffer
            const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(blob);
            this.currentAudioUrl = audioUrl;
            
            // Set up event handlers BEFORE setting src
            const onended = () => {
                console.log('[TTS] Audio ended');
                this.audioElement!.removeEventListener('ended', onended);
                this.audioElement!.removeEventListener('error', onerror);
                this.audioElement!.removeEventListener('loadeddata', onloadeddata);
                resolve();
            };
            
            const onerror = (e: Event) => {
                console.error('[TTS] Audio error:', e);
                this.audioElement!.removeEventListener('ended', onended);
                this.audioElement!.removeEventListener('error', onerror);
                this.audioElement!.removeEventListener('loadeddata', onloadeddata);
                reject(new Error('Audio playback failed'));
            };
            
            const onloadeddata = () => {
                console.log('[TTS] Audio loaded, starting playback');
                this.audioElement!.removeEventListener('loadeddata', onloadeddata);
                
                // Apply playback rate
                const speed = this.settings.ttsSpeed || 1.0;
                this.audioElement!.playbackRate = speed;
                console.log('[TTS] Setting playbackRate to:', speed);
                
                // Set start offset
                if (startOffset > 0) {
                    this.audioElement!.currentTime = startOffset;
                }
                
                // Start playback
                this.audioElement!.play().then(() => {
                    console.log('[TTS] Playback started successfully');
                    this.setState('playing');
                    this.updateMediaSessionPlaybackState('playing');
                }).catch((error) => {
                    console.error('[TTS] Failed to start playback:', error);
                    reject(error);
                });
            };
            
            this.audioElement.addEventListener('ended', onended);
            this.audioElement.addEventListener('error', onerror);
            this.audioElement.addEventListener('loadeddata', onloadeddata, { once: true });
            
            // Set src to trigger loading
            this.audioElement.src = audioUrl;
            this.audioElement.load(); // Explicitly trigger load
        });
    }

    // ====================== TTS Provider APIs ======================

    async speakOpenAI(text: string): Promise<ArrayBuffer> {
        const apiKey = this.settings.ttsApiKey || this.settings.aiApiKey;
        if (!apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const model = this.settings.ttsModel || 'tts-1';
        const voice = this.settings.ttsVoice || 'alloy';
        // Don't use speed parameter - handle it with playbackRate instead (Aloud's approach)
        const speed = 1.0;  // Always request at normal speed
        
        console.log('[TTS] speakOpenAI - calling API at normal speed (1.0), playback speed will be applied via playbackRate');

        try {
            const response = await requestUrl({
                url: 'https://api.openai.com/v1/audio/speech',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    input: text,
                    voice: voice,
                    speed: speed
                })
            });

            if (response.status === 200) {
                return response.arrayBuffer;
            } else {
                throw new Error(`OpenAI TTS failed with status ${response.status}`);
            }
        } catch (error) {
            console.error('OpenAI TTS error:', error);
            throw new Error(`OpenAI TTS error: ${error.message}`);
        }
    }

    async speakAzure(text: string): Promise<ArrayBuffer> {
        const apiKey = this.settings.ttsApiKey || this.settings.aiApiKey;
        const region = this.settings.ttsBaseUrl || 'eastus';
        const voice = this.settings.ttsVoice || 'en-US-JennyNeural';
        const outputFormat = this.settings.ttsOutputFormat || 'audio-16khz-128kbitrate-mono-mp3';

        if (!apiKey) {
            throw new Error('Azure API key not configured');
        }

        try {
            // Construct SSML
            const ssml = `<speak version='1.0' xml:lang='en-US'>
                <voice name='${voice}'>${text}</voice>
            </speak>`;

            const response = await requestUrl({
                url: `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey,
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': outputFormat,
                    'User-Agent': 'OB-English-Learner'
                },
                body: ssml
            });

            if (response.status === 200) {
                return response.arrayBuffer;
            } else {
                throw new Error(`Azure TTS failed with status ${response.status}`);
            }
        } catch (error) {
            console.error('Azure TTS error:', error);
            throw new Error(`Azure TTS error: ${error.message}`);
        }
    }

    async speakElevenLabs(text: string): Promise<ArrayBuffer> {
        const apiKey = this.settings.ttsApiKey || this.settings.aiApiKey;
        const voiceId = this.settings.ttsVoice || '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel
        const modelId = this.settings.ttsModel || 'eleven_monolingual_v1';

        if (!apiKey) {
            throw new Error('ElevenLabs API key not configured');
        }

        try {
            const response = await requestUrl({
                url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: modelId,
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (response.status === 200) {
                return response.arrayBuffer;
            } else {
                throw new Error(`ElevenLabs TTS failed with status ${response.status}`);
            }
        } catch (error) {
            console.error('ElevenLabs TTS error:', error);
            throw new Error(`ElevenLabs TTS error: ${error.message}`);
        }
    }

    // ====================== Azure Voice List ======================

    async getAzureVoices(): Promise<any[]> {
        try {
            const apiKey = this.settings.ttsApiKey || this.settings.aiApiKey;
            const region = this.settings.ttsBaseUrl || 'eastus';
            
            if (!apiKey || !region) {
                console.error('Azure TTS: Missing API key or region');
                return [];
            }

            const response = await requestUrl({
                url: `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
                method: 'GET',
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey
                }
            });

            if (response.status === 200) {
                return response.json;
            } else {
                console.error('Failed to fetch Azure voices:', response.status);
                return [];
            }
        } catch (error) {
            console.error('Error fetching Azure voices:', error);
            throw error;
        }
    }

    // ====================== Cache Management ======================

    async getCacheSize(): Promise<number> {
        try {
            await this.cacheReady;
            return await this.cache.getSize();
        } catch (err) {
            console.error('[TTS] Failed to get cache size:', err);
            return 0;
        }
    }

    async clearCache(): Promise<void> {
        try {
            await this.cacheReady;
            await this.cache.clear();
            new Notice('✅ TTS cache cleared');
        } catch (err) {
            console.error('[TTS] Failed to clear cache:', err);
            // Try to reset the database if clear fails
            try {
                console.log('[TTS] Attempting to reset database...');
                await this.cache.reset();
                await this.cache.init();
                new Notice('✅ TTS cache reset successfully');
            } catch (resetErr) {
                console.error('[TTS] Failed to reset cache:', resetErr);
                new Notice('❌ Failed to clear cache');
            }
        }
    }

    async cleanOldCache(): Promise<void> {
        try {
            await this.cacheReady;
            const maxAgeHours = this.settings.ttsCacheDuration || 24;
            await this.cache.cleanOldEntries(maxAgeHours);
        } catch (err) {
            console.error('[TTS] Failed to clean old cache:', err);
        }
    }

    // ====================== Simple Test Function ======================

    async testSpeak(text: string): Promise<void> {
        // Simple test function that plays a single chunk without UI
        const audioBuffer = await this.fetchAudio(text);
        await this.playAudioBuffer(audioBuffer);
    }
}
