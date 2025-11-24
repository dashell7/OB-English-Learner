# Bug 修复：Cover 属性 & AI 格式化

## 📋 修复内容

### 问题 1: Cover 属性值格式错误 ✅

**症状**：
```yaml
# 错误的格式
cover: [["How To Order Coffee In English.jpg"]]
```

**原因**：
- `downloadThumbnail` 只返回了文件名，没有包含文件夹路径
- 应该返回相对路径：`VideoName/VideoName.jpg`

**修复**：
```typescript
// 修改前
return imageFileName; // "How To Order Coffee In English.jpg"

// 修改后
return `${fileName}/${imageFileName}`; // "How To Order Coffee In English/How To Order Coffee In English.jpg"
```

**正确格式**：
```yaml
cover: "[[How To Order Coffee In English/How To Order Coffee In English.jpg]]"
```

### 问题 2: AI 格式化没有生效 ✅

**症状**：
- 转录文本分段太长
- 没有标点符号
- 看起来像这样：
```
hey guys it's arianita lagringa and welcome back to my YouTube channel can you guys 
guess where I'm at today today I'm at Starbucks and as you can see behind me...
```

**原因**：
- 更新模式下，AI 格式化被跳过（`!isUpdate` 条件）
- 即使是新导入也可能没有生效

**修复**：
```typescript
// 修改前
if (this.settings.enableAIFormatting && this.settings.aiApiKey && !isUpdate) {

// 修改后
if (this.settings.enableAIFormatting && this.settings.aiApiKey) {
```

**正确效果**：
```
Hey guys, it's Arianita Lagringa, and welcome back to my YouTube channel. Can you 
guys guess where I'm at today? Today I'm at Starbucks!

And as you can see behind me, you can see the beautiful Starbucks logo...
```

## 🔧 附加改进

### 1. 添加 URL 字段到 VideoMetadata
```typescript
export interface VideoMetadata {
    videoId: string;
    title: string;
    // ...
    url?: string;  // ← 新增：支持存储原始 URL
}
```

### 2. URL 在 Scraper 中设置
```typescript
// YouTube Scraper
metadata.url = url;

// Bilibili Scraper
metadata.url = url;
```

### 3. Generator 使用正确的 URL
```typescript
// 修改前
.replace(/{{url}}/g, `https://youtu.be/${metadata.videoId}`)

// 修改后
.replace(/{{url}}/g, metadata.url || `https://youtu.be/${metadata.videoId}`)
```

现在支持 Bilibili 和其他平台的正确 URL！

## 📊 修复前后对比

### Cover 属性

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| 返回值 | `"Video.jpg"` | `"VideoFolder/Video.jpg"` |
| Frontmatter | `cover: [["Video.jpg"]]` ❌ | `cover: "[[VideoFolder/Video.jpg]]"` ✅ |
| Obsidian 显示 | 警告图标 ⚠️ | 正常显示 ✅ |

### AI 格式化

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| 首次导入 | 可能不生效 ❌ | 正常格式化 ✅ |
| 更新模式 | 跳过格式化 ❌ | 正常格式化 ✅ |
| 标点符号 | 无 | 有 ✅ |
| 段落分隔 | 太长 | 智能分段 ✅ |

## 🚀 如何验证修复

### 测试 Cover 属性

1. 删除旧笔记（如果有）
2. 重新导入相同视频
3. 检查笔记的 Frontmatter：
   ```yaml
   cover: "[[VideoName/VideoName.jpg]]"
   ```
4. 在属性面板中应该正常显示，无警告

### 测试 AI 格式化

**前提条件**：
- 确保在设置中启用了 "Enable AI Text Formatting"
- 配置了有效的 API Key

**测试步骤**：
1. 导入一个 YouTube 视频
2. 等待处理完成
3. 打开生成的笔记
4. 检查 `^^^article` 部分的文本

**预期结果**：
```markdown
Hey guys, it's Arianita Lagringa, and welcome back to my YouTube channel. Can you 
guys guess where I'm at today?

Today I'm at Starbucks! And as you can see behind me, you can see the beautiful 
Starbucks logo that they have. This logo is famous worldwide.

You all might be wondering, "Arianita, why are you at Starbucks?" Well, today I'm at 
Starbucks because I want to teach you guys some coffee vocabulary...
```

**控制台日志**：
```
[LinguaSync] AI formatting enabled, processing transcript...
[LinguaSync] Starting AI text formatting (punctuation & paragraphs)...
[LinguaSync] Formatting 3 text chunks...
[LinguaSync] Formatting chunk 1/3...
[LinguaSync] ✅ Text formatting completed!
[LinguaSync] Using AI-formatted transcript with punctuation
```

## 🔍 故障排除

### Cover 仍然显示警告

**可能原因**：
- 旧的模板缓存
- 文件路径不正确

**解决方案**：
1. 重启 Obsidian
2. 删除旧笔记和文件夹
3. 重新导入视频

### AI 格式化仍然不生效

**检查清单**：
- [ ] 是否启用了 "Enable AI Text Formatting" 开关？
- [ ] API Key 是否有效？
- [ ] 检查控制台是否有错误？
- [ ] API 额度是否充足？

**调试步骤**：
1. 打开开发者工具（Ctrl+Shift+I）
2. 查看 Console 标签页
3. 搜索 `[LinguaSync]` 日志
4. 检查是否有错误消息

**常见错误**：
```
[LinguaSync] AI formatting enabled, processing transcript...
[LinguaSync] Formatting error: API key invalid
→ 解决：检查 API Key 是否正确

[LinguaSync] Formatting error: insufficient quota
→ 解决：充值 API 额度

[LinguaSync] Formatting error: network timeout
→ 解决：检查网络连接
```

## 📝 相关文件

修改的文件列表：

1. **src/types.ts**
   - 添加 `url?: string;` 到 `VideoMetadata`

2. **src/scraper.ts**
   - 在返回前设置 `metadata.url = url;`

3. **src/bilibili-scraper.ts**
   - 在返回前设置 `metadata.url = url;`

4. **src/generator.ts**
   - 修改 `downloadThumbnail` 返回相对路径
   - 移除 AI 格式化的 `!isUpdate` 限制
   - 修改 URL 替换逻辑

## ✨ 未来改进

可能的进一步优化：

- [ ] 支持自定义封面文件夹路径
- [ ] 支持不同的封面图片格式（png, webp）
- [ ] AI 格式化添加进度提示
- [ ] 支持批量重新格式化已导入的笔记
- [ ] 添加格式化预览功能

---

**修复版本**: 2024-11-24
**影响范围**: Cover 属性显示、AI 文本格式化
**向后兼容**: 是（旧笔记不受影响）
