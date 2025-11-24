// 使用已安装的YTranscript插件生成字幕
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// 加载YTranscript的编译版本
const ytTranscriptPath = path.resolve('../obsidian-yt-transcript-master/main.js');

// 解析SRT文件
function parseSRT(content) {
    const lines = [];
    const blocks = content.trim().split(/\n\n+/);
    
    for (const block of blocks) {
        const blockLines = block.split('\n');
        if (blockLines.length >= 3) {
            const index = parseInt(blockLines[0]);
            const [startTime, endTime] = blockLines[1].split(' --> ');
            const text = blockLines.slice(2).join('\n');
            
            lines.push({ index, startTime, endTime, text });
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

// 生成中英双语SRT
function generateBilingualSRT(englishLines, chineseLines) {
    let srt = '';
    
    englishLines.forEach((enLine, index) => {
        const startTime = msToSRTTime(enLine.offset);
        const endTime = msToSRTTime(enLine.offset + enLine.duration);
        
        // 找到对应的中文字幕
        const zhLine = chineseLines[index];
        const zhText = zhLine ? zhLine.text : '';
        
        srt += `${index + 1}\n`;
        srt += `${startTime} --> ${endTime}\n`;
        srt += `${enLine.text}\n`;
        if (zhText) {
            srt += `${zhText}\n`;
        }
        srt += `\n`;
    });
    
    return srt;
}

console.log('⚠️ This script requires running inside Obsidian environment');
console.log('📝 Alternative solution: Use YTranscript plugin directly in Obsidian\n');

// 说明手动操作步骤
console.log('=== 手动生成字幕步骤 ===\n');
console.log('1. 在Obsidian中打开YTranscript插件');
console.log('2. 输入视频URL: https://youtu.be/jhEtBuuYNj4');
console.log('3. 等待获取英文字幕');
console.log('4. 将字幕复制并保存为 "How To Order Coffee In English - EN.srt"');
console.log('5. 运行以下Node脚本生成双语字幕:\n');

// 创建一个简单的双语合并脚本
const mergeScript = `// merge-subtitles.mjs - 合并英文和中文字幕
import fs from 'fs';
import path from 'path';

const enSRTPath = 'c:\\\\Users\\\\dashell-f\\\\Documents\\\\obsidian learner\\\\Languages\\\\Assets\\\\How To Order Coffee In English - EN.srt';
const zhSRTPath = 'c:\\\\Users\\\\dashell-f\\\\Documents\\\\obsidian learner\\\\Languages\\\\Assets\\\\How To Order Coffee In English.srt';
const outputPath = 'c:\\\\Users\\\\dashell-f\\\\Documents\\\\obsidian learner\\\\Languages\\\\Assets\\\\How To Order Coffee In English - EN-ZH.srt';

function parseSRT(content) {
    const lines = [];
    const blocks = content.trim().split(/\\n\\n+/);
    for (const block of blocks) {
        const blockLines = block.split('\\n');
        if (blockLines.length >= 3) {
            const index = parseInt(blockLines[0]);
            const [startTime, endTime] = blockLines[1].split(' --> ');
            const text = blockLines.slice(2).join('\\n');
            lines.push({ index, startTime, endTime, text });
        }
    }
    return lines;
}

const enLines = parseSRT(fs.readFileSync(enSRTPath, 'utf-8'));
const zhLines = parseSRT(fs.readFileSync(zhSRTPath, 'utf-8'));

let bilingual = '';
enLines.forEach((enLine, i) => {
    const zhLine = zhLines[i];
    bilingual += \`\${i + 1}\\n\`;
    bilingual += \`\${enLine.startTime} --> \${enLine.endTime}\\n\`;
    bilingual += \`\${enLine.text}\\n\`;
    if (zhLine) {
        bilingual += \`\${zhLine.text}\\n\`;
    }
    bilingual += \`\\n\`;
});

fs.writeFileSync(outputPath, bilingual, 'utf-8');
console.log('✅ 双语字幕已生成:', outputPath);
`;

// 保存合并脚本
const mergeScriptPath = 'c:\\Users\\dashell-f\\Documents\\obsidian learner\\.obsidian\\plugins\\obsidian-sample-plugin-master\\merge-subtitles.mjs';
fs.writeFileSync(mergeScriptPath, mergeScript, 'utf-8');

console.log(`✅ 已创建合并脚本: ${mergeScriptPath}`);
console.log(`\n💡 获取英文字幕后，运行: node merge-subtitles.mjs\n`);
