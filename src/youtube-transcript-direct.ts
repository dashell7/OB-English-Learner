import { requestUrl } from 'obsidian';

export interface TranscriptLine {
    offset: number;
    duration: number;
    text: string;
}

export interface TranscriptResponse {
    lines: TranscriptLine[];
    title?: string;
}

/**
 * Convert Uint8Array to base64 string (browser-compatible)
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Generate transcript params using protobuf-like encoding
 */
function generateTranscriptParams(
    videoId: string,
    useAsrStyle: boolean,
    field6Value: number
): string {
    // Simple protobuf encoding without external library
    const encoder = new TextEncoder();
    const parts: number[] = [];
    
    // Field 1: Video ID (string, wire type 2)
    const videoIdBytes = encoder.encode(videoId);
    parts.push(0x0a); // field 1, wire type 2
    parts.push(videoIdBytes.length);
    parts.push(...videoIdBytes);
    
    // Field 2: Context data (string, wire type 2)
    const contextData = useAsrStyle ? "CgNhc3ISAmVuGgA%3D" : "CgASAmVuGgA%3D";
    const contextBytes = encoder.encode(contextData);
    parts.push(0x12); // field 2, wire type 2
    parts.push(contextBytes.length);
    parts.push(...contextBytes);
    
    // Field 3: Number 1 (varint, wire type 0)
    parts.push(0x18); // field 3, wire type 0
    parts.push(0x01);
    
    // Field 5: Panel identifier (string, wire type 2)
    const panelId = "engagement-panel-searchable-transcript-search-panel";
    const panelBytes = encoder.encode(panelId);
    parts.push(0x2a); // field 5, wire type 2
    parts.push(panelBytes.length);
    parts.push(...panelBytes);
    
    // Field 6: Specific value (varint, wire type 0)
    parts.push(0x30); // field 6, wire type 0
    parts.push(field6Value);
    
    // Field 7: Number 1 (varint, wire type 0)
    parts.push(0x38); // field 7, wire type 0
    parts.push(0x01);
    
    // Field 8: Number 1 (varint, wire type 0)
    parts.push(0x40); // field 8, wire type 0
    parts.push(0x01);
    
    const buffer = new Uint8Array(parts);
    return uint8ArrayToBase64(buffer).replace(/=/g, "%3D");
}

/**
 * Generate multiple parameter variations to try
 */
function generateAlternativeParams(videoId: string): string[] {
    const variations = [
        { useAsrStyle: true, field6Value: 1 },
        { useAsrStyle: false, field6Value: 0 },
        { useAsrStyle: true, field6Value: 0 },
        { useAsrStyle: false, field6Value: 1 },
    ];
    
    return variations.map(v => 
        generateTranscriptParams(videoId, v.useAsrStyle, v.field6Value)
    );
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url: string): string {
    // Handle youtube.com/watch?v=ID format
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];
    
    // Handle youtu.be/ID format
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];
    
    // Handle youtube.com/shorts/ID format
    const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
    
    // Handle youtube.com/embed/ID format
    const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];
    
    return "";
}

/**
 * Extract visitor data from page HTML
 */
function extractVisitorData(html: string): string {
    const match = html.match(/"visitorData"\s*:\s*"([^"]+)"/);
    if (match) return match[1];
    return "Cgs5LXVQa0I1YnhHOCjZ7ZDDBjInCgJQTBIhEh0SGwsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJiAS";
}

/**
 * Extract params from page if available
 */
function extractParamsFromPage(html: string): string | null {
    const ytInitialDataMatch = html.match(/var ytInitialData\s*=\s*({.+?});/s);
    if (!ytInitialDataMatch) return null;
    
    try {
        const ytInitialData = JSON.parse(ytInitialDataMatch[1]);
        
        function findParams(obj: any): string | null {
            if (!obj || typeof obj !== "object") return null;
            if (obj.getTranscriptEndpoint?.params) {
                return obj.getTranscriptEndpoint.params;
            }
            for (const value of Object.values(obj)) {
                const result = findParams(value);
                if (result) return result;
            }
            return null;
        }
        
        const params = findParams(ytInitialData);
        if (params && typeof params === "string" && params.length > 50) {
            return params;
        }
    } catch (e) {
        // Ignore parse errors
    }
    
    return null;
}

/**
 * Parse transcript from API response
 */
function parseTranscript(responseText: string): TranscriptLine[] {
    try {
        const response = JSON.parse(responseText);
        const segments = response?.actions?.[0]?.updateEngagementPanelAction?.content
            ?.transcriptRenderer?.content?.transcriptSearchPanelRenderer
            ?.body?.transcriptSegmentListRenderer?.initialSegments;
        
        if (!segments || !Array.isArray(segments)) return [];
        
        return segments.map((segment: any) => {
            const cue = segment.transcriptSegmentRenderer;
            if (!cue?.snippet?.runs?.[0]?.text || !cue.startMs || !cue.endMs) {
                return { text: "", duration: 0, offset: 0 };
            }
            return {
                text: cue.snippet.runs[0].text,
                duration: parseInt(cue.endMs) - parseInt(cue.startMs),
                offset: parseInt(cue.startMs),
            };
        }).filter((line: TranscriptLine) => line.text);
    } catch (e) {
        console.error('[LinguaSync] Failed to parse transcript response:', e);
        return [];
    }
}

export class DirectYouTubeTranscript {
    /**
     * Fetch transcript directly from YouTube using new API
     */
    static async getTranscript(url: string, options?: { lang?: string; country?: string }): Promise<TranscriptResponse> {
        try {
            // Fetch video page with browser-like headers
            const response = await requestUrl({ 
                url,
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
            const html = response.text;
            
            // Extract video ID
            const videoId = extractVideoId(url) || this.extractVideoIdFromHtml(html);
            if (!videoId) {
                throw new Error('Could not extract video ID');
            }
            
            // Extract title
            const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]*)"/);
            const title = titleMatch ? titleMatch[1] : `Video ${videoId}`;
            
            // Extract visitor data
            const visitorData = extractVisitorData(html);
            
            // Get params - try page params first, then generated ones
            const pageParams = extractParamsFromPage(html);
            const generatedParams = generateAlternativeParams(videoId);
            const allParams = pageParams ? [pageParams, ...generatedParams] : generatedParams;
            
            // Try each params combination
            for (let i = 0; i < allParams.length; i++) {
                const params = allParams[i];
                
                try {
                    const requestBody = this.buildRequestBody(videoId, params, visitorData, options);
                    
                    const apiResponse = await requestUrl({
                        url: "https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false",
                        method: "POST",
                        headers: this.buildHeaders(videoId, visitorData),
                        body: JSON.stringify(requestBody),
                    });
                    
                    const lines = parseTranscript(apiResponse.text);
                    
                    if (lines && lines.length > 0) {
                        console.log(`[LinguaSync] ✅ Got ${lines.length} transcript lines`);
                        return { lines, title };
                    }
                } catch (e) {
                    // Continue to next params
                    if (i === allParams.length - 1) {
                        throw e;
                    }
                }
            }
            
            throw new Error('No transcripts found for this video. The video may not have captions enabled.');
            
        } catch (error: any) {
            console.error('[LinguaSync] Direct transcript fetch failed:', error);
            throw error;
        }
    }
    
    private static extractVideoIdFromHtml(html: string): string {
        // Try canonical link
        const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/);
        if (canonicalMatch) {
            const id = extractVideoId(canonicalMatch[1]);
            if (id) return id;
        }
        
        // Try og:url
        const ogMatch = html.match(/<meta\s+property="og:url"\s+content="([^"]+)"/);
        if (ogMatch) {
            const id = extractVideoId(ogMatch[1]);
            if (id) return id;
        }
        
        // Try videoId in player response
        const playerMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
        if (playerMatch) return playerMatch[1];
        
        return "";
    }
    
    private static buildRequestBody(
        videoId: string, 
        params: string, 
        visitorData: string,
        options?: { lang?: string; country?: string }
    ): any {
        return {
            context: {
                client: {
                    clientName: "WEB",
                    clientVersion: "2.20250701.01.00",
                    hl: options?.lang || "en",
                    gl: options?.country || "US",
                    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    platform: "DESKTOP",
                    visitorData: visitorData,
                },
                user: { lockedSafetyMode: false },
                request: { useSsl: true },
            },
            externalVideoId: videoId,
            params: params,
        };
    }
    
    private static buildHeaders(videoId: string, visitorData: string): Record<string, string> {
        return {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "*/*",
            "X-Youtube-Client-Name": "1",
            "X-Youtube-Client-Version": "2.20250701.01.00",
            "X-Goog-EOM-Visitor-Id": visitorData,
            "Origin": "https://www.youtube.com",
            "Referer": `https://www.youtube.com/watch?v=${videoId}`,
        };
    }
}
