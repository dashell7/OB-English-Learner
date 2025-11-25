import { requestUrl, App } from 'obsidian';
import { VideoData, VideoMetadata, TranscriptLine } from './types';
import { AITranslator, TranslatorConfig } from './translator';
import { BilibiliScraper } from './bilibili-scraper';

// Type declaration for YTranscript plugin API
interface YTranscriptAPI {
    getTranscript(url: string, options?: { lang?: string; country?: string }): Promise<{
        lines: Array<{
            offset: number;
            duration: number;
            text: string;
        }>;
    }>;
}

export class YouTubeScraper {
    /**
     * Get YTranscript plugin API
     */
    private static getYTranscriptAPI(): YTranscriptAPI {
        // @ts-ignore - Access global ytranscript plugin
        const ytPlugin = window.app?.plugins?.plugins?.ytranscript;
        
        if (!ytPlugin) {
            throw new Error('YTranscript plugin not found or not loaded. Please install and enable the YTranscript plugin.');
        }
        
        // 1. Try accessing the .api object (standard way if supported)
        if (ytPlugin.api) {
            return ytPlugin.api;
        }
        
        // 2. Try accessing getTranscript directly (if exposed on plugin instance)
        if (typeof ytPlugin.getTranscript === 'function') {
            console.log('[LinguaSync] Using direct getTranscript method from YTranscript');
            // Wrap it to match the interface
            return {
                getTranscript: async (url: string, options?: { lang?: string }) => {
                    return await ytPlugin.getTranscript(url, options);
                }
            };
        }

        throw new Error('YTranscript plugin loaded but API not compatible. Please update YTranscript plugin.');
    }

    /**
     * Extract video ID from various URL formats (YouTube & Bilibili)
     */
    static extractVideoId(url: string): string | null {
        // Check for Bilibili first
        if (BilibiliScraper.isBilibiliUrl(url)) {
            return BilibiliScraper.extractBvId(url);
        }

        // YouTube Logic
        // 1. Direct Video ID (11 chars)
        if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
            return url;
        }

        try {
            // 2. Handle URLs without protocol
            if (!url.startsWith('http')) {
                url = 'https://' + url;
            }

            const urlObj = new URL(url);

            // 3. Handle youtu.be/ID
            if (urlObj.hostname.includes('youtu.be')) {
                return urlObj.pathname.slice(1);
            }

            // 4. Handle youtube.com
            if (urlObj.hostname.includes('youtube.com')) {
                // Standard: /watch?v=ID
                if (urlObj.searchParams.has('v')) {
                    return urlObj.searchParams.get('v');
                }
                
                // Shorts: /shorts/ID
                if (urlObj.pathname.startsWith('/shorts/')) {
                    return urlObj.pathname.split('/')[2];
                }

                // Embed: /embed/ID
                if (urlObj.pathname.startsWith('/embed/')) {
                    return urlObj.pathname.split('/')[2];
                }
                
                // Live: /live/ID
                if (urlObj.pathname.startsWith('/live/')) {
                    return urlObj.pathname.split('/')[2];
                }
            }

            return null;
        } catch (e) {
            // Fallback to regex if URL parsing fails
            console.warn('[LinguaSync] URL parsing failed, falling back to regex:', e);
            const patterns = [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
                /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
                /^([a-zA-Z0-9_-]{11})$/
            ];
    
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match) {
                    return match[1];
                }
            }
            return null;
        }
    }

    /**
     * Fetch video metadata and transcript (Supports YouTube & Bilibili)
     */
    static async fetchVideoData(url: string, translatorConfig?: TranslatorConfig): Promise<VideoData> {
        // Dispatch to Bilibili Scraper if detected
        if (BilibiliScraper.isBilibiliUrl(url)) {
            return await BilibiliScraper.fetchVideoData(url);
        }

        // Default to YouTube logic
        return await this.fetchYouTubeData(url, translatorConfig);
    }

    /**
     * Internal method for YouTube fetching logic
     */
    private static async fetchYouTubeData(url: string, translatorConfig?: TranslatorConfig): Promise<VideoData> {
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }

        const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
        console.log('[LinguaSync] Fetching transcript using YTranscript plugin...');
        console.log('[LinguaSync] Video URL:', pageUrl);

        try {
            // Extract metadata first
            const response = await requestUrl({ url: pageUrl });
            const metadata = this.extractMetadata(response.text, videoId);
            
            // Strategy: Try to get both English and Chinese transcripts
            // Detect language by content, not by language code
            console.log('[LinguaSync] Fetching transcripts...');
            
            let enTranscript: TranscriptLine[] | null = null;
            let zhTranscript: TranscriptLine[] | null = null;
            
            // Strategy 1: Try to get English transcript explicitly first
            const englishLangCodes = ['en', 'en-US', 'en-GB'];
            for (const langCode of englishLangCodes) {
                try {
                    console.log(`[LinguaSync] Trying to fetch English transcript: ${langCode}`);
                    const YoutubeTranscript = this.getYTranscriptAPI();
                    const response = await YoutubeTranscript.getTranscript(pageUrl, {
                        lang: langCode,
                        country: 'US' // Force US location to avoid auto-translation based on IP
                    });
                    
                    // Verify it's actually English by checking content
                    const firstLine = response.lines[0]?.text || '';
                    const hasChinese = /[\u4e00-\u9fa5]/.test(firstLine);
                    
                    if (!hasChinese) {
                        console.log('[LinguaSync] First line preview:', firstLine.substring(0, 50));
                        console.log(`[LinguaSync] ✅ Successfully fetched English transcript`);
                        enTranscript = response.lines.map((line: any) => ({
                            start: line.offset / 1000,
                            duration: line.duration / 1000,
                            text: line.text,
                            lang: 'en'
                        }));
                        break;
                    } else {
                        console.log(`[LinguaSync] ⚠️ ${langCode} returned Chinese content, trying next...`);
                    }
                } catch (e) {
                    console.log(`[LinguaSync] ${langCode} not available, trying next...`);
                }
            }
            
            // Strategy 2: If English not found, try to get original language
            if (!enTranscript) {
                try {
                    console.log(`[LinguaSync] Fetching original language transcript...`);
                    const YoutubeTranscript = this.getYTranscriptAPI();
                    const originalResponse = await YoutubeTranscript.getTranscript(pageUrl);
                    
                    // Detect language by content
                    const firstLine = originalResponse.lines[0]?.text || '';
                    const hasChinese = /[\u4e00-\u9fa5]/.test(firstLine);
                    
                    console.log('[LinguaSync] First line preview:', firstLine.substring(0, 50));
                    
                    if (hasChinese) {
                        console.log(`[LinguaSync] ✅ Original transcript is Chinese`);
                        zhTranscript = originalResponse.lines.map((line: any) => ({
                            start: line.offset / 1000,
                            duration: line.duration / 1000,
                            text: line.text,
                            lang: 'zh'
                        }));
                    } else {
                        console.log(`[LinguaSync] ✅ Original transcript is English`);
                        enTranscript = originalResponse.lines.map((line: any) => ({
                            start: line.offset / 1000,
                            duration: line.duration / 1000,
                            text: line.text,
                            lang: 'en'
                        }));
                    }
                } catch (e) {
                    console.error(`[LinguaSync] Failed to fetch original transcript:`, e);
                }
            }
            
            // Strategy 3: Try to get Chinese transcript/translation
            if (!zhTranscript) {
                // If we have English and AI translation is enabled, use AI
                if (enTranscript && translatorConfig) {
                    console.log('[LinguaSync] Using AI to translate English to Chinese...');
                    try {
                        const translator = new AITranslator(translatorConfig);
                        zhTranscript = await translator.translateTranscript(enTranscript);
                        console.log(`[LinguaSync] ✅ AI translation completed: ${zhTranscript.length} lines`);
                    } catch (error) {
                        console.error('[LinguaSync] AI translation failed:', error);
                    }
                }
                
                // If AI not available or failed, try YouTube's Chinese translation
                if (!zhTranscript) {
                    const chineseLangCodes = ['zh-Hans', 'zh-CN', 'zh', 'zh-TW'];
                    
                    for (const langCode of chineseLangCodes) {
                        try {
                            console.log(`[LinguaSync] Trying Chinese transcript: ${langCode}`);
                            const YoutubeTranscript = this.getYTranscriptAPI();
                            const response = await YoutubeTranscript.getTranscript(pageUrl, {
                                lang: langCode
                            });
                            
                            const firstLine = response.lines[0]?.text || '';
                            const hasChinese = /[\u4e00-\u9fa5]/.test(firstLine);
                            
                            if (hasChinese) {
                                console.log(`[LinguaSync] ✅ Found Chinese transcript`);
                                zhTranscript = response.lines.map((line: any) => ({
                                    start: line.offset / 1000,
                                    duration: line.duration / 1000,
                                    text: line.text,
                                    lang: 'zh'
                                }));
                                break;
                            }
                        } catch (e) {
                            console.log(`[LinguaSync] ${langCode} not available, trying next...`);
                        }
                    }
                }
            }
            
            // Determine which to use as primary transcript
            // IMPORTANT: For Language Learner, ALWAYS use English as primary display if available
            let transcript: TranscriptLine[];
            let translatedTranscript: TranscriptLine[] | undefined;
            
            // Resegment transcripts to ensure full sentences
            if (enTranscript) {
                console.log('[LinguaSync] Resegmenting English transcript...');
                enTranscript = this.resegmentTranscript(enTranscript);
            }
            if (zhTranscript) {
                console.log('[LinguaSync] Resegmenting Chinese transcript...');
                zhTranscript = this.resegmentTranscript(zhTranscript);
            }
            
            if (enTranscript) {
                // English is available - use it as primary for note display
                console.log('[LinguaSync] ✅ Using English as primary transcript (for note display)');
                console.log(`[LinguaSync] English: ${enTranscript.length} lines, Chinese: ${zhTranscript ? zhTranscript.length : 0} lines`);
                transcript = enTranscript;
                translatedTranscript = zhTranscript || undefined;
            } else if (zhTranscript) {
                // Only Chinese available - use it but warn user
                console.log('[LinguaSync] ⚠️ No English transcript found, using Chinese as fallback');
                console.log('[LinguaSync] ⚠️ Note: Language Learner works best with English content');
                console.log(`[LinguaSync] Chinese: ${zhTranscript.length} lines`);
                transcript = zhTranscript;
                translatedTranscript = undefined;
            } else {
                throw new Error('No transcripts found for this video. The video may not have captions enabled.');
            }

            // Add URL to metadata
            metadata.url = url;

            return {
                metadata,
                transcript,
                translatedTranscript
            };
        } catch (error) {
            console.error('[LinguaSync] YTranscript failed:', error);
            throw new Error(`Failed to fetch transcript: ${error.message}`);
        }
    }

    /**
     * Resegment transcript based on punctuation to form complete sentences
     */
    private static resegmentTranscript(lines: TranscriptLine[]): TranscriptLine[] {
        if (!lines || lines.length === 0) return [];

        // Check if transcript has punctuation
        const allText = lines.map(l => l.text).join(' ');
        const punctuationCount = (allText.match(/[.!?。！？]/g) || []).length;
        
        // If very few punctuation marks (e.g. < 1 per 10 lines), assume it's unpunctuated
        // and return original lines to avoid merging everything into one block
        if (punctuationCount < lines.length / 10) {
            console.log('[LinguaSync] Few punctuation marks detected, skipping resegmentation');
            return lines;
        }

        // Flatten text and calculate approximate char-level timing
        const allChars: { char: string, time: number }[] = [];
        
        for (const line of lines) {
            if (!line.text) continue;
            const safeText = line.text;
            const durationPerChar = (line.duration || 0) / safeText.length;
            
            for (let i = 0; i < safeText.length; i++) {
                allChars.push({
                    char: safeText[i],
                    time: line.start + (i * durationPerChar)
                });
            }
            // Add implicit space between original lines
            allChars.push({ char: ' ', time: line.start + line.duration });
        }

        const newLines: TranscriptLine[] = [];
        let currentText = '';
        let startTime = allChars.length > 0 ? allChars[0].time : 0;
        
        const sentenceEndRegex = /[.!?。！？]/;

        for (let i = 0; i < allChars.length; i++) {
            const c = allChars[i];
            currentText += c.char;

            const isTerminator = sentenceEndRegex.test(c.char);
            
            // Look ahead to avoid splitting on "..." or "!!"
            const nextChar = i + 1 < allChars.length ? allChars[i+1].char : '';
            const isNextTerminator = sentenceEndRegex.test(nextChar);
            
            // Basic check for abbreviations (Mr. Dr. etc) - simplified
            const isAbbreviation = /\b(Mr|Mrs|Ms|Dr|Prof|St|Ave|Co|Inc|Ltd)\.$/i.test(currentText.trim());
            
            if (isTerminator && !isNextTerminator && !isAbbreviation) {
                const endTime = c.time;
                const finalText = currentText.trim();
                
                if (finalText) {
                    newLines.push({
                        text: finalText,
                        start: startTime,
                        duration: Math.max(0.1, endTime - startTime),
                        lang: lines[0].lang
                    });
                }
                
                currentText = '';
                if (i + 1 < allChars.length) {
                    startTime = allChars[i+1].time;
                }
            }
        }

        // Add remaining text
        if (currentText.trim()) {
             newLines.push({
                text: currentText.trim(),
                start: startTime,
                duration: Math.max(0.1, (allChars[allChars.length-1]?.time || startTime) - startTime),
                lang: lines[0].lang
            });
        }

        return newLines;
    }

    /**
     * Extract metadata from YouTube page HTML
     */
    private static extractMetadata(html: string, videoId: string): VideoMetadata {
        // Extract ytInitialPlayerResponse JSON
        const match = html.match(/var ytInitialPlayerResponse = ({.+?});/);
        if (!match) {
            throw new Error('Failed to extract video metadata');
        }

        const playerResponse = JSON.parse(match[1]);
        const videoDetails = playerResponse.videoDetails;

        // Clean title by removing leading/trailing quotes (ASCII and Unicode quotes)
        const rawTitle = videoDetails.title || 'Unknown Title';
        console.log('[LinguaSync] 🔍 DEBUG - Raw title from YouTube:', rawTitle);
        console.log('[LinguaSync] 🔍 DEBUG - Raw title charCodes:', rawTitle.split('').map((c: string) => c.charCodeAt(0)).join(','));
        
        // Remove various types of quotes: " ' " " 「 」
        const cleanTitle = rawTitle.replace(/^["'""「]|["'""」]$/g, '').trim();
        console.log('[LinguaSync] 🔍 DEBUG - Clean title after removing quotes:', cleanTitle);
        
        return {
            videoId,
            title: cleanTitle,
            author: videoDetails.author || 'Unknown Author',
            channel: videoDetails.author || 'Unknown Channel',
            duration: parseInt(videoDetails.lengthSeconds) || 0,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            uploadDate: new Date().toISOString().split('T')[0]
        };
    }


    // No longer needed - using YTranscript plugin

    /**
     * Decode HTML entities in transcript text
     */
    private static decodeHtmlEntities(text: string): string {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n/g, ' ')
            .trim();
    }
}
