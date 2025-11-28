import { requestUrl, App } from 'obsidian';
import { VideoData, VideoMetadata, TranscriptLine } from './types';
import { AITranslator, TranslatorConfig } from './translator';
import { BilibiliScraper } from './bilibili-scraper';
import { DirectYouTubeTranscript } from './youtube-transcript-direct';

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
     * Get built-in transcript fetcher (no external plugin dependency)
     */
    private static getYTranscriptAPI(): YTranscriptAPI {
        console.log('[LinguaSync] ✅ Using built-in transcript fetcher');
        
        return {
            getTranscript: async (url: string, options?: { lang?: string }) => {
                const response = await DirectYouTubeTranscript.getTranscript(url, options);
                return {
                    lines: response.lines
                };
            }
        };
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
        console.log('[LinguaSync] Fetching transcript using built-in fetcher...');
        console.log('[LinguaSync] Video URL:', pageUrl);

        try {
            // Extract metadata first with browser-like headers
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
        console.log('[LinguaSync] 🔍 Extracting metadata for video:', videoId);
        
        let title = '';
        let author = 'Unknown Author';
        let duration = 0;
        
        // Strategy 1: Extract from ytInitialPlayerResponse JSON (most reliable)
        // Try multiple regex patterns for different YouTube HTML variations
        let playerResponse: any = null;
        
        // Pattern 1: Standard format with 'var' (using [\s\S] for multiline compatibility)
        let match = html.match(/var ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});(?:\s|var|<)/);
        if (!match) {
            // Pattern 2: Without line breaks (older format)
            const htmlOneLine = html.replace(/\n/g, ' ');
            match = htmlOneLine.match(/var ytInitialPlayerResponse\s*=\s*(\{[^;]+\});/);
        }
        if (!match) {
            // Pattern 3: Direct assignment without 'var'
            match = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});(?:\s|var|<)/);
        }
        
        if (match && match[1]) {
            try {
                console.log('[LinguaSync] 🔍 Found playerResponse, JSON length:', match[1].length);
                playerResponse = JSON.parse(match[1]);
                console.log('[LinguaSync] ✅ Parsed ytInitialPlayerResponse');
                
                const videoDetails = playerResponse?.videoDetails;
                console.log('[LinguaSync] videoDetails:', videoDetails ? 'EXISTS' : 'MISSING');
                
                if (videoDetails) {
                    if (videoDetails.title) {
                        title = videoDetails.title;
                        console.log('[LinguaSync] ✅ Title from videoDetails:', title);
                    }
                    if (videoDetails.author) {
                        author = videoDetails.author;
                    }
                    if (videoDetails.lengthSeconds) {
                        duration = parseInt(videoDetails.lengthSeconds);
                    }
                } else {
                    console.warn('[LinguaSync] ⚠️ videoDetails not found in playerResponse');
                    console.log('[LinguaSync] playerResponse keys:', Object.keys(playerResponse));
                    
                    // Try to extract from playabilityStatus (for restricted videos)
                    const playability = playerResponse?.playabilityStatus;
                    if (playability?.errorScreen) {
                        const errorScreen = playability.errorScreen;
                        // Try playerErrorMessageRenderer
                        const errorRenderer = errorScreen.playerErrorMessageRenderer;
                        if (errorRenderer?.reason?.simpleText) {
                            console.log('[LinguaSync] Found playability error:', errorRenderer.reason.simpleText);
                        }
                    }
                    
                    // Try to extract from microformat (backup location)
                    const microformat = playerResponse?.microformat?.playerMicroformatRenderer;
                    if (microformat) {
                        if (microformat.title?.simpleText) {
                            title = microformat.title.simpleText;
                            console.log('[LinguaSync] ✅ Title from microformat:', title);
                        }
                        if (microformat.ownerChannelName) {
                            author = microformat.ownerChannelName;
                        }
                        if (microformat.lengthSeconds) {
                            duration = parseInt(microformat.lengthSeconds);
                        }
                    }
                }
            } catch (error) {
                console.warn('[LinguaSync] ⚠️ Failed to parse ytInitialPlayerResponse:', error);
                console.log('[LinguaSync] JSON snippet (first 500 chars):', match[1].substring(0, 500));
            }
        } else {
            console.warn('[LinguaSync] ⚠️ ytInitialPlayerResponse not found in HTML');
        }
        
        // Strategy 2: Extract from <title> tag (fallback)
        if (!title) {
            const titleMatch = html.match(/<title>([^<]+)<\/title>/);
            if (titleMatch) {
                // YouTube title format: "Video Title - YouTube"
                let extractedTitle = titleMatch[1].replace(/\s*-\s*YouTube\s*$/, '').trim();
                // Only use if we actually got a meaningful title
                if (extractedTitle && extractedTitle.length > 0) {
                    title = extractedTitle;
                    console.log('[LinguaSync] ✅ Title from <title> tag:', title);
                } else {
                    console.log('[LinguaSync] ⚠️ <title> tag exists but contains no meaningful title');
                }
            }
        }
        
        // Strategy 3: Extract from og:title meta tag (fallback)
        if (!title) {
            const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
            if (ogTitleMatch) {
                title = ogTitleMatch[1];
                console.log('[LinguaSync] ✅ Title from og:title:', title);
            }
        }
        
        // Strategy 4: Extract from twitter:title meta tag (fallback)
        if (!title) {
            const twitterTitleMatch = html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);
            if (twitterTitleMatch) {
                title = twitterTitleMatch[1];
                console.log('[LinguaSync] ✅ Title from twitter:title:', title);
            }
        }
        
        // Strategy 5: Extract from name="title" meta tag (fallback)
        if (!title) {
            const metaTitleMatch = html.match(/<meta\s+name=["']title["']\s+content=["']([^"']+)["']/i);
            if (metaTitleMatch) {
                title = metaTitleMatch[1];
                console.log('[LinguaSync] ✅ Title from meta name="title":', title);
            }
        }
        
        // Last resort fallback
        if (!title) {
            title = `Video ${videoId}`;
            console.warn('[LinguaSync] ⚠️ No title found, using fallback:', title);
        }
        
        // Clean title by removing leading/trailing quotes and HTML entities
        title = title
            .replace(/^["'""「]|["'""」]$/g, '')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .trim();

        // Clean author as well
        author = author
            .replace(/^["'""「]|["'""」]$/g, '')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .trim();
        
        console.log('[LinguaSync] 📝 Final metadata - Title:', title, '| Author:', author);
        
        return {
            videoId,
            title,
            author,
            channel: author,
            duration,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            uploadDate: new Date().toISOString().split('T')[0]
        };
    }
}
