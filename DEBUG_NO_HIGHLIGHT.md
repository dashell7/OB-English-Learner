# 🔍 调试：没有高亮问题

## 📋 问题描述
工具栏正常显示，但播放时文本没有高亮。

---

## 🧪 调试步骤

### 步骤 1: 重启 Obsidian
```bash
Ctrl + R
```

### 步骤 2: 打开控制台
```bash
F12 → Console 标签
```

### 步骤 3: 清空控制台
```bash
点击 🚫 清空按钮
```

### 步骤 4: 开始播放
```bash
1. 选中一段文本
2. Ctrl + Space 开始播放
```

---

## 🔍 检查控制台日志

### 必须看到的日志（按顺序）

#### 1. TTSManager 创建 chunks
```
[TTSManager] Created X chunks
[TTSManager] Chunk 0: { start: 0, end: 25, text: "..." }
```
**如果没有看到**：chunking 逻辑有问题

#### 2. 高亮函数被调用
```
[TTS Toolbar] 🎯 highlightCurrentChunk called, currentChunk: 0
[TTS Toolbar] 🔍 View object: exists
[TTS Toolbar] 🔍 View.state: exists
[TTS Toolbar] 🔍 Doc length: 1234
```
**如果没有看到**：监听器没有触发

#### 3. Chunk 信息
```
[TTS Toolbar] 📍 Highlight offsets: 0 - 25 text: Welcome to cedar Cedar...
[TTS Toolbar] 📍 Chunk object: {
  "start": 0,
  "end": 25,
  "text": "Welcome to cedar Cedar Gathering 2025."
}
```
**如果没有看到**：chunk 数据有问题

#### 4. 高亮范围函数
```
[TTS Highlight] 🔆 highlightRange called, from: 0 to: 25
[TTS Highlight] 📤 Dispatching setHighlight effect...
[TTS Highlight] ✅ Highlight effect dispatched!
```
**如果没有看到**：highlightRange 没有被调用

#### 5. 工具栏确认
```
[TTS Toolbar] ✅ Successfully highlighted chunk: 1/5 (0-25)
```

---

## ❌ 常见问题诊断

### 问题 A: 没有看到任何 highlightCurrentChunk 日志
**原因**：监听器没有注册或没有触发

**检查**：
```
1. 查找日志：[TTS Toolbar] Initializing Aloud-style toolbar
2. 如果没有，说明扩展没有加载
3. 检查 main.ts 中的 registerEditorExtension
```

**解决**：
```typescript
// 确认 main.ts 中有这行
this.registerEditorExtension(ttsPanelExtension(this.ttsManager));
```

---

### 问题 B: View object: NULL
**原因**：EditorView 对象丢失

**检查**：
```
[TTS Toolbar] 🔍 View object: NULL  ← 问题！
```

**解决**：
```typescript
// 在 TTSToolbarView 构造函数中
console.log('[TTS Toolbar] View in constructor:', this.view);
```

---

### 问题 C: Chunk start/end 都是 0
**原因**：chunking 逻辑计算偏移量错误

**检查**：
```
[TTS Toolbar] 📍 Chunk object: {
  "start": 0,
  "end": 0,  ← 问题！
  "text": "..."
}
```

**解决**：检查 `tts-manager.ts` 中的 chunking 逻辑

---

### 问题 D: highlightRange 被调用但没有效果
**原因**：CodeMirror 扩展没有正确注册

**检查**：
```
[TTS Highlight] ✅ Highlight effect dispatched!  ← 看到这个
但是没有高亮显示  ← 问题！
```

**解决**：
```typescript
// 检查 ttsPanelExtension 是否返回了 highlightExtension
export function ttsPanelExtension(ttsManager: TTSManager): Extension {
    const toolbarPlugin = ViewPlugin.define(...);
    const highlightExtension = createTTSHighlightExtension();  ← 必须有
    
    return [
        toolbarPlugin,
        highlightExtension  ← 必须返回
    ];
}
```

---

### 问题 E: RangeError: Mark decorations may not be empty
**原因**：from === to（空范围）

**检查**：
```
RangeError: Mark decorations may not be empty
```

**解决**：
```typescript
// 在 highlightRange 中已有检查
if (from >= to) {
    console.warn('[TTS Highlight] ❌ Invalid range:', from, to);
    return;
}
```

---

## 🔧 手动测试高亮

### 在控制台直接测试

```javascript
// 1. 获取 EditorView
const view = app.workspace.activeEditor?.editor?.cm;
console.log('View:', view);

// 2. 获取文档长度
console.log('Doc length:', view.state.doc.length);

// 3. 手动触发高亮（测试 0-50 字符）
view.dispatch({
    effects: view.state.field(/* highlightField */).of({ from: 0, to: 50 })
});
```

**如果手动测试有效**：说明高亮逻辑正常，问题在监听器或数据传递

**如果手动测试无效**：说明高亮扩展没有正确注册

---

## 🎯 完整日志示例（正常情况）

```
[TTS Toolbar] Initializing Aloud-style toolbar
[TTS Toolbar] Aloud-style toolbar created with button groups

// 用户按 Ctrl+Space
[TTSManager] Created 5 chunks
[TTSManager] Chunk 0: { start: 0, end: 38, text: "Welcome to cedar Cedar Gathering 2025." }
[TTSManager] Chunk 1: { start: 39, end: 104, text: "It's my third year." }
...

[TTS Toolbar] 🎯 highlightCurrentChunk called, currentChunk: 0
[TTS Toolbar] 🔍 View object: exists
[TTS Toolbar] 🔍 View.state: exists
[TTS Toolbar] 🔍 Doc length: 2847
[TTS Toolbar] 📍 Highlight offsets: 0 - 38 text: Welcome to cedar Cedar Gatherin
[TTS Toolbar] 📍 Chunk object: {
  "start": 0,
  "end": 38,
  "text": "Welcome to cedar Cedar Gathering 2025."
}

[TTS Highlight] 🔆 highlightRange called, from: 0 to: 38
[TTS Highlight] 📤 Dispatching setHighlight effect...
[TTS Highlight] ✅ Highlight effect dispatched!

[TTS Toolbar] ✅ Successfully highlighted chunk: 1/5 (0-38)
```

---

## 📸 请提供以下信息

如果问题仍然存在，请截图：

1. **控制台完整日志**
   - 从按 Ctrl+Space 开始
   - 到播放开始的所有日志

2. **工具栏状态**
   - 工具栏是否显示
   - 按钮状态如何

3. **文本内容**
   - 播放的文本内容
   - 文本长度

---

## 🔍 关键检查点

- [ ] 控制台看到 `[TTS Toolbar] Initializing`
- [ ] 控制台看到 `[TTSManager] Created X chunks`
- [ ] 控制台看到 `highlightCurrentChunk called`
- [ ] 控制台看到 `View object: exists`
- [ ] 控制台看到 `highlightRange called`
- [ ] 控制台看到 `Highlight effect dispatched`
- [ ] Chunk 的 start/end 不是 0
- [ ] 没有 RangeError
- [ ] 工具栏正常显示

---

**重启 Obsidian (Ctrl+R)，按照步骤检查控制台日志！** 🔍
