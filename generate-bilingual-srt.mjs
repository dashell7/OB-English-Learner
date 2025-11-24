// 生成中英双语字幕的脚本
// 前提：英文字幕已通过 download-subtitles.mjs 下载
import fs from 'fs';
import path from 'path';

// 将SRT时间格式转换为毫秒
function srtTimeToMs(timeStr) {
    const [time, ms] = timeStr.split(',');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    return hours * 3600000 + minutes * 60000 + seconds * 1000 + Number(ms);
}

// 解析SRT文件
function parseSRT(content) {
    const lines = [];
    const blocks = content.trim().split(/\n\n+/);
    
    for (const block of blocks) {
        const blockLines = block.split('\n');
        if (blockLines.length >= 3) {
            const [startTime, endTime] = blockLines[1].split(' --> ');
            const text = blockLines.slice(2).join('\n');
            
            const startMs = srtTimeToMs(startTime.trim());
            const endMs = srtTimeToMs(endTime.trim());
            
            lines.push({ 
                offset: startMs,
                duration: endMs - startMs,
                text: text
            });
        }
    }
    
    return lines;
}

// 将毫秒转换为SRT时间格式 (HH:MM:SS,mmm)
function msToSRTTime(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

// 生成SRT格式
function generateSRT(lines) {
    let srt = '';
    
    lines.forEach((line, index) => {
        const startTime = msToSRTTime(line.offset);
        const endTime = msToSRTTime(line.offset + line.duration);
        
        srt += `${index + 1}\n`;
        srt += `${startTime} --> ${endTime}\n`;
        srt += `${line.text}\n\n`;
    });
    
    return srt;
}

// 根据时间范围查找匹配的中文字幕
function findMatchingChineseSubtitle(enLine, chineseLines) {
    const enStart = enLine.offset;
    const enEnd = enLine.offset + enLine.duration;
    const enMid = (enStart + enEnd) / 2;
    
    // 查找时间范围有重叠的中文字幕
    const overlapping = chineseLines.filter(zhLine => {
        const zhStart = zhLine.offset;
        const zhEnd = zhLine.offset + zhLine.duration;
        // 检查时间范围是否有重叠
        return (enStart < zhEnd && enEnd > zhStart);
    });
    
    if (overlapping.length === 0) {
        return null;
    }
    
    // 如果有多个重叠，选择中心点最接近的
    return overlapping.reduce((best, current) => {
        const currentMid = current.offset + current.duration / 2;
        const bestMid = best.offset + best.duration / 2;
        return Math.abs(currentMid - enMid) < Math.abs(bestMid - enMid) ? current : best;
    });
}

// 生成中英双语SRT
function generateBilingualSRT(englishLines, chineseLines) {
    let srt = '';
    let matchCount = 0;
    
    englishLines.forEach((enLine, index) => {
        const startTime = msToSRTTime(enLine.offset);
        const endTime = msToSRTTime(enLine.offset + enLine.duration);
        
        // 根据时间范围找到对应的中文字幕
        const zhLine = findMatchingChineseSubtitle(enLine, chineseLines);
        const zhText = zhLine ? zhLine.text : '';
        
        if (zhText) {
            matchCount++;
        }
        
        srt += `${index + 1}\n`;
        srt += `${startTime} --> ${endTime}\n`;
        srt += `${enLine.text}\n`;
        if (zhText) {
            srt += `${zhText}\n`;
        }
        srt += `\n`;
    });
    
    console.log(`✅ Matched ${matchCount}/${englishLines.length} subtitles with Chinese translations`);
    
    return srt;
}

// 使用 youtube-transcript 获取字幕
async function getYouTubeTranscript(videoId) {
    try {
        console.log(`📥 Fetching transcript for video: ${videoId}`);
        console.log(`Video URL: https://www.youtube.com/watch?v=${videoId}`);
        
        // 尝试多种方式获取字幕
        let transcript;
        
        try {
            // 方法1: 只传 videoId
            transcript = await YoutubeTranscript.fetchTranscript(videoId);
        } catch (e1) {
            console.log('⚠️ Method 1 failed, trying with lang option...');
            try {
                // 方法2: 传入 lang 参数
                transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
            } catch (e2) {
                console.log('⚠️ Method 2 failed, trying with country option...');
                // 方法3: 添加 country 参数
                transcript = await YoutubeTranscript.fetchTranscript(videoId, { 
                    lang: 'en',
                    country: 'US'
                });
            }
        }
        
        if (!transcript || transcript.length === 0) {
            throw new Error('No transcript data received');
        }
        
        console.log(`✅ Got ${transcript.length} transcript entries`);
        
        // 转换为我们需要的格式
        const lines = transcript.map(item => ({
            offset: Math.floor(item.offset),
            duration: Math.floor(item.duration),
            text: item.text
        }));
        
        return { lines };
        
    } catch (error) {
        console.error('❌ Error fetching transcript:', error.message);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
        console.error('\nThis could mean:');
        console.error('  1. The video has no captions/subtitles');
        console.error('  2. The video is private or restricted');
        console.error('  3. English captions are not available');
        console.error('  4. Network/proxy issues');
        throw error;
    }
}

async function main() {
    const videoId = 'jhEtBuuYNj4';
    const chineseSRTPath = 'c:\\Users\\dashell-f\\Documents\\obsidian learner\\zrl7vk2qbt5t6v6cixvnf02x.F7OD.srt';
    const outputDir = 'c:\\Users\\dashell-f\\Documents\\obsidian learner\\Languages\\Assets';
    
    try {
        // 从 YouTube 获取英文字幕
        const transcript = await getYouTubeTranscript(videoId);
        const englishLines = transcript.lines;
        
        console.log(`✅ Loaded ${englishLines.length} English subtitle lines from YouTube`);
        
        // 生成纯英文SRT
        const englishSRT = generateSRT(englishLines);
        const englishPath = path.join(outputDir, 'How To Order Coffee In English - EN.srt');
        fs.writeFileSync(englishPath, englishSRT, 'utf-8');
        console.log(`✅ Generated English SRT: ${englishPath}`);
        
        // 读取中文SRT
        const chineseSRTContent = fs.readFileSync(chineseSRTPath, 'utf-8');
        const chineseLines = parseSRT(chineseSRTContent);
        console.log(`📖 Loaded ${chineseLines.length} Chinese subtitle lines`);
        
        // 生成中英双语SRT
        const bilingualSRT = generateBilingualSRT(englishLines, chineseLines);
        const bilingualPath = path.join(outputDir, 'How To Order Coffee In English - EN-ZH.srt');
        fs.writeFileSync(bilingualPath, bilingualSRT, 'utf-8');
        console.log(`✅ Generated Bilingual SRT: ${bilingualPath}`);
        
        console.log('\n🎉 All done!');
        console.log(`\n📁 Generated files:`);
        console.log(`   - ${englishPath}`);
        console.log(`   - ${bilingualPath}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
