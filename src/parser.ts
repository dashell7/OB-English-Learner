import { TranscriptLine } from './types';

export class TranscriptParser {
    /**
     * Convert transcript lines to bilingual SRT format (English on top, Chinese below)
     */
    static convertToBilingualSRT(enLines: TranscriptLine[], zhLines: TranscriptLine[]): string {
        let srt = '';

        for (let i = 0; i < enLines.length; i++) {
            const enLine = enLines[i];
            const zhLine = zhLines[i];
            const index = i + 1;
            const startTime = this.formatSRTTime(enLine.start);
            const endTime = this.formatSRTTime(enLine.start + enLine.duration);

            srt += `${index}\n`;
            srt += `${startTime} --> ${endTime}\n`;
            srt += `${enLine.text}\n`;
            if (zhLine) {
                srt += `${zhLine.text}\n`;
            }
            srt += `\n`;
        }

        return srt;
    }

    /**
     * Convert transcript lines to SRT format
     */
    static convertToSRT(lines: TranscriptLine[]): string {
        let srt = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const index = i + 1;
            const startTime = this.formatSRTTime(line.start);
            const endTime = this.formatSRTTime(line.start + line.duration);

            srt += `${index}\n`;
            srt += `${startTime} --> ${endTime}\n`;
            srt += `${line.text}\n\n`;
        }

        return srt;
    }

    /**
     * Format seconds to SRT timestamp (HH:MM:SS,mmm)
     */
    private static formatSRTTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const millis = Math.floor((seconds % 1) * 1000);

        return `${this.pad(hours, 2)}:${this.pad(minutes, 2)}:${this.pad(secs, 2)},${this.pad(millis, 3)}`;
    }

    /**
     * Pad number with leading zeros
     */
    private static pad(num: number, length: number): string {
        return num.toString().padStart(length, '0');
    }

    /**
     * Convert transcript to bilingual format (side by side)
     */
    static createBilingualTranscript(
        original: TranscriptLine[],
        translated: TranscriptLine[]
    ): string {
        let markdown = '';

        for (let i = 0; i < original.length; i++) {
            const orig = original[i];
            const trans = translated[i];
            const timestamp = this.formatMarkdownTimestamp(orig.start);

            markdown += `| ${timestamp} | ${orig.text} | ${trans?.text || ''} |\n`;
        }

        return markdown;
    }

    /**
     * Format timestamp for markdown (MM:SS)
     */
    static formatMarkdownTimestamp(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${this.pad(minutes, 2)}:${this.pad(secs, 2)}`;
    }

    /**
     * Convert transcript to simple markdown list
     */
    static convertToMarkdown(lines: TranscriptLine[]): string {
        let markdown = '';

        for (const line of lines) {
            const timestamp = this.formatMarkdownTimestamp(line.start);
            // Escape pipe characters in text to avoid breaking table format
            const escapedText = line.text.replace(/\|/g, '\\|');
            markdown += `| ${timestamp} | ${escapedText} |\n`;
        }

        return markdown;
    }
}
