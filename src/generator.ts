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
        const fileName = this.sanitizeFileName(metadata.title);
        const notePath = normalizePath(`${this.settings.videoFolder}/${fileName}.md`);
        
        // If update mode, try to find the actual existing note
        let existingNote = this.app.vault.getAbstractFileByPath(notePath);
        
        if (isUpdate && !existingNote) {
             const files = this.app.vault.getMarkdownFiles();
             for (const file of files) {
                 if (!file.path.startsWith(this.settings.videoFolder)) continue;
                 if (file.basename === fileName) {
                     existingNote = file;
                     break;
                 }
             }
        }

        if (existingNote instanceof TFile) {
            console.log('[OB English Learner] 🔄 Update mode: Targeting existing note at', notePath);
        } else {
            console.log('[OB English Learner] 📥 Creating new note...');
        }

        // Ensure all folders exist (independent directories)
        await this.ensureFolderExists(this.settings.videoFolder);
        await this.ensureFolderExists(this.settings.subtitlesFolder);
        await this.ensureFolderExists(this.settings.thumbnailsFolder);

        // 2. Check/Create Thumbnail (in independent thumbnails folder)
        let coverPath = '';
        console.log('[OB English Learner] 🔍 autoDownloadThumbnails:', this.settings.autoDownloadThumbnails);
        
        if (this.settings.autoDownloadThumbnails) {
            const imgName = `${fileName}.jpg`;
            const imgPath = normalizePath(`${this.settings.thumbnailsFolder}/${imgName}`);
            
            console.log('[OB English Learner] 🔍 Checking for existing cover at:', imgPath);
            
            // Check if cover exists
            if (this.app.vault.getAbstractFileByPath(imgPath)) {
                 console.log('[OB English Learner] ✅ Cover already exists, reusing:', imgPath);
                 coverPath = imgPath;
            } else {
                 console.log('[OB English Learner] 📥 Cover not found, downloading...');
                 console.log('[OB English Learner] 📥 Thumbnail URL:', metadata.thumbnailUrl);
                 coverPath = await this.downloadThumbnail(metadata.thumbnailUrl, fileName);
                 console.log('[OB English Learner] 📥 Download result:', coverPath);
            }
        } else {
            console.log('[OB English Learner] ⚠️ Auto-download thumbnails is disabled');
        }

        // 3. Check/Create SRTs (in independent subtitles folder)
        // Determine which transcript to use for SRT files
        // Use refined if available AND enableAISubtitles is true
        const useRefinedForSRT = this.settings.enableAISubtitles && videoData.refinedTranscript;
        const srtTranscript = useRefinedForSRT ? videoData.refinedTranscript! : videoData.transcript;
        const srtTranslated = useRefinedForSRT ? videoData.refinedTranslatedTranscript : videoData.translatedTranscript;

        // This ensures missing files are regenerated, but existing ones are preserved
        const srtPaths = await this.ensureSRTFiles(srtTranscript, srtTranslated, fileName);

        // Determine which transcript to use for NOTE content
        // Use refined if available AND enableAIFormatting is true
        const useRefinedForNote = this.settings.enableAIFormatting && videoData.refinedTranscript;
        const noteTranscript = useRefinedForNote ? videoData.refinedTranscript! : videoData.transcript;
        const noteTranslated = useRefinedForNote ? videoData.refinedTranslatedTranscript : videoData.translatedTranscript;

        // Determine which transcript to display (prefer English)
        const displayTranscript = noteTranscript[0]?.lang && noteTranscript[0].lang.startsWith('en')
            ? noteTranscript 
            : (noteTranslated && noteTranslated[0]?.lang && noteTranslated[0].lang.startsWith('en') 
                ? noteTranslated 
                : noteTranscript);

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
        
        // Build SRT links (using absolute paths to subtitles folder)
        const srtLinksArr = [];
        if (srtPaths.english) {
            srtLinksArr.push(`- English: [[${this.settings.subtitlesFolder}/${srtPaths.english}]]`);
        }
        if (srtPaths.chinese) {
            srtLinksArr.push(`- 中文: [[${this.settings.subtitlesFolder}/${srtPaths.chinese}]]`);
        }
        if (srtPaths.bilingual) {
            srtLinksArr.push(`- EN-ZH: [[${this.settings.subtitlesFolder}/${srtPaths.bilingual}]]`);
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
        
        // Prepare cover - just use the path, Obsidian will handle it
        // For frontmatter cover property, use plain path without wikilink brackets
        console.log('[OB English Learner] 🔍 DEBUG - coverPath:', coverPath);
        const coverLink = coverPath || '';

        // Escape title for YAML (handle special characters like colons)
        const escapedTitle = this.escapeYAMLString(metadata.title);
        const escapedChannel = this.escapeYAMLString(metadata.channel);
        
        // Replace template variables
        let content = template
            .replace(/{{title}}/g, escapedTitle)
            .replace(/{{videoId}}/g, metadata.videoId)
            .replace(/{{url}}/g, metadata.url || `https://youtu.be/${metadata.videoId}`)
            .replace(/{{channel}}/g, escapedChannel)
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

    private async ensureSRTFiles(
        primaryTranscript: any[], 
        translatedTranscript: any[] | undefined, 
        fileName: string
    ): Promise<any> {
        const subtitlesFolder = this.settings.subtitlesFolder;
        const result: any = {};
        
        // Detect primary transcript language
        const primaryLang = primaryTranscript[0]?.lang || 'en';
        const translatedLang = translatedTranscript?.[0]?.lang;
        
        console.log(`[OB English Learner] Primary language: ${primaryLang}, Translated: ${translatedLang || 'none'}`);

        // Generate primary SRT (could be EN or ZH)
        const isPrimaryEn = primaryLang.startsWith('en');
        const primaryLangLabel = isPrimaryEn ? 'EN' : 'ZH';
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
        
        if (isPrimaryEn) {
            result.english = primarySRTFileName;
        } else {
            result.chinese = primarySRTFileName;
        }

        // Generate translated SRT if available
        if (translatedTranscript && translatedTranscript.length > 0) {
            const isTranslatedEn = translatedLang && translatedLang.startsWith('en');
            const translatedLangLabel = isTranslatedEn ? 'EN' : 'ZH';
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
            
            if (translatedLang === 'zh' || (translatedLang && translatedLang.startsWith('zh'))) {
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
                    console.log(`[OB English Learner] SRT already exists, keeping: ${bilingualSRTFileName}`);
                } else {
                    console.log(`[OB English Learner] Creating missing SRT: ${bilingualSRTFileName}`);
                    const enLines = isPrimaryEn ? primaryTranscript : translatedTranscript;
                    const zhLines = !isPrimaryEn ? primaryTranscript : translatedTranscript;
                    
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
     * Download and save thumbnail image to thumbnails folder
     * Tries multiple resolutions if higher quality fails
     */
    private async downloadThumbnail(url: string, fileName: string): Promise<string> {
        const imageFileName = `${fileName}.jpg`;
        const imagePath = normalizePath(`${this.settings.thumbnailsFolder}/${imageFileName}`);

        // Check if thumbnail already exists
        const existingThumbnail = this.app.vault.getAbstractFileByPath(imagePath);
        if (existingThumbnail) {
            console.log('[OB English Learner] ✅ Thumbnail already exists:', imagePath);
            return imagePath;
        }

        // Try multiple thumbnail qualities (YouTube specific)
        // maxresdefault (1920x1080) -> sddefault (640x480) -> hqdefault (480x360) -> mqdefault (320x180) -> default (120x90)
        const urlVariants = [
            url, // Original URL (usually maxresdefault)
            url.replace('maxresdefault', 'sddefault'),
            url.replace('maxresdefault', 'hqdefault'),
            url.replace('maxresdefault', 'mqdefault'),
            url.replace('maxresdefault', 'default')
        ];

        console.log('[OB English Learner] 📥 Attempting to download thumbnail...');
        
        for (let i = 0; i < urlVariants.length; i++) {
            const tryUrl = urlVariants[i];
            try {
                console.log(`[OB English Learner] 📥 Trying quality ${i + 1}/${urlVariants.length}: ${tryUrl}`);
                const response = await requestUrl({ url: tryUrl });
                
                // Save as binary
                await this.app.vault.createBinary(imagePath, response.arrayBuffer);
                console.log('[OB English Learner] ✅ Thumbnail saved successfully:', imagePath);
                return imagePath;
            } catch (e) {
                console.log(`[OB English Learner] ⚠️ Quality ${i + 1} failed (${e.message}), trying next...`);
                // Continue to next quality
            }
        }

        // All attempts failed
        console.error('[OB English Learner] ❌ Failed to download thumbnail at any quality');
        console.error('[OB English Learner] ❌ Original URL was:', url);
        return '';
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
     * Escape string for YAML frontmatter
     * Handles special characters like colons, quotes, etc.
     */
    private escapeYAMLString(str: string): string {
        if (!str) return '""';
        
        // Check if string needs quoting (contains special YAML characters)
        const needsQuoting = /[:\[\]{}&*#?|\-<>=!%@`]/.test(str) || 
                            str.startsWith(' ') || 
                            str.endsWith(' ') ||
                            str.includes('"') ||
                            str.includes("'");
        
        if (needsQuoting) {
            // Use double quotes and escape any internal double quotes
            return `"${str.replace(/"/g, '\\"')}"`;
        }
        
        return str;
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
