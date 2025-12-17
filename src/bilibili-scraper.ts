import { requestUrl, Notice } from 'obsidian';
import { VideoData, VideoMetadata, TranscriptLine } from './types';

interface BilibiliViewResponse {
    code: number;
    message: string;
    data: {
        bvid: string;
        aid: number;
        cid: number;
        title: string;
        pubdate: number; // timestamp
        desc: string;
        duration: number;
        pic: string; // cover
        owner: {
            name: string;
            mid: number;
        };
        subtitle?: {
            allow_submit: boolean;
            list: Array<{
                id: number;
                lan: string;
                lan_doc: string;
                is_lock: boolean;
                subtitle_url: string;
                type: number;
                id_str: string;
                ai_type: number;
                ai_status: number;
                author: {
                    mid: number;
                    name: string;
                }
            }>;
        };
    };
}

interface BilibiliSubtitleItem {
    from: number; // seconds
    to: number; // seconds
    content: string;
    location: number;
}

interface BilibiliSubtitleResponse {
    font_size: number;
    font_color: string;
    background_alpha: number;
    background_color: string;
    Stroke: string;
    type: string;
    lang: string;
    version: string;
    body: BilibiliSubtitleItem[];
}

export class BilibiliScraper {
    /**
     * Extract BV ID from Bilibili URL
     * Supports: 
     * - https://www.bilibili.com/video/BV1xx411c7mD
     * - https://m.bilibili.com/video/BV1xx411c7mD
     * - BV1xx411c7mD
     */
    static extractBvId(url: string): string | null {
        // Direct BV ID
        if (/^BV[a-zA-Z0-9]{10}$/.test(url)) {
            return url;
        }

        // URL extraction
        const match = url.match(/BV([a-zA-Z0-9]{10})/);
        return match ? `BV${match[1]}` : null;
    }

    /**
     * Check if URL is a Bilibili URL
     */
    static isBilibiliUrl(url: string): boolean {
        return url.includes('bilibili.com') || /^BV[a-zA-Z0-9]{10}$/.test(url);
    }

    /**
     * Fetch video data from Bilibili
     */
    static async fetchVideoData(url: string): Promise<VideoData> {
        const bvid = this.extractBvId(url);
        if (!bvid) {
            throw new Error('Invalid Bilibili URL (BV ID not found)');
        }

        console.log(`[LinguaSync] Fetching Bilibili data for ${bvid}...`);

        // Define headers for subtitle requests (likely needed there)
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': `https://www.bilibili.com/video/${bvid}`
        };

        // 1. Get Video Info (metadata + cid)
        // Note: Do NOT use custom headers for this public API call, as it causes net::ERR_BLOCKED_BY_CLIENT in Obsidian
        const viewUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
        const viewRes = await requestUrl({ url: viewUrl });
        const viewData = viewRes.json as BilibiliViewResponse;

        if (viewData.code !== 0) {
            throw new Error(`Bilibili API Error: ${viewData.message}`);
        }

        const info = viewData.data;
        
        // Extract metadata
        // Clean title by removing leading/trailing quotes (ASCII and Unicode quotes)
        const rawTitle = info.title;
        console.log('[LinguaSync] 🔍 DEBUG - Raw title from Bilibili:', rawTitle);
        const cleanTitle = rawTitle.replace(/^["'""「]|["'""」]$/g, '').trim();
        console.log('[LinguaSync] 🔍 DEBUG - Clean title after removing quotes:', cleanTitle);
        
        const metadata: VideoMetadata = {
            videoId: info.bvid,
            title: cleanTitle,
            author: info.owner.name,
            channel: info.owner.name, // Bilibili uses "owner" or "upper"
            duration: info.duration,
            thumbnailUrl: info.pic.startsWith('http') ? info.pic : `https:${info.pic}`,
            uploadDate: new Date(info.pubdate * 1000).toISOString().split('T')[0]
        };

        // 2. Get Subtitles
        // Bilibili's "view" API usually includes subtitle list in `data.subtitle.list`
        // But sometimes we might need to call `x/player/v2` if it's missing, 
        // though `web-interface/view` is generally reliable for modern Bilibili.
        
        let transcript: TranscriptLine[] = [];
        let translatedTranscript: TranscriptLine[] | undefined = undefined;

        let subtitleList = info.subtitle?.list || [];
        
        // Fallback to player/v2 API if no subtitles found in view API
        if (subtitleList.length === 0) {
            console.log('[LinguaSync] No subtitles in view API, trying player/v2 API...');
            subtitleList = await this.fetchPlayerSubtitleList(info.bvid, info.cid);
        }
        
        if (subtitleList.length === 0) {
            console.log('[LinguaSync] No subtitles found on Bilibili video.');
            // We can still return metadata, effectively creating a note without transcript
            // Or try to generate one? For now, let's just return empty transcript.
        } else {
            console.log(`[LinguaSync] Found ${subtitleList.length} subtitles:`, subtitleList.map(s => s.lan_doc).join(', '));

            // Strategy: 
            // 1. Find Chinese (zh-CN) or English (en-US) as primary?
            //    Since this is LinguaSync (Language Learner), if the video is English, we want English subs.
            //    If it's Chinese video, we want Chinese subs.
            //    Bilibili doesn't explicitly tell the video language, but we can guess from available subs.

            // Priority for "Transcript" (Primary): English -> Chinese -> First Available
            // Priority for "Translated" (Secondary): Chinese (if primary is En) -> English (if primary is Zh)

            // Let's try to find an English subtitle first
            const enSub = subtitleList.find(s => s.lan.startsWith('en'));
            const zhSub = subtitleList.find(s => s.lan.startsWith('zh'));

            let primarySub = enSub || zhSub || subtitleList[0];
            
            if (primarySub) {
                console.log(`[LinguaSync] Downloading primary subtitle: ${primarySub.lan_doc} (${primarySub.lan})...`);
                // Try without headers first (to avoid ERR_BLOCKED_BY_CLIENT)
                transcript = await this.downloadSubtitle(primarySub.subtitle_url, primarySub.lan);
            }

            // Determine secondary (translated)
            if (primarySub === enSub && zhSub) {
                console.log(`[LinguaSync] Downloading secondary (translated) subtitle: ${zhSub.lan_doc}...`);
                translatedTranscript = await this.downloadSubtitle(zhSub.subtitle_url, zhSub.lan);
            } else if (primarySub === zhSub && enSub) {
                console.log(`[LinguaSync] Downloading secondary (translated) subtitle: ${enSub.lan_doc}...`);
                translatedTranscript = await this.downloadSubtitle(enSub.subtitle_url, enSub.lan);
            }
        }

        // If no transcript found at all, we might want to warn
        if (transcript.length === 0) {
            new Notice('⚠️ No subtitles found for this Bilibili video.');
            // Create a dummy transcript line so the generator doesn't crash
            transcript.push({
                start: 0,
                duration: info.duration,
                text: "(No subtitles available for this video)",
                lang: 'unknown'
            });
        }

        // Add URL to metadata
        metadata.url = url;

        return {
            metadata,
            transcript,
            translatedTranscript
        };
    }

    /**
     * Fetch subtitle list from player/v2 API (Fallback)
     */
    private static async fetchPlayerSubtitleList(bvid: string, cid: number): Promise<any[]> {
        try {
            const playerUrl = `https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${cid}`;
            // Don't use custom headers to avoid ERR_BLOCKED_BY_CLIENT
            const res = await requestUrl({ url: playerUrl });
            const data = res.json;
            
            // The structure might be slightly different or wrapped
            if (data.code === 0 && data.data?.subtitle?.subtitles) {
                return data.data.subtitle.subtitles;
            }
        } catch (e) {
            console.error('[LinguaSync] Failed to fetch player/v2 subtitles:', e);
        }
        return [];
    }

    /**
     * Download and parse Bilibili JSON subtitle
     */
    private static async downloadSubtitle(url: string, langCode: string, headers?: any): Promise<TranscriptLine[]> {
        // Ensure URL has protocol
        if (url.startsWith('//')) {
            url = 'https:' + url;
        }

        try {
            console.log(`[LinguaSync] 🔽 Downloading subtitle from: ${url}`);
            const res = await requestUrl({ url, headers });
            const data = res.json as BilibiliSubtitleResponse;
            
            if (!data || !data.body || data.body.length === 0) {
                console.error('[LinguaSync] ❌ Subtitle response is empty or invalid');
                console.error('[LinguaSync] Response data:', JSON.stringify(data).substring(0, 200));
                return [];
            }
            
            const lines = data.body.map(item => ({
                start: item.from,
                duration: item.to - item.from,
                text: item.content,
                lang: langCode
            }));
            
            console.log(`[LinguaSync] ✅ Downloaded ${lines.length} subtitle lines (${langCode})`);
            return lines;
        } catch (e: any) {
            console.error('[LinguaSync] ❌ Failed to download subtitle:', e.message || e);
            console.error('[LinguaSync] URL:', url);
            if (e.status) {
                console.error('[LinguaSync] HTTP Status:', e.status);
            }
            return [];
        }
    }
}
