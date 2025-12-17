/**
 * YT-DLP Fetcher - 使用 yt-dlp 命令行工具获取 YouTube 字幕
 * 
 * 优势：
 * 1. yt-dlp 是最可靠的 YouTube 工具
 * 2. 自动处理签名、Cookie、验证等问题
 * 3. 支持自动字幕和翻译字幕
 * 
 * 前提：用户需要安装 yt-dlp
 * - Windows: winget install yt-dlp 或 pip install yt-dlp
 * - Mac: brew install yt-dlp
 * - Linux: pip install yt-dlp
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface YtDlpTranscriptLine {
    offset: number;     // 开始时间 (毫秒)
    duration: number;   // 持续时间 (毫秒)
    text: string;       // 字幕文本
}

export interface YtDlpResult {
    lines: YtDlpTranscriptLine[];
    title?: string;
    language?: string;
}

export class YtDlpFetcher {

    /**
     * 检查 yt-dlp 是否已安装
     */
    static async isYtDlpInstalled(): Promise<boolean> {
        try {
            await execAsync('yt-dlp --version');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 获取 yt-dlp 版本
     */
    static async getVersion(): Promise<string> {
        try {
            const { stdout } = await execAsync('yt-dlp --version');
            return stdout.trim();
        } catch {
            return 'Not installed';
        }
    }

    /**
     * 使用 yt-dlp 获取字幕
     * 
     * @param videoId YouTube 视频 ID
     * @param langCode 语言代码 (如 'en', 'zh')
     * @returns 字幕数据
     */
    static async fetchTranscript(videoId: string, langCode: string = 'en'): Promise<YtDlpResult> {
        console.log(`[LinguaSync] yt-dlp: 开始获取字幕 - ${videoId}`);

        // 检查 yt-dlp 是否安装
        const installed = await this.isYtDlpInstalled();
        if (!installed) {
            throw new Error('yt-dlp 未安装。请先安装: pip install yt-dlp 或 winget install yt-dlp');
        }

        // 创建临时目录
        const tempDir = path.join(os.tmpdir(), 'obsidian-ytsync');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const outputTemplate = path.join(tempDir, `${videoId}`);

        try {
            // 首先获取视频信息
            console.log('[LinguaSync] yt-dlp: 获取视频信息...');
            const infoCmd = `yt-dlp --print title --skip-download "${videoUrl}"`;
            let title = '';
            try {
                const { stdout } = await execAsync(infoCmd);
                title = stdout.trim();
            } catch {
                title = `Video ${videoId}`;
            }

            // 尝试获取字幕 (优先自动字幕)
            // --write-auto-sub: 下载自动生成的字幕
            // --write-sub: 下载手动上传的字幕
            // --sub-lang: 指定语言
            // --sub-format: 字幕格式 (json3 最方便解析)
            // --skip-download: 不下载视频
            console.log(`[LinguaSync] yt-dlp: 下载字幕 (语言: ${langCode})...`);

            // 策略 1: 尝试获取指定语言的字幕
            let subtitleFile = '';
            const langCodes = [langCode, 'en', 'en-US', 'en-GB'];

            for (const lang of langCodes) {
                const cmd = `yt-dlp --write-auto-sub --write-sub --sub-lang ${lang} --sub-format json3 --skip-download -o "${outputTemplate}" "${videoUrl}"`;

                try {
                    console.log(`[LinguaSync] yt-dlp: 尝试语言 ${lang}...`);
                    await execAsync(cmd, { timeout: 60000 }); // 60秒超时

                    // 查找生成的字幕文件
                    const possibleFiles = [
                        `${outputTemplate}.${lang}.json3`,
                        `${outputTemplate}.${lang}.vtt`,
                        `${outputTemplate}.${lang}.srt`,
                    ];

                    for (const file of possibleFiles) {
                        if (fs.existsSync(file)) {
                            subtitleFile = file;
                            console.log(`[LinguaSync] yt-dlp: 找到字幕文件 - ${file}`);
                            break;
                        }
                    }

                    if (subtitleFile) break;
                } catch (e: any) {
                    console.warn(`[LinguaSync] yt-dlp: 语言 ${lang} 失败 - ${e.message}`);
                }
            }

            // 如果没找到，尝试列出可用字幕
            if (!subtitleFile) {
                console.log('[LinguaSync] yt-dlp: 尝试任意可用字幕...');
                const listCmd = `yt-dlp --list-subs "${videoUrl}"`;
                try {
                    const { stdout } = await execAsync(listCmd);
                    console.log('[LinguaSync] 可用字幕:', stdout.substring(0, 500));
                } catch {
                    // 忽略
                }

                // 尝试下载任意字幕
                const anySubCmd = `yt-dlp --write-auto-sub --write-sub --sub-format json3 --skip-download -o "${outputTemplate}" "${videoUrl}"`;
                await execAsync(anySubCmd, { timeout: 60000 });

                // 搜索任何生成的字幕文件
                const files = fs.readdirSync(tempDir);
                for (const file of files) {
                    if (file.startsWith(videoId) && (file.endsWith('.json3') || file.endsWith('.vtt') || file.endsWith('.srt'))) {
                        subtitleFile = path.join(tempDir, file);
                        console.log(`[LinguaSync] yt-dlp: 找到字幕文件 - ${subtitleFile}`);
                        break;
                    }
                }
            }

            if (!subtitleFile || !fs.existsSync(subtitleFile)) {
                throw new Error('yt-dlp 未能获取字幕文件');
            }

            // 解析字幕文件
            const content = fs.readFileSync(subtitleFile, 'utf-8');
            let lines: YtDlpTranscriptLine[];

            if (subtitleFile.endsWith('.json3')) {
                lines = this.parseJson3(content);
            } else if (subtitleFile.endsWith('.vtt')) {
                lines = this.parseVtt(content);
            } else if (subtitleFile.endsWith('.srt')) {
                lines = this.parseSrt(content);
            } else {
                throw new Error(`不支持的字幕格式: ${subtitleFile}`);
            }

            console.log(`[LinguaSync] yt-dlp: ✅ 成功获取 ${lines.length} 条字幕`);

            // 清理临时文件
            this.cleanupTempFiles(tempDir, videoId);

            return {
                lines,
                title,
                language: langCode
            };

        } catch (error: any) {
            console.error('[LinguaSync] yt-dlp: 获取字幕失败 -', error.message);
            this.cleanupTempFiles(tempDir, videoId);
            throw error;
        }
    }

    /**
     * 解析 JSON3 格式字幕
     */
    private static parseJson3(content: string): YtDlpTranscriptLine[] {
        try {
            const json = JSON.parse(content);
            if (!json.events) return [];

            return json.events
                .filter((event: any) => event.segs && event.segs.length > 0)
                .map((event: any) => ({
                    text: event.segs.map((seg: any) => seg.utf8 || '').join('').replace(/\n/g, ' ').trim(),
                    offset: event.tStartMs || 0,
                    duration: event.dDurationMs || 0
                }))
                .filter((line: YtDlpTranscriptLine) => line.text.length > 0);
        } catch (e) {
            console.error('[LinguaSync] JSON3 解析失败:', e);
            return [];
        }
    }

    /**
     * 解析 VTT 格式字幕
     */
    private static parseVtt(content: string): YtDlpTranscriptLine[] {
        const lines: YtDlpTranscriptLine[] = [];
        const blocks = content.split(/\n\n+/);

        for (const block of blocks) {
            // 跳过 WEBVTT 头部
            if (block.startsWith('WEBVTT') || block.trim() === '') continue;

            const lineMatches = block.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
            if (lineMatches) {
                const startMs = this.timeToMs(lineMatches[1], lineMatches[2], lineMatches[3], lineMatches[4]);
                const endMs = this.timeToMs(lineMatches[5], lineMatches[6], lineMatches[7], lineMatches[8]);

                // 提取文本 (时间戳后面的内容)
                const textLines = block.split('\n').slice(1).filter(l => !l.match(/-->/));
                const text = textLines.join(' ').replace(/<[^>]+>/g, '').trim();

                if (text) {
                    lines.push({
                        offset: startMs,
                        duration: endMs - startMs,
                        text
                    });
                }
            }
        }

        return lines;
    }

    /**
     * 解析 SRT 格式字幕
     */
    private static parseSrt(content: string): YtDlpTranscriptLine[] {
        const lines: YtDlpTranscriptLine[] = [];
        const blocks = content.split(/\n\n+/);

        for (const block of blocks) {
            const lineMatches = block.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
            if (lineMatches) {
                const startMs = this.timeToMs(lineMatches[1], lineMatches[2], lineMatches[3], lineMatches[4]);
                const endMs = this.timeToMs(lineMatches[5], lineMatches[6], lineMatches[7], lineMatches[8]);

                // 提取文本 (时间戳后面的内容)
                const textLines = block.split('\n').slice(2);
                const text = textLines.join(' ').replace(/<[^>]+>/g, '').trim();

                if (text) {
                    lines.push({
                        offset: startMs,
                        duration: endMs - startMs,
                        text
                    });
                }
            }
        }

        return lines;
    }

    /**
     * 时间转毫秒
     */
    private static timeToMs(h: string, m: string, s: string, ms: string): number {
        return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms);
    }

    /**
     * 清理临时文件
     */
    private static cleanupTempFiles(tempDir: string, videoId: string): void {
        try {
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
                if (file.startsWith(videoId)) {
                    fs.unlinkSync(path.join(tempDir, file));
                }
            }
        } catch {
            // 忽略清理错误
        }
    }
}
