# 🎙️ 只录音模式 (Record-Only Mode)

## 📋 功能说明

新增"只录音模式"设置，允许用户录音但跳过转录步骤，适用于以下场景：
- 只想保存音频文件，不需要文字转录
- 节省 API 调用费用
- 快速录音，稍后再转录
- 录制非语音内容（音乐、环境音等）

---

## ⚙️ 设置位置

**Settings → Audio / 音频 → Voice to Text (STT) → Record Only Mode**

---

## 🎯 功能特点

### 1. **智能开关**
- 开启"只录音模式"时，自动开启"保存音频文件"
- 确保录音一定会被保存

### 2. **跳过转录**
- 录音完成后不调用 STT API
- 不消耗 API 额度
- 节省等待时间

### 3. **友好提示**
- 录音完成后显示：`✅ Audio saved! (Record-only mode, no transcription)`
- 清楚告知用户当前模式

### 4. **音频嵌入**
- 仍然会在笔记中插入音频链接：`![[recording.mp3]]`
- 可以直接在 Obsidian 中播放

---

## 📖 使用方法

### 步骤 1: 开启只录音模式

1. 打开 **Settings → Audio**
2. 找到 **Voice to Text (STT)** 卡片
3. 开启 **"Record Only Mode"** 开关

### 步骤 2: 开始录音

1. 点击左侧 **麦克风图标** 或使用快捷键
2. 开始录音
3. 点击 **"Save"** 保存

### 步骤 3: 查看结果

录音完成后：
- ✅ 音频文件保存到指定文件夹
- ✅ 笔记中插入音频链接
- ❌ **不进行转录**（节省时间和费用）

---

## 🔄 模式对比

| 功能 | 正常模式 | 只录音模式 |
|------|---------|-----------|
| **录音** | ✅ | ✅ |
| **保存音频** | 可选 | ✅ 强制开启 |
| **转录文字** | ✅ | ❌ 跳过 |
| **插入音频链接** | ✅ | ✅ |
| **插入转录文字** | ✅ | ❌ |
| **API 调用** | ✅ | ❌ 不调用 |
| **等待时间** | 较长 | 很短 |

---

## 💡 使用场景

### 场景 1: 快速录音备忘
```
需求：快速录制想法，不需要立即转录
操作：开启只录音模式 → 录音 → 保存
结果：音频保存，稍后可手动转录
```

### 场景 2: 录制音乐/环境音
```
需求：录制音乐片段或环境声音
操作：开启只录音模式 → 录音 → 保存
结果：纯音频文件，无需转录
```

### 场景 3: 节省 API 费用
```
需求：大量录音，但不是每条都需要转录
操作：开启只录音模式 → 批量录音
结果：只保存音频，按需转录
```

### 场景 4: 离线录音
```
需求：没有网络时录音
操作：开启只录音模式 → 录音
结果：音频保存，有网络后再转录
```

---

## 🎨 界面展示

### 设置界面
```
┌─────────────────────────────────────┐
│ 🎙️ Voice to Text (STT)            │
├─────────────────────────────────────┤
│ ☑ Enable Voice to Text             │
│                                     │
│ STT Provider: [OpenAI ▼]           │
│ API Key: [sk-...        ]          │
│                                     │
│ ☑ Save Audio File                  │
│ ☑ Record Only Mode  ← 新增         │
│                                     │
│ Filename Template: [Recording_...] │
│ Audio Folder: [recordings]         │
└─────────────────────────────────────┘
```

### 录音完成提示

**正常模式**：
```
Processing audio...
Transcribing audio... ⏳
✅ Transcription complete!
```

**只录音模式**：
```
Processing audio...
✅ Audio saved! (Record-only mode, no transcription)
```

---

## 🔧 技术实现

### 1. 类型定义
```typescript
// src/types.ts
export interface LinguaSyncSettings {
    // ...
    recordOnlyMode: boolean;  // 只录音不转录模式
}
```

### 2. 默认设置
```typescript
// main.ts
const DEFAULT_SETTINGS = {
    // ...
    recordOnlyMode: false,  // 默认关闭
};
```

### 3. 设置界面
```typescript
new Setting(sttCard)
    .setName('Record Only Mode')
    .setDesc('Only record audio without transcription')
    .addToggle(toggle => toggle
        .setValue(this.plugin.settings.recordOnlyMode)
        .onChange(async (value) => {
            this.plugin.settings.recordOnlyMode = value;
            // 自动开启保存音频
            if (value && !this.plugin.settings.saveAudio) {
                this.plugin.settings.saveAudio = true;
            }
            this.saveAndNotify();
        }));
```

### 4. 录音逻辑
```typescript
// 录音完成后
if (this.settings.recordOnlyMode) {
    // 只录音模式：跳过转录
    new Notice('✅ Audio saved! (Record-only mode)');
} else {
    // 正常模式：进行转录
    const notice = new Notice('Transcribing audio... ⏳', 0);
    transcription = await this.transcriptionService.transcribe(...);
    notice.hide();
    new Notice('✅ Transcription complete!');
}
```

---

## ⚡ 性能对比

### 正常模式（含转录）
```
录音 (10s) → 保存音频 (1s) → 转录 (5-10s) → 插入文本
总耗时：16-21 秒
API 调用：1 次
费用：$0.006 (按 OpenAI Whisper 计算)
```

### 只录音模式
```
录音 (10s) → 保存音频 (1s) → 完成
总耗时：11 秒
API 调用：0 次
费用：$0
```

**节省**：
- ⏱️ 时间节省：30-50%
- 💰 费用节省：100%

---

## 🔍 常见问题

### Q1: 开启只录音模式后，还能转录吗？
**A**: 可以！有两种方式：
1. 关闭只录音模式，重新录音
2. 使用其他工具（如 Whisper Desktop）手动转录已保存的音频文件

### Q2: 音频文件保存在哪里？
**A**: 保存在设置中指定的 **Audio Folder** 路径，默认为 `recordings/`

### Q3: 可以批量转录已保存的音频吗？
**A**: 目前不支持批量转录，需要逐个处理或使用外部工具

### Q4: 只录音模式会影响音频质量吗？
**A**: 不会！音频质量由 **Audio Format** 设置决定，与是否转录无关

### Q5: 开启只录音模式后，API Key 还需要配置吗？
**A**: 不需要！只录音模式不调用 API，无需配置 API Key

---

## 📊 使用统计

### 适用人群
- ✅ 需要快速录音的用户
- ✅ 想节省 API 费用的用户
- ✅ 录制非语音内容的用户
- ✅ 离线环境下的用户

### 不适用场景
- ❌ 需要立即获得文字的场景
- ❌ 不需要保存音频的场景

---

## 🎉 总结

**只录音模式**是一个实用的功能，让你可以：
- 🚀 **更快**：跳过转录，节省时间
- 💰 **更省**：不调用 API，节省费用
- 🎯 **更灵活**：按需转录，自由选择

**开启方式**：Settings → Audio → Voice to Text → Record Only Mode

---

**享受更灵活的录音体验！** 🎙️✨
