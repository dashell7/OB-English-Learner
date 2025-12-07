# 🧪 测试指南：高亮 + 无缝播放

## 🎯 两大改进

### 1. ✅ 文本高亮（紫色）
- 当前播放的句子会有紫色背景高亮
- 高亮随播放移动

### 2. ✅ 无缝播放（无停顿）
- 句子之间不再有停顿
- 预加载机制：提前加载2句
- 完全对齐 Aloud 体验

---

## 🚀 立即测试

### 步骤 1：重启 Obsidian
```
按 Ctrl + R
等待插件重新加载...
```

### 步骤 2：创建测试文本
在任何笔记中输入：
```
This is sentence one. This is sentence two. This is sentence three. This is sentence four. This is sentence five.
```

### 步骤 3：开始播放
1. 选中整段文字
2. 按 `Ctrl + Space` 或点击工具栏的播放按钮

### 步骤 4：观察控制台
按 `F12` 打开开发者工具，查看控制台日志：

#### 应该看到的日志：
```
[TTSManager] Created 5 chunks
[TTSManager] Chunk: This is sentence one. (0-22)
[TTSManager] Chunk: This is sentence two. (23-46)
...

[TTS Toolbar] 🎯 highlightCurrentChunk called, currentChunk: 0
[TTS Toolbar] 📍 Highlight offsets: 0 - 22 text: This is sentence one.
[TTS Toolbar] ✨ Applying highlight...

[TTS Highlight] 🔆 highlightRange called, from: 0 to: 22
[TTS Highlight] 📤 Dispatching setHighlight effect...
[TTS Highlight] ✅ Highlight effect dispatched!

[TTS Toolbar] ✅ Successfully highlighted chunk: 1/5 (0-22)

[TTS] 🎯 Using preloaded audio for chunk 1  ← 无缝播放！
[TTS] ✅ Preloaded chunk 2
[TTS] ✅ Preloaded chunk 3
```

---

## 🔍 验证清单

### 高亮功能
- [ ] 第1句播放时，能看到紫色高亮
- [ ] 第2句开始时，高亮移动到第2句
- [ ] 第3句开始时，高亮移动到第3句
- [ ] 播放结束后，高亮消失
- [ ] 按 `Esc` 停止时，高亮立即消失

### 无缝播放
- [ ] 第1句播放完后，**立即**播放第2句（无停顿）
- [ ] 第2句播放完后，**立即**播放第3句（无停顿）
- [ ] 控制台显示"Using preloaded audio"
- [ ] 控制台显示"Preloaded chunk X"

### 对比 Aloud
- [ ] 播放流畅度与 Aloud 一致
- [ ] 高亮效果与 Aloud 类似（紫色背景）
- [ ] 没有句子之间的停顿

---

## ❌ 如果高亮不显示

### 调试步骤

#### 1. 检查控制台日志
```
问题 A：没有看到任何 [TTS Highlight] 日志
→ 高亮函数没有被调用
→ 检查 onChunkChange 是否触发

问题 B：看到 "❌ Cannot highlight - invalid state"
→ chunks 数组为空或索引无效
→ 检查 chunkText 是否正确

问题 C：看到 "Offsets out of range"
→ 偏移量超出文档长度
→ 检查偏移量计算逻辑
```

#### 2. 手动测试偏移量
在控制台输入：
```javascript
// 获取当前编辑器
const view = app.workspace.activeLeaf.view.editor.cm;

// 测试高亮
view.dispatch({
    effects: view.state.field(
        StateEffect.define().of({ from: 0, to: 10 })
    )
});
```

#### 3. 检查扩展是否加载
```javascript
// 检查 CodeMirror 扩展
console.log(app.workspace.activeLeaf.view.editor.cm.state.facet(EditorView.decorations));
```

---

## ❌ 如果播放仍有停顿

### 可能原因

#### 1. 缓存未命中
```
[TTS] ❌ Cache MISS  ← 每次都要从 API 获取
→ 解决：第一次播放会有停顿，第二次应该无停顿
```

#### 2. 预加载失败
```
[TTS] Failed to preload chunk X  ← 预加载失败
→ 解决：检查 API 速率限制或网络
```

#### 3. 等待 state change
```
await this.playCurrentChunk();  ← 有 await
→ 这是错误的！应该是：
this.playCurrentChunk();  ← 无 await，立即返回
```

---

## 📊 性能对比

### 之前（有停顿）
```
句子1: 2秒播放
[停顿 0.5-1秒] ← API 请求 + 加载
句子2: 2秒播放
[停顿 0.5-1秒]
句子3: 2秒播放
```
**总时间**: ~9秒（5句话）

### 现在（无停顿）
```
句子1: 2秒播放
[预加载句子2、3] ← 后台进行
句子2: 2秒播放 ← 使用预加载的音频
句子3: 2秒播放 ← 使用预加载的音频
句子4: 2秒播放
句子5: 2秒播放
```
**总时间**: ~10秒（5句话）- 但体验流畅！

---

## 🎯 关键改进

### 1. 预加载机制
```typescript
private async preloadNextChunks(): Promise<void> {
    const PRELOAD_COUNT = 2; // 提前加载2句
    
    for (let i = 1; i <= PRELOAD_COUNT; i++) {
        const nextIndex = this.currentChunkIndex + i;
        if (nextIndex < this.chunks.length) {
            // 后台加载，不阻塞
            this.fetchAudio(chunk.text).then(buffer => {
                this.preloadedAudio.set(nextIndex, buffer);
            });
        }
    }
}
```

### 2. 使用预加载音频
```typescript
// 优先使用预加载的音频
let audioBuffer = this.preloadedAudio.get(this.currentChunkIndex);
if (audioBuffer) {
    console.log('🎯 Using preloaded audio'); // 无延迟！
} else {
    audioBuffer = await this.fetchAudio(chunk.text); // 有延迟
}
```

### 3. 立即播放下一句
```typescript
// ❌ 错误（有停顿）
await this.playCurrentChunk();

// ✅ 正确（无停顿）
this.playCurrentChunk(); // Fire and forget
```

---

## 🎨 高亮样式

### CSS 类
```css
.tts-highlight-current {
    background-color: rgba(168, 85, 247, 0.3);  /* 紫色 */
    border-radius: 2px;
}
```

### 视觉效果
```
普通文本
╔══════════════════════════╗
║ This is sentence one.    ║  ← 紫色高亮
╚══════════════════════════╝
普通文本
```

---

## 📝 技术细节

### 偏移量系统（对齐 Aloud）
```typescript
// ✅ 现在：直接使用数字偏移量
interface TTSChunk {
    text: string;
    start: number;  // 0
    end: number;    // 22
}

// ❌ 之前：使用 EditorPosition（错误）
interface TTSChunk {
    text: string;
    start: {line: 0, ch: 0};
    end: {line: 0, ch: 22};
}
```

### CodeMirror 装饰器
```typescript
// StateField 管理装饰器状态
const highlightField = StateField.define<DecorationSet>({
    create() { return Decoration.none; },
    update(decorations, tr) {
        // 监听 setHighlight 效果
        for (const effect of tr.effects) {
            if (effect.is(setHighlight)) {
                // 创建高亮装饰器
                return Decoration.set([
                    Decoration.mark({class: 'tts-highlight-current'})
                        .range(from, to)
                ]);
            }
        }
    }
});
```

---

## 🎉 成功标准

### 高亮 ✅
- 紫色背景可见
- 随播放移动
- 播放结束消失

### 无缝播放 ✅
- 句子间无停顿
- 控制台显示预加载
- 流畅如 Aloud

### 性能 ✅
- 第二次播放更快（缓存）
- 预加载在后台进行
- 不影响播放流畅度

---

## 🚀 下一步

如果以上都正常：
1. ✅ **享受无缝 TTS 体验！**
2. ✅ **测试更长的文章**
3. ✅ **尝试不同的播放速度**
4. ✅ **使用键盘快捷键**

如果有问题：
1. 📋 **复制控制台日志**
2. 📸 **截图高亮效果（或无效果）**
3. 📝 **描述具体现象**

---

## 💡 提示

### 最佳实践
- 第一次播放可能略慢（需要获取音频）
- 第二次播放会很快（使用缓存）
- 长文章更能体现无缝播放的优势

### 快捷键
- `Ctrl + Space`: 播放/暂停
- `Ctrl + →`: 下一句（看高亮跳转）
- `Ctrl + ←`: 上一句
- `Esc`: 停止（高亮消失）

---

**祝测试顺利！如果一切正常，你现在拥有了比 Aloud 更好的 TTS 体验！** 🎊
