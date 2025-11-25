import { App, TFile, normalizePath, requestUrl } from 'obsidian';
import { VideoData } from './types';
import { TranscriptParser } from './parser';
import { AITranslator, TranslatorConfig } from './translator';

export class NoteGenerator {
    constructor(private app: App, private settings: any) { }

    /**
     * Generate a complete video note with Frontmatter and content
     * @param videoData Video metadata and transcript data
     * @param isUpdate If true, only update the MD content without regenerating assets
     */
    async createVideoNote(videoData: VideoData, isUpdate: boolean = false): Promise<TFile> {
        const { metadata, transcript, translatedTranscript } = videoData;

        // 1. Determine Note and Folder Paths
        // Default assumption based on title
        const defaultFileName = this.sanitizeFileName(metadata.title);
        let fileName = defaultFileName;
        let videoFolder = normalizePath(`${this.settings.videoFolder}/${fileName}`);
        let notePath = normalizePath(`${this.settings.videoFolder}/${fileName}.md`);
        
        // If update mode, try to find the actual existing note to respect user renames/moves
        let existingNote = this.app.vault.getAbstractFileByPath(notePath);
        
        if (isUpdate && !existingNote) {
             // Fallback: Search by content (URL) is expensive, so we try to search by name similarity or just assume default.
             // Since main.ts already found the note to set isUpdate=true, we assume it exists.
             // Let's check if we can find it by URL if default path failed.
             const files = this.app.vault.getMarkdownFiles();
             for (const file of files) {
                 if (!file.path.startsWith(this.settings.videoFolder)) continue;
                 // Optimization: Only check files that look related or check all if needed
                 // Here we just check all in video folder for robustness
                 if (file.basename === fileName) { // Should have been found by getAbstractFileByPath, but just in case
                     existingNote = file;
                     break;
                 }
             }
        }

        if (existingNote instanceof TFile) {
            // Use existing file's structure
            fileName = existingNote.basename;
            videoFolder = existingNote.parent ? existingNote.parent.path : this.settings.videoFolder;
            notePath = existingNote.path;
            console.log('[OB English Learner] 🔄 Update mode: Targeting existing note at', notePath);
        } else {
            console.log('[OB English Learner] 📥 Creating new note structure...');
        }

        // Ensure folders exist
        const subtitlesFolder = normalizePath(`${videoFolder}/Subtitles`);
        await this.ensureFolderExists(videoFolder);
        await this.ensureFolderExists(subtitlesFolder);

        // 2. Check/Create Thumbnail
        let coverPath = '';
        if (this.settings.autoDownloadThumbnails) {
            const imgName = `${fileName}.jpg`;
            const imgPath = normalizePath(`${videoFolder}/${imgName}`);
            
            // Check if cover exists
            if (this.app.vault.getAbstractFileByPath(imgPath)) {
                 console.log('[OB English Learner] ✅ Cover already exists, reusing:', imgName);
                 coverPath = imgName;
            } else {
                 console.log('[OB English Learner] 📥 Downloading missing cover...');
                 coverPath = await this.downloadThumbnail(metadata.thumbnailUrl, fileName, videoFolder);
            }
        }

        // 3. Check/Create SRTs
        // This ensures missing files are regenerated, but existing ones are preserved
        const srtPaths = await this.ensureSRTFiles(transcript, translatedTranscript, fileName, subtitlesFolder);

        // Determine which transcript to display (prefer English)
        const displayTranscript = transcript[0]?.lang === 'en' 
            ? transcript 
            : (translatedTranscript && translatedTranscript[0]?.lang === 'en' 
                ? translatedTranscript 
                : transcript);

        // AI format transcript if enabled (add punctuation and paragraphs)
        let formattedTranscriptText: string | null = null;
        if (this.settings.enableAIFormatting && this.settings.aiApiKey) {
            try {
                console.log('[OB English Learner] AI formatting enabled, processing transcript...');
                const translatorConfig: TranslatorConfig = {
                    provider: this.settings.aiProvider,
                    apiKey: this.settings.aiApiKey,
                    model: this.settings.aiModel,
                    baseUrl: this.settings.aiBaseUrl
                };
                const formatter = new AITranslator(translatorConfig);
                formattedTranscriptText = await formatter.formatTranscript(
                    displayTranscript, 
                    this.settings.aiFormattingPrompt
                );
            } catch (error) {
                console.error('[OB English Learner] AI formatting failed, using default format:', error);
            }
        }

        // Build content using the template (which now includes Frontmatter)
        const fullContent = this.buildNoteContent(metadata, displayTranscript, srtPaths, fileName, coverPath, formattedTranscriptText);

        // Create or update the file
        let file: TFile;
        if (existingNote instanceof TFile) {
            // Update existing file
            await this.app.vault.modify(existingNote, fullContent);
            file = existingNote;
            console.log('[OB English Learner] ✅ Note updated:', file.basename);
        } else {
            // Create new file
            file = await this.app.vault.create(notePath, fullContent);
            console.log('[OB English Learner] ✅ Note created:', file.basename);
        }

        return file;
    }

    /**
     * Build note content using template
     */
    private buildNoteContent(
        metadata: any, 
        transcript: any[], 
        srtPaths: any, 
        fileName: string, 
        coverPath: string,
        formattedTranscriptText: string | null = null
    ): string {
        // Get template from settings
        const template = this.settings.noteTemplate || this.getDefaultTemplate();
        
        // Build SRT links (relative to note location)
        const srtLinksArr = [];
        if (srtPaths.english) {
            srtLinksArr.push(`- English: [[${fileName}/Subtitles/${srtPaths.english}]]`);
        }
        if (srtPaths.chinese) {
            srtLinksArr.push(`- 中文: [[${fileName}/Subtitles/${srtPaths.chinese}]]`);
        }
        if (srtPaths.bilingual) {
            srtLinksArr.push(`- EN-ZH: [[${fileName}/Subtitles/${srtPaths.bilingual}]]`);
        }
        const srtLinks = srtLinksArr.join('\n');
        
        // Calculate statistics
        const totalWords = transcript.reduce((count, line) => {
            return count + line.text.split(/\s+/).length;
        }, 0);
        const totalLines = transcript.length;
        
        // Build transcript content
        let transcriptContent: string;
        
        if (formattedTranscriptText) {
            // Use AI-formatted text with punctuation and smart paragraphs
            console.log('[OB English Learner] Using AI-formatted transcript with punctuation');
            transcriptContent = formattedTranscriptText;
        } else {
            // Default: Language Learner format (pure paragraphs, every 3-4 lines)
            console.log('[OB English Learner] Using default paragraph formatting');
            const paragraphs: string[] = [];
            let currentParagraph: string[] = [];
            
            transcript.forEach((line, index) => {
                currentParagraph.push(line.text);
                // Create a paragraph every 3-4 lines
                if ((index + 1) % 3 === 0 || index === transcript.length - 1) {
                    paragraphs.push(currentParagraph.join(' '));
                    currentParagraph = [];
                }
            });
            
            transcriptContent = paragraphs.join('\n\n');
        }
        
        // Format dates
        const today = new Date().toISOString().split('T')[0];
        
        // Prepare cover - use wikilink format for frontmatter
        // In frontmatter, Obsidian expects: cover: "[[path/file.jpg]]"
        console.log('[OB English Learner] 🔍 DEBUG - coverPath before wikilink:', coverPath);
        const coverLink = coverPath ? `[[${coverPath}]]` : '';
        console.log('[OB English Learner] 🔍 DEBUG - coverLink after wikilink:', coverLink);

        // Replace template variables
        let content = template
            .replace(/{{title}}/g, metadata.title)
            .replace(/{{videoId}}/g, metadata.videoId)
            .replace(/{{url}}/g, metadata.url || `https://youtu.be/${metadata.videoId}`)
            .replace(/{{channel}}/g, metadata.channel)
            .replace(/{{duration}}/g, this.formatDuration(metadata.duration))
            .replace(/{{uploadDate}}/g, metadata.uploadDate || '')
            .replace(/{{date}}/g, today)
            .replace(/{{thumbnail}}/g, metadata.thumbnailUrl || '')
            .replace(/{{cover}}/g, coverLink)
            .replace(/{{srtLinks}}/g, srtLinks)
            .replace(/{{transcript}}/g, transcriptContent)
            .replace(/{{totalWords}}/g, totalWords.toString())
            .replace(/{{totalLines}}/g, totalLines.toString());
        
        return content;
    }
    
    /**
     * Get default template
     */
    private getDefaultTemplate(): string {
        return `---
type: video-note
status: inbox
url: {{url}}
title: "{{title}}"
channel: "{{channel}}"
duration: {{duration}}
created_at: {{date}}
tags:
  - english/video
cover: "{{cover}}"
---
langr: {{title}}
langr-audio: {{url}}
langr-origin: {{channel}} - YouTube

^^^article

{{transcript}}

^^^words

^^^notes

---

## 视频信息

**频道**: {{channel}}  
**时长**: {{duration}}  
**日期**: {{uploadDate}}

## 字幕文件

{{srtLinks}}`;
    }

    /**
     * Ensure multiple SRT files exist in video's Subtitles folder
     */
    private async ensureSRTFiles(
        primaryTranscript: any[], 
        translatedTranscript: any[] | undefined, 
        fileName: string,
        subtitlesFolder: string
    ): Promise<any> {
        const result: any = {};
        
        // Detect primary transcript language
        const primaryLang = primaryTranscript[0]?.lang || 'en';
        const translatedLang = translatedTranscript?.[0]?.lang;
        
        console.log(`[OB English Learner] Primary language: ${primaryLang}, Translated: ${translatedLang || 'none'}`);

        // Generate primary SRT (could be EN or ZH)
        const primaryLangLabel = primaryLang === 'zh' ? 'ZH' : 'EN';
        const primarySRTFileName = `${fileName} - ${primaryLangLabel}.srt`;
        const primarySRTPath = normalizePath(`${subtitlesFolder}/${primarySRTFileName}`);
        
        // Check if file exists
        const existingPrimarySRT = this.app.vault.getAbstractFileByPath(primarySRTPath);
        if (existingPrimarySRT) {
            console.log(`[OB English Learner] SRT already exists, keeping: ${primarySRTFileName}`);
        } else {
            console.log(`[OB English Learner] Creating missing SRT: ${primarySRTFileName}`);
            const primarySRTContent = TranscriptParser.convertToSRT(primaryTranscript);
            await this.app.vault.create(primarySRTPath, primarySRTContent);
        }
        
        if (primaryLang === 'en') {
            result.english = primarySRTFileName;
        } else {
            result.chinese = primarySRTFileName;
        }

        // Generate translated SRT if available
        if (translatedTranscript && translatedTranscript.length > 0) {
            const translatedLangLabel = translatedLang === 'zh' ? 'ZH' : 'EN';
            const translatedSRTFileName = `${fileName} - ${translatedLangLabel}.srt`;
            const translatedSRTPath = normalizePath(`${subtitlesFolder}/${translatedSRTFileName}`);
            
            const existingTranslatedSRT = this.app.vault.getAbstractFileByPath(translatedSRTPath);
            if (existingTranslatedSRT) {
                console.log(`[OB English Learner] SRT already exists, keeping: ${translatedSRTFileName}`);
            } else {
                console.log(`[OB English Learner] Creating missing SRT: ${translatedSRTFileName}`);
                const translatedSRTContent = TranscriptParser.convertToSRT(translatedTranscript);
                await this.app.vault.create(translatedSRTPath, translatedSRTContent);
            }
            
            if (translatedLang === 'zh') {
                result.chinese = translatedSRTFileName;
            } else {
                result.english = translatedSRTFileName;
            }

            // Generate Bilingual SRT (only if we have both EN and ZH)
            if (primaryLang !== translatedLang) {
                const bilingualSRTFileName = `${fileName} - EN-ZH.srt`;
                const bilingualSRTPath = normalizePath(`${subtitlesFolder}/${bilingualSRTFileName}`);
                
                const existingBiSRT = this.app.vault.getAbstractFileByPath(bilingualSRTPath);
                if (existingBiSRT) {
                    console.log('[OB English Learner] SRT already exists, keeping: ${bilingualSRTFileName}');
                } else {
                    console.log('[OB English Learner] Creating missing SRT: ${bilingualSRTFileName}');
                    const enLines = primaryLang === 'en' ? primaryTranscript : translatedTranscript;
                    const zhLines = primaryLang === 'zh' ? primaryTranscript : translatedTranscript;
                    
                    const bilingualSRTContent = TranscriptParser.convertToBilingualSRT(enLines, zhLines);
                    await this.app.vault.create(bilingualSRTPath, bilingualSRTContent);
                }
                result.bilingual = bilingualSRTFileName;
            }
        } else {
            console.log('[OB English Learner] ℹ️ No translated transcript available');
        }

        return result;
    }

    /**
     * Download and save thumbnail image to video folder
     */
    private async downloadThumbnail(url: string, fileName: string, videoFolder: string): Promise<string> {
        try {
            console.log('[OB English Learner] 🔍 DEBUG - downloadThumbnail fileName param:', fileName);
            const imageFileName = `${fileName}.jpg`;
            console.log('[OB English Learner] 🔍 DEBUG - downloadThumbnail imageFileName:', imageFileName);
            const imagePath = normalizePath(`${videoFolder}/${imageFileName}`);

            // Check if thumbnail already exists
            const existingThumbnail = this.app.vault.getAbstractFileByPath(imagePath);
            if (existingThumbnail) {
                console.log('[OB English Learner] Thumbnail already exists, using existing file');
                console.log('[OB English Learner] 🔍 DEBUG - Returning existing imageFileName:', imageFileName);
                return imageFileName; // Return just filename for wikilink
            }

            const response = await requestUrl({ url });
            // Save as binary
            await this.app.vault.createBinary(imagePath, response.arrayBuffer);

            console.log('[OB English Learner] 🔍 DEBUG - Returning new imageFileName:', imageFileName);
            return imageFileName; // Return just filename for wikilink
        } catch (e) {
            console.error('Failed to download thumbnail:', e);
            return '';
        }
    }

    /**
     * Ensure folder exists, create if not
     */
    private async ensureFolderExists(folderPath: string): Promise<void> {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
            console.log('[OB English Learner] Created folder:', folderPath);
        }
    }

    /**
     * Sanitize file name
     */
    private sanitizeFileName(name: string): string {
        console.log('[OB English Learner] 🔍 DEBUG - sanitizeFileName input:', name);
        const result = name
            .replace(/^["'""「]|["'""」]$/g, '')    // Remove leading/trailing quotes first (ASCII + Unicode)
            .replace(/[\\/:*?"<>|]/g, '-')  // Replace invalid chars
            .replace(/\s+/g, ' ')  // Normalize spaces
            .trim()
            .substring(0, 100);  // Limit length
        console.log('[OB English Learner] 🔍 DEBUG - sanitizeFileName output:', result);
        return result;
    }

    /**
     * Format duration in human readable format (e.g., "10m 23s")
     */
    private formatDuration(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    }
}
