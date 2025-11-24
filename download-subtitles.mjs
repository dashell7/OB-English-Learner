// 使用 yt-dlp 下载YouTube字幕的备用脚本
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 将VTT转换为SRT格式
function vttToSrt(vttContent) {
    // 移除VTT header和元数据
    let lines = vttContent.split('\n');
    let contentStart = 0;
    
    // 跳过WEBVTT header和metadata
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) {
            // 找到第一个时间戳，往前退一行（这是序号）
            contentStart = Math.max(0, i - 1);
            break;
        }
    }
    
    lines = lines.slice(contentStart);
    let content = lines.join('\n');
    
    // 移除VTT样式标签和&nbsp;
    content = content.replace(/<[^>]+>/g, '');
    content = content.replace(/&nbsp;/g, ' ');
    content = content.replace(/&amp;/g, '&');
    
    // 转换时间格式 (VTT使用点, SRT使用逗号)
    content = content.replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, '$1,$2');
    
    // 重新编号
    const blocks = content.trim().split('\n\n');
    let srt = '';
    let validIndex = 1;
    
    blocks.forEach((block) => {
        const trimmed = block.trim();
        if (trimmed && trimmed.includes('-->')) {
            // 移除可能存在的旧序号
            const blockLines = trimmed.split('\n');
            let startLine = 0;
            
            // 找到时间戳行
            for (let i = 0; i < blockLines.length; i++) {
                if (blockLines[i].includes('-->')) {
                    startLine = i;
                    break;
                }
            }
            
            // 构建新的字幕块
            srt += `${validIndex}\n`;
            srt += blockLines.slice(startLine).join('\n');
            srt += '\n\n';
            validIndex++;
        }
    });
    
    return srt.trim() + '\n';
}

async function main() {
    const videoId = 'jhEtBuuYNj4';
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const outputDir = 'c:\\Users\\dashell-f\\Documents\\obsidian learner\\Languages\\Assets';
    
    console.log('📥 Downloading subtitles using yt-dlp...');
    console.log(`Video: ${videoUrl}`);
    
    try {
        // 检查 yt-dlp 是否安装
        try {
            execSync('python -m yt_dlp --version', { stdio: 'pipe' });
        } catch (error) {
            console.error('❌ yt-dlp is not installed!');
            console.error('Please install it:');
            console.error('  - Windows: python -m pip install yt-dlp');
            console.error('  - Or download from: https://github.com/yt-dlp/yt-dlp');
            process.exit(1);
        }
        
        // 下载英文字幕
        const tempDir = path.join(outputDir, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        console.log('📥 Downloading English subtitles...');
        const command = `python -m yt_dlp --write-subs --write-auto-subs --sub-lang en --skip-download --output "${path.join(tempDir, 'video')}" "${videoUrl}"`;
        
        try {
            execSync(command, { stdio: 'inherit' });
        } catch (error) {
            console.error('❌ Failed to download subtitles');
            console.error('This could mean:');
            console.error('  1. The video has no captions available');
            console.error('  2. The video is private or restricted');
            console.error('  3. Network connection issues');
            throw error;
        }
        
        // 查找下载的字幕文件
        const files = fs.readdirSync(tempDir);
        const enSubtitle = files.find(f => f.includes('.en.') && (f.endsWith('.vtt') || f.endsWith('.srt')));
        
        if (!enSubtitle) {
            console.error('❌ No English subtitle file found');
            console.error('Available files:', files);
            throw new Error('Subtitle file not found');
        }
        
        console.log(`✅ Found subtitle file: ${enSubtitle}`);
        
        // 读取并转换字幕
        const subtitlePath = path.join(tempDir, enSubtitle);
        let content = fs.readFileSync(subtitlePath, 'utf-8');
        
        // 如果是VTT格式，转换为SRT
        if (enSubtitle.endsWith('.vtt')) {
            console.log('🔄 Converting VTT to SRT...');
            content = vttToSrt(content);
        }
        
        // 保存为SRT文件
        const outputPath = path.join(outputDir, 'How To Order Coffee In English - EN.srt');
        fs.writeFileSync(outputPath, content, 'utf-8');
        console.log(`✅ Saved English SRT: ${outputPath}`);
        
        // 清理临时文件
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        console.log('\n🎉 Done! Now you can run generate-bilingual-srt.mjs');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
