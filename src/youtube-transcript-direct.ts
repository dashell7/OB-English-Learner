import { requestUrl, RequestUrlResponse } from 'obsidian';

export interface TranscriptLine {
    offset: number;
    duration: number;
    text: string;
}

export interface TranscriptResponse {
    lines: TranscriptLine[];
    title?: string;
}

interface CaptionTrack {
    baseUrl: string;
    languageCode: string;
    name?: string;
    kind?: string;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
        .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\u0026/g, '&')
        .replace(/\\n/g, '\n');
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url: string): string {
    const patterns = [
        /[?&]v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /\/shorts\/([a-zA-Z0-9_-]{11})/,
        /\/embed\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return "";
}

/**
 * Parse XML timedtext response
 */
function parseTimedTextXML(xml: string): TranscriptLine[] {
    const lines: TranscriptLine[] = [];
    const regex = /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>([^<]*)<\/text>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
        const start = parseFloat(match[1]) * 1000;
        const duration = parseFloat(match[2]) * 1000;
        let text = decodeHtmlEntities(match[3]).replace(/\n/g, ' ').trim();
        if (text) {
            lines.push({ offset: start, duration, text });
        }
    }
    return lines;
}

/**
 * Parse JSON3 timedtext response
 */
function parseJSON3Response(json: any): TranscriptLine[] {
    const lines: TranscriptLine[] = [];
    try {
        const events = json?.events || [];
        for (const event of events) {
            if (event.segs) {
                const text = event.segs.map((seg: any) => seg.utf8 || '').join('').trim();
                if (text && text !== '\n') {
                    lines.push({
                        offset: event.tStartMs || 0,
                        duration: event.dDurationMs || 0,
                        text: text.replace(/\n/g, ' ')
                    });
                }
            }
        }
    } catch (e) {
        console.error('[LinguaSync] Failed to parse JSON3:', e);
    }
    return lines;
}

/**
 * Extract caption tracks from ytInitialPlayerResponse - DownSub method
 */
function extractCaptionTracksFromPlayerResponse(html: string): CaptionTrack[] {
    const tracks: CaptionTrack[] = [];

    console.log('[LinguaSync] === DownSub-style captionTracks extraction ===');
    console.log(`[LinguaSync] HTML length: ${html.length}`);

    // Method 1: Direct search for captionTracks JSON
    const captionTracksPatterns = [
        /"captionTracks"\s*:\s*(\[[\s\S]*?\])\s*,\s*"audioTracks"/,
        /"captionTracks"\s*:\s*(\[[\s\S]*?\])\s*,\s*"translationLanguages"/,
        /"captionTracks"\s*:\s*(\[[\s\S]*?\])\s*\}/,
    ];

    for (const pattern of captionTracksPatterns) {
        const match = html.match(pattern);
        if (match) {
            try {
                const parsed = JSON.parse(match[1]);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    console.log(`[LinguaSync] Found ${parsed.length} captionTracks via Method 1`);
                    for (const track of parsed) {
                        if (track.baseUrl) {
                            tracks.push({
                                baseUrl: decodeHtmlEntities(track.baseUrl),
                                languageCode: track.languageCode || 'en',
                                name: track.name?.simpleText || '',
                                kind: track.kind
                            });
                            console.log(`[LinguaSync] Track: ${track.languageCode} (${track.kind || 'manual'})`);
                        }
                    }
                    if (tracks.length > 0) return tracks;
                }
            } catch (e) { /* continue */ }
        }
    }

    // Method 2: Extract individual timedtext URLs
    console.log('[LinguaSync] Method 2: Searching for timedtext URLs...');
    const urlPattern = /"baseUrl"\s*:\s*"(https?:[^"]+timedtext[^"]+)"/g;
    let urlMatch;
    const seen = new Set<string>();

    while ((urlMatch = urlPattern.exec(html)) !== null) {
        let url = urlMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
        const langMatch = url.match(/[&?]lang=([^&]+)/);
        const lang = langMatch ? langMatch[1] : 'en';

        if (!seen.has(lang) && url.includes('expire')) {
            seen.add(lang);
            tracks.push({
                baseUrl: url,
                languageCode: lang,
                kind: url.includes('kind=asr') ? 'asr' : undefined
            });
            console.log(`[LinguaSync] Found timedtext URL for: ${lang}`);
        }
    }

    if (tracks.length > 0) {
        console.log(`[LinguaSync] Method 2 found ${tracks.length} tracks`);
        return tracks;
    }

    console.log('[LinguaSync] No caption tracks found');
    return tracks;
}

/**
 * Fetch transcript from caption track URL
 */
async function fetchTranscriptFromTrack(track: CaptionTrack): Promise<TranscriptLine[]> {
    console.log(`[LinguaSync] Fetching: ${track.baseUrl.substring(0, 100)}...`);

    try {
        const response = await requestUrl({
            url: track.baseUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Referer': 'https://www.youtube.com/'
            }
        });

        console.log(`[LinguaSync] Response length: ${response.text.length}`);
        console.log(`[LinguaSync] Response preview: ${response.text.substring(0, 150)}`);

        const text = response.text;

        // Try JSON
        if (text.trim().startsWith('{')) {
            try {
                const lines = parseJSON3Response(JSON.parse(text));
                if (lines.length > 0) {
                    console.log(`[LinguaSync] ✅ Parsed ${lines.length} lines from JSON`);
                    return lines;
                }
            } catch { /* continue */ }
        }

        // Try XML
        if (text.includes('<?xml') || text.includes('<text')) {
            const lines = parseTimedTextXML(text);
            if (lines.length > 0) {
                console.log(`[LinguaSync] ✅ Parsed ${lines.length} lines from XML`);
                return lines;
            }
        }

        // Try JSON3 format
        const json3Url = track.baseUrl + (track.baseUrl.includes('?') ? '&' : '?') + 'fmt=json3';
        console.log('[LinguaSync] Trying JSON3 format...');

        const json3Response = await requestUrl({ url: json3Url });
        const lines = parseJSON3Response(JSON.parse(json3Response.text));
        if (lines.length > 0) {
            console.log(`[LinguaSync] ✅ Parsed ${lines.length} lines from JSON3`);
            return lines;
        }
    } catch (e) {
        console.error('[LinguaSync] Failed to fetch transcript:', e);
    }

    return [];
}

/**
 * Select best caption track
 */
function selectBestTrack(tracks: CaptionTrack[], preferredLang?: string): CaptionTrack | null {
    if (tracks.length === 0) return null;
    const lang = (preferredLang || 'en').toLowerCase();

    // Priority: manual preferred > asr preferred > manual en > asr en > any
    const priorities = [
        (t: CaptionTrack) => t.languageCode.toLowerCase().startsWith(lang) && t.kind !== 'asr',
        (t: CaptionTrack) => t.languageCode.toLowerCase().startsWith(lang),
        (t: CaptionTrack) => t.languageCode.toLowerCase().startsWith('en') && t.kind !== 'asr',
        (t: CaptionTrack) => t.languageCode.toLowerCase().startsWith('en'),
        () => true,
    ];

    for (const p of priorities) {
        const track = tracks.find(p);
        if (track) return track;
    }
    return tracks[0];
}

export class DirectYouTubeTranscript {
    /**
     * Fetch transcript using DownSub-style extraction
     */
    static async getTranscript(url: string, options?: { lang?: string }): Promise<TranscriptResponse> {
        try {
            console.log('[LinguaSync] === DownSub-style transcript extraction ===');
            console.log(`[LinguaSync] URL: ${url}`);

            const videoId = extractVideoId(url);
            if (!videoId) throw new Error('Could not extract video ID');
            console.log(`[LinguaSync] Video ID: ${videoId}`);

            // Fetch YouTube page
            console.log('[LinguaSync] Fetching YouTube page...');
            const pageResponse = await requestUrl({
                url: `https://www.youtube.com/watch?v=${videoId}`,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Upgrade-Insecure-Requests': '1',
                }
            });

            const html = pageResponse.text;
            console.log(`[LinguaSync] Page HTML length: ${html.length}`);

            // Extract title
            const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]*)"/);
            const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : `Video ${videoId}`;

            // Check errors
            if (html.includes('Video unavailable')) throw new Error('Video unavailable');
            if (html.includes('Sign in to confirm your age')) throw new Error('Age-restricted video');

            // Extract caption tracks
            const tracks = extractCaptionTracksFromPlayerResponse(html);

            if (tracks.length === 0) {
                console.log(`[LinguaSync] Debug: hasPlayerResponse=${html.includes('ytInitialPlayerResponse')}, hasCaptions=${html.includes('captionTracks')}`);
                throw new Error('No transcripts found. Video may not have captions.');
            }

            console.log(`[LinguaSync] Found ${tracks.length} caption tracks`);

            // Select best track
            const selectedTrack = selectBestTrack(tracks, options?.lang);
            if (!selectedTrack) throw new Error('No suitable caption track');

            console.log(`[LinguaSync] Selected: ${selectedTrack.languageCode}`);

            // Fetch transcript
            const lines = await fetchTranscriptFromTrack(selectedTrack);

            if (lines.length === 0) {
                throw new Error('Failed to parse transcript from caption track');
            }

            console.log(`[LinguaSync] ✅ SUCCESS: Got ${lines.length} transcript lines`);
            return { lines, title };

        } catch (error: any) {
            console.error('[LinguaSync] Transcript extraction failed:', error);
            throw error;
        }
    }

    private static extractVideoIdFromHtml(html: string): string {
        const match = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
        return match ? match[1] : "";
    }
}

/**
 * ObsidianYoutubeTranscript - Multi-Level Retry Strategy
 * Key improvements:
 * 1. Strategy A: JSON3 + NO Cookie (URL signature is self-contained)
 * 2. Strategy B: JSON3 + WITH Cookie (identity verification)
 * 3. Strategy C: XML + NO Cookie (final fallback)
 * 4. URL sanitization: handles \u0026 escape characters
 */
export class ObsidianYoutubeTranscript {
    // 使用标准的桌面 User-Agent
    private static USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    static async fetchTranscript(videoId: string, langCode: string = 'zh') {
        console.log(`[LinguaSync] 开始处理: ${videoId}`);

        // 1. 获取视频页面 + Cookie
        const { body: videoPageBody, cookies } = await this.fetchVideoPage(videoId);

        // 2. 提取字幕轨道
        const captionTracks = this.extractCaptionTracks(videoPageBody);
        if (!captionTracks || captionTracks.length === 0) {
            throw new Error('未找到字幕轨道，该视频可能没有字幕。');
        }

        // 3. 匹配语言
        const track = captionTracks.find((t: any) => t.languageCode.includes(langCode)) ||
            captionTracks.find((t: any) => t.languageCode.includes('en')) ||
            captionTracks[0];

        console.log(`[LinguaSync] 选中轨道: ${track.name?.simpleText || track.languageCode} (${track.languageCode})`);

        // 4. 清洗 URL (关键步骤：处理 unicode 转义符)
        // 很多时候 URL 里的 \u0026 会导致请求被服务器截断或误判
        const baseUrl = track.baseUrl.replace(/\\u0026/g, '&');

        // --- 核心修改：多级重试策略 ---

        // 策略 A: 尝试 JSON3 格式 + 无 Cookie (依靠 URL 签名)
        try {
            console.log('[LinguaSync] 策略A: JSON3 + 无Cookie');
            const jsonText = await this.fetchWithFallback(`${baseUrl}&fmt=json3`, videoId, null);
            return this.parseJsonTranscript(JSON.parse(jsonText));
        } catch (e: any) {
            console.warn(`[LinguaSync] 策略A失败 (${e.message})，尝试策略B...`);
        }

        // 策略 B: 尝试 JSON3 格式 + 带 Cookie (身份验证)
        try {
            console.log('[LinguaSync] 策略B: JSON3 + 带Cookie');
            const jsonText = await this.fetchWithFallback(`${baseUrl}&fmt=json3`, videoId, cookies);
            return this.parseJsonTranscript(JSON.parse(jsonText));
        } catch (e: any) {
            console.warn(`[LinguaSync] 策略B失败 (${e.message})，尝试策略C...`);
        }

        // 策略 C: 尝试 原始XML格式 + 无 Cookie (最后的保底)
        try {
            console.log('[LinguaSync] 策略C: 原始XML + 无Cookie');
            const xmlText = await this.fetchWithFallback(baseUrl, videoId, null);
            return this.parseXmlTranscript(xmlText);
        } catch (e: any) {
            console.error(`[LinguaSync] 所有策略均失败。`);
            throw new Error('无法下载字幕内容 (所有尝试均返回空或错误)。');
        }
    }

    // --- 网络请求核心 ---

    private static async fetchVideoPage(videoId: string): Promise<{ body: string, cookies: string[] }> {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const response: RequestUrlResponse = await requestUrl({
            url: url,
            method: 'GET',
            headers: {
                'User-Agent': this.USER_AGENT,
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        const rawCookies = response.headers['set-cookie'] || response.headers['Set-Cookie'];
        const cookies = Array.isArray(rawCookies) ? rawCookies : (rawCookies ? [rawCookies] : []);

        return { body: response.text, cookies };
    }

    // 通用下载器
    private static async fetchWithFallback(url: string, videoId: string, cookies: string[] | null): Promise<string> {
        const headers: Record<string, string> = {
            'User-Agent': this.USER_AGENT,
            'Accept': '*/*',
            // 这是一个常用的反爬虫绕过技巧：有时候 Keep-Alive 会导致 Node 请求挂起
            'Connection': 'close'
        };

        // 只有当 explicit 传入 cookie 时才发送
        if (cookies && cookies.length > 0) {
            headers['Cookie'] = cookies.map(c => c.split(';')[0]).join('; ');
            headers['Referer'] = `https://www.youtube.com/watch?v=${videoId}`;
        }

        console.log(`[LinguaSync] 请求: ${url.substring(0, 80)}... (Cookie: ${cookies ? 'YES' : 'NO'})`);

        const response = await requestUrl({
            url: url,
            method: 'GET',
            headers: headers
        });

        console.log(`[LinguaSync] 响应: 状态=${response.status}, 长度=${response.text?.length || 0}`);

        // 显式检查空响应
        if (!response.text || response.text.trim().length === 0) {
            throw new Error('Empty Response (0 bytes)');
        }

        return response.text;
    }

    // --- 解析器 ---

    private static extractCaptionTracks(html: string) {
        // 增强的正则，匹配 ytInitialPlayerResponse
        const patterns = [
            /"captionTracks":\s*(\[.*?\])/,
            /playerCaptionsTracklistRenderer.*?"captionTracks":\s*(\[.*?\])/
        ];

        for (const regex of patterns) {
            const match = regex.exec(html);
            if (match && match[1]) {
                try {
                    return JSON.parse(match[1]);
                } catch (e) {
                    continue; // JSON 解析失败则尝试下一个正则
                }
            }
        }
        return null;
    }

    private static parseJsonTranscript(json: any) {
        if (!json.events) return [];
        return json.events
            .filter((event: any) => event.segs && event.segs.length > 0)
            .map((event: any) => ({
                text: event.segs.map((seg: any) => seg.utf8).join('').replace(/\n/g, ' '),
                duration: event.dDurationMs,
                offset: event.tStartMs
            }));
    }

    private static parseXmlTranscript(xml: string) {
        // 简单的 XML 解析，不依赖 DOMParser 可能会更稳，但这里先用 DOMParser
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, "text/xml");
        const textNodes = xmlDoc.getElementsByTagName("text");

        // 如果 XML 解析失败（比如返回了非 XML 的 HTML 错误页），textNodes 为空
        if (!textNodes || textNodes.length === 0) {
            throw new Error('XML parsing failed or no text nodes found');
        }

        const result = [];
        for (let i = 0; i < textNodes.length; i++) {
            const node = textNodes[i];
            const text = node.textContent?.replace(/&#39;/g, "'").replace(/&quot;/g, '"') || "";
            if (text) {
                result.push({
                    text: text,
                    offset: parseFloat(node.getAttribute("start") || "0") * 1000,
                    duration: parseFloat(node.getAttribute("dur") || "0") * 1000
                });
            }
        }
        return result;
    }
}
