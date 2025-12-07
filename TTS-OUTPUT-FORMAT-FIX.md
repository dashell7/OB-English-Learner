# 🔊 TTS Output Format Fix - 输出格式修复

## 🐛 问题描述

在 OB-English-Learner 插件中，选择 Azure TTS 的 WAV 输出格式后，导出的音频文件扩展名仍然是 `.mp3`，而不是 `.wav`。

**问题表现**：
- 设置中选择：`WAV 16kHz 16bit`
- 实际输出：`audio-hash.mp3` ❌
- 期望输出：`audio-hash.wav` ✅

---

## 🔍 问题原因

在 `exportTextToAudio()` 函数中，文件名生成逻辑硬编码了 `.mp3` 扩展名：

```typescript
// 之前的代码
const filename = `${prefix}-${hashStr}.mp3`;  // ❌ 硬编码 .mp3
```

虽然 Azure TTS API 根据 `ttsOutputFormat` 设置返回了正确格式的音频数据，但文件名没有相应更新。

---

## ✅ 修复内容

### 动态扩展名生成

**修复后的代码**：
```typescript
// Determine file extension based on output format
let extension = 'mp3'; // Default
if (this.settings.ttsProvider === 'azure' && this.settings.ttsOutputFormat) {
    const format = this.settings.ttsOutputFormat.toLowerCase();
    if (format.includes('wav')) {
        extension = 'wav';
    } else if (format.includes('mp3')) {
        extension = 'mp3';
    } else if (format.includes('ogg')) {
        extension = 'ogg';
    } else if (format.includes('webm')) {
        extension = 'webm';
    }
}

const filename = `${prefix}-${hashStr}.${extension}`;  // ✅ 动态扩展名
```

---

## 📊 支持的格式

### Azure TTS 输出格式

| 设置选项 | 输出扩展名 | 文件大小 | 质量 |
|---------|-----------|---------|------|
| **MP3 16kHz 128kbps** | `.mp3` | 小 | 标准 |
| **MP3 24kHz 96kbps** | `.mp3` | 中 | 高 |
| **MP3 48kHz 192kbps** | `.mp3` | 大 | 最高 |
| **WAV 16kHz 16bit** | `.wav` | 大 | 无损 |
| **WAV 24kHz 16bit** | `.wav` | 很大 | 无损 |
| **WAV 48kHz 16bit** | `.wav` | 超大 | 无损 |

### 其他提供商

| 提供商 | 默认格式 | 扩展名 |
|--------|---------|--------|
| **OpenAI** | MP3 | `.mp3` |
| **ElevenLabs** | MP3 | `.mp3` |
| **Gemini** | MP3 | `.mp3` |
| **Custom** | MP3 | `.mp3` |

---

## 🎯 使用示例

### 示例 1: Azure WAV 输出

**设置**：
```
TTS Provider: Azure
Output Format: WAV 16kHz 16bit
```

**导出文本**：
```
"Hello, this is a test."
```

**生成文件**：
```
03-Resources/aloud/Hello-this-is-a-test-1a2b3c4d.wav  ✅
```

### 示例 2: Azure MP3 输出

**设置**：
```
TTS Provider: Azure
Output Format: MP3 24kHz 96kbps
```

**导出文本**：
```
"Hello, this is a test."
```

**生成文件**：
```
03-Resources/aloud/Hello-this-is-a-test-1a2b3c4d.mp3  ✅
```

### 示例 3: OpenAI 输出

**设置**：
```
TTS Provider: OpenAI
```

**导出文本**：
```
"Hello, this is a test."
```

**生成文件**：
```
03-Resources/aloud/Hello-this-is-a-test-1a2b3c4d.mp3  ✅
```

---

## 🔧 技术细节

### 文件名生成流程

1. **生成前缀**
   ```typescript
   const prefix = text
       .replace(/\s/g, '-')           // 空格 → 连字符
       .replace(/[^a-zA-Z0-9_-]/g, '') // 移除特殊字符
       .slice(0, 20)                   // 限制长度
       .replace(/-+$/, '')             // 移除尾部连字符
       || 'audio';                     // 默认前缀
   ```

2. **生成哈希**
   ```typescript
   let hash = 0;
   for (let i = 0; i < text.length; i++) {
       hash = ((hash << 5) - hash) + text.charCodeAt(i);
       hash = hash & hash;
   }
   const hashStr = Math.abs(hash).toString(16);
   ```

3. **确定扩展名**
   ```typescript
   let extension = 'mp3'; // 默认
   if (provider === 'azure' && outputFormat) {
       if (outputFormat.includes('wav')) extension = 'wav';
       else if (outputFormat.includes('mp3')) extension = 'mp3';
       // ...
   }
   ```

4. **组合文件名**
   ```typescript
   const filename = `${prefix}-${hashStr}.${extension}`;
   // 例如: Hello-this-is-a-test-1a2b3c4d.wav
   ```

---

## 📋 格式识别规则

### Azure 格式字符串

```typescript
// Azure 格式示例
'audio-16khz-128kbitrate-mono-mp3'  → .mp3
'audio-24khz-96kbitrate-mono-mp3'   → .mp3
'audio-48khz-192kbitrate-mono-mp3'  → .mp3
'riff-16khz-16bit-mono-pcm'         → .wav
'riff-24khz-16bit-mono-pcm'         → .wav
'riff-48khz-16bit-mono-pcm'         → .wav
'audio-16khz-32kbitrate-mono-opus'  → .ogg
'webm-24khz-16bit-mono-opus'        → .webm
```

### 识别逻辑

```typescript
const format = this.settings.ttsOutputFormat.toLowerCase();

if (format.includes('wav') || format.includes('riff') || format.includes('pcm')) {
    extension = 'wav';
} else if (format.includes('mp3')) {
    extension = 'mp3';
} else if (format.includes('ogg') || format.includes('opus')) {
    extension = 'ogg';
} else if (format.includes('webm')) {
    extension = 'webm';
}
```

---

## 🎨 文件嵌入效果

### WAV 文件
```markdown
![[Hello-this-is-a-test-1a2b3c4d.wav]]
```
- 在 Language Learner 阅读模式中显示 🔊 扬声器图标（紫色）
- 可以直接在 Obsidian 中播放

### MP3 文件
```markdown
![[Hello-this-is-a-test-1a2b3c4d.mp3]]
```
- 在 Language Learner 阅读模式中显示 🔊 扬声器图标（紫色）
- 可以直接在 Obsidian 中播放

---

## ⚡ 性能对比

### 文件大小对比（10秒音频）

| 格式 | 大小 | 质量 | 兼容性 |
|------|------|------|--------|
| **MP3 16kHz 128kbps** | ~160 KB | 标准 | ⭐⭐⭐⭐⭐ |
| **MP3 24kHz 96kbps** | ~120 KB | 高 | ⭐⭐⭐⭐⭐ |
| **MP3 48kHz 192kbps** | ~240 KB | 最高 | ⭐⭐⭐⭐⭐ |
| **WAV 16kHz 16bit** | ~320 KB | 无损 | ⭐⭐⭐⭐ |
| **WAV 24kHz 16bit** | ~480 KB | 无损 | ⭐⭐⭐⭐ |
| **WAV 48kHz 16bit** | ~960 KB | 无损 | ⭐⭐⭐⭐ |

### 推荐设置

#### 一般使用
```
Format: MP3 24kHz 96kbps
优点: 文件小，质量高，兼容性好
```

#### 高质量需求
```
Format: MP3 48kHz 192kbps
优点: 接近无损，文件适中
```

#### 专业用途
```
Format: WAV 24kHz 16bit
优点: 无损质量，适合后期处理
```

---

## 🔄 更新日志

### v1.0.2 (2025-12-01)
- ✅ 修复 Azure TTS 输出格式问题
- ✅ 文件扩展名现在根据输出格式动态生成
- ✅ 支持 WAV、MP3、OGG、WebM 格式
- ✅ 保持与 Aloud 插件的文件名兼容性

### v1.0.1 (之前)
- ❌ 文件扩展名硬编码为 `.mp3`
- ❌ 选择 WAV 格式仍输出 `.mp3` 文件名

---

## 🎊 总结

现在 OB-English-Learner 插件可以：
- ✅ **正确识别输出格式**
- ✅ **动态生成文件扩展名**
- ✅ **支持多种音频格式**
- ✅ **与 Language Learner 完美配合**

**重启 Obsidian (Ctrl+R) 后，选择 WAV 格式将正确输出 `.wav` 文件！** 🎉✨

---

## 📝 测试方法

1. 打开 Settings → Text to Speech
2. 选择 Provider: Azure
3. 选择 Output Format: WAV 16kHz 16bit
4. 选择一段文本
5. 右键 → "Aloud: Export selection to audio"
6. 检查生成的文件扩展名是否为 `.wav`

**预期结果**：
```
03-Resources/aloud/Selected-text-hash.wav  ✅
```

---

**Enjoy the correct audio format!** 🔊✨
