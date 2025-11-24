# Cover 格式修复

## ✅ 修复内容

### 正确的 Cover 格式

Cover 属性应该使用简单的文件名链接，而不是包含文件夹路径。

**错误格式** ❌：
```yaml
cover: "[[How To Order Coffee In English/How To Order Coffee In English.jpg]]"
```

**正确格式** ✅：
```yaml
cover: "[[How To Order Coffee In English.jpg]]"
```

## 🔧 修改说明

### 文件保存位置
图片保存在视频文件夹内：
```
Languages/Videos/How To Order Coffee In English/
├── How To Order Coffee In English.md     ← 笔记
├── How To Order Coffee In English.jpg    ← 封面图片
└── Subtitles/
    ├── How To Order Coffee In English - EN.srt
    └── How To Order Coffee In English - ZH.srt
```

### Wikilink 格式
因为笔记和图片在同一文件夹，所以使用简单的文件名链接即可：
```yaml
cover: "[[How To Order Coffee In English.jpg]]"
```

Obsidian 会自动在同一文件夹中查找该文件。

## 📊 代码修改

**修改前**：
```typescript
return `${fileName}/${imageFileName}`; // "VideoName/VideoName.jpg"
```

**修改后**：
```typescript
return imageFileName; // "VideoName.jpg"
```

## 🎯 效果

### Frontmatter 显示
```yaml
cover: "[[How To Order Coffee In English.jpg]]"
```

### 属性面板
- ✅ 正确显示封面预览
- ✅ 无警告图标
- ✅ 点击可跳转到图片

### 在笔记中引用
如果要在笔记正文中嵌入封面：
```markdown
![[How To Order Coffee In English.jpg]]
```

## 🚀 验证步骤

1. 重启 Obsidian
2. 删除旧的笔记（可选）
3. 重新导入视频
4. 检查 Frontmatter：
   ```yaml
   cover: "[[VideoName.jpg]]"
   ```
5. 在属性面板中查看封面预览

## 📝 技术说明

### Obsidian Wikilink 解析规则
- `[[filename.jpg]]` - 在当前文件夹或整个 vault 中搜索
- `[[folder/filename.jpg]]` - 指定完整路径

因为笔记和图片在同一文件夹，使用简单格式更清晰。

### 向后兼容
- 旧笔记仍然可用（Obsidian 支持两种格式）
- 新导入的笔记使用简化格式
- 更新模式会保持现有格式

---

**修复日期**: 2024-11-24
**影响**: Cover 属性显示格式
