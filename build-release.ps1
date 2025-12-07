# OB English Learner - Release Build Script
# 完整的 release 打包流程

Write-Host "🚀 Starting Release Build Process..." -ForegroundColor Cyan
Write-Host ""

# 1. 清理旧的构建文件
Write-Host "📦 Step 1: Cleaning old build files..." -ForegroundColor Yellow
if (Test-Path "main.js") { Remove-Item "main.js" -Force }
if (Test-Path "styles.css") { Remove-Item "styles.css" -Force }
if (Test-Path "release") { Remove-Item "release" -Recurse -Force }
Write-Host "✅ Cleaned" -ForegroundColor Green
Write-Host ""

# 2. 运行 TypeScript 类型检查
Write-Host "📝 Step 2: Running TypeScript type check..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build successful" -ForegroundColor Green
Write-Host ""

# 3. 读取版本信息
Write-Host "📋 Step 3: Reading version info..." -ForegroundColor Yellow
$manifest = Get-Content "manifest.json" | ConvertFrom-Json
$version = $manifest.version
Write-Host "   Version: $version" -ForegroundColor Cyan
Write-Host "   Name: $($manifest.name)" -ForegroundColor Cyan
Write-Host "✅ Version info loaded" -ForegroundColor Green
Write-Host ""

# 4. 创建 release 目录
Write-Host "📁 Step 4: Creating release directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "release" | Out-Null
Write-Host "✅ Directory created" -ForegroundColor Green
Write-Host ""

# 5. 复制必要文件到 release 目录
Write-Host "📄 Step 5: Copying files to release..." -ForegroundColor Yellow
Copy-Item "main.js" "release/main.js"
Copy-Item "manifest.json" "release/manifest.json"
if (Test-Path "styles.css") {
    Copy-Item "styles.css" "release/styles.css"
}
Write-Host "✅ Files copied" -ForegroundColor Green
Write-Host ""

# 6. 创建 ZIP 文件
Write-Host "🗜️  Step 6: Creating release ZIP..." -ForegroundColor Yellow
$zipName = "ob-english-learner-$version.zip"
if (Test-Path $zipName) { Remove-Item $zipName -Force }
Compress-Archive -Path "release/*" -DestinationPath $zipName
Write-Host "✅ ZIP created: $zipName" -ForegroundColor Green
Write-Host ""

# 7. 显示文件大小
Write-Host "📊 Step 7: File sizes..." -ForegroundColor Yellow
$mainSize = (Get-Item "main.js").Length / 1KB
$zipSize = (Get-Item $zipName).Length / 1KB
Write-Host "   main.js: $([math]::Round($mainSize, 2)) KB" -ForegroundColor Cyan
Write-Host "   $zipName`: $([math]::Round($zipSize, 2)) KB" -ForegroundColor Cyan
Write-Host "✅ Size check complete" -ForegroundColor Green
Write-Host ""

# 8. 生成 Release Notes
Write-Host "📝 Step 8: Generating release notes..." -ForegroundColor Yellow
$releaseNotes = @"
# OB English Learner v$version

## 🎉 Features

### 🔊 TTS (Text-to-Speech)
- ✅ 100% 对齐 Aloud 插件的 UI 和功能
- ✅ 完美的文本高亮（紫色背景 + 紫色文字）
- ✅ 无缝播放（预加载机制，句子间无停顿）
- ✅ 自动滚动（智能跟随当前播放位置）
- ✅ 5 组按钮布局（Play | Previous/Pause/Next | Eye/Speed | Status | Close）
- ✅ 动态 Pause/Resume 按钮（图标自动切换）
- ✅ 实时进度条（底部蓝色细线）
- ✅ 音频可视化器（8 条跳动的竖条）
- ✅ 本地缓存（IndexedDB，减少 API 调用）

### ⌨️ 键盘快捷键
- \`Ctrl+Space\`: 播放/暂停
- \`Ctrl+→\`: 下一句
- \`Ctrl+←\`: 上一句
- \`Ctrl+↑\`: 加速
- \`Ctrl+↓\`: 减速
- \`Esc\`: 停止

### 🎙️ 语音识别
- YouTube 字幕自动获取
- 音频转文本
- SRT 字幕生成

### 🔧 TTS 提供商支持
- OpenAI TTS
- Azure TTS（完整的 Region + Voice 自动加载）
- ElevenLabs

### 📤 导出功能
- 导出为音频文件
- 粘贴文本为音频
- Aloud 风格的文件名生成

## 📦 Installation

1. 下载 \`ob-english-learner-$version.zip\`
2. 解压到 Obsidian vault 的 \`.obsidian/plugins/ob-english-learner/\` 目录
3. 重启 Obsidian
4. 在设置中启用插件
5. 配置 TTS API Key

## 🎯 Usage

### 基础播放
1. 选中文本
2. 按 \`Ctrl+Space\` 或点击工具栏的 Play 按钮
3. 享受完美的 TTS 体验！

### 自动滚动
- 点击工具栏的眼睛图标切换自动滚动
- 默认开启，播放时自动跟随当前句子

### 速度调整
- 点击工具栏的速度按钮循环速度
- 或使用 \`Ctrl+↑/↓\` 快捷键

## 🐛 Bug Fixes

- ✅ 修复高亮不显示问题（CSS 优先级）
- ✅ 修复自动滚动跳到最前面问题（延迟确认机制）
- ✅ 修复 Pause/Resume 图标不切换问题
- ✅ 修复播放时有停顿问题（预加载机制）

## 📝 Notes

- 需要配置 TTS API Key（OpenAI/Azure/ElevenLabs）
- 首次播放需要从 API 获取音频（稍慢）
- 第二次播放使用缓存（很快）
- 完全对齐 Aloud 插件的体验

## 🙏 Credits

Inspired by [Aloud TTS](https://github.com/adrianlyjak/obsidian-aloud-tts)

---

**Enjoy your perfect TTS experience!** 🎉✨
"@

Set-Content -Path "RELEASE_NOTES.md" -Value $releaseNotes
Write-Host "✅ Release notes generated" -ForegroundColor Green
Write-Host ""

# 9. 显示发布信息
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🎉 Release Build Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 Release Package:" -ForegroundColor Yellow
Write-Host "   $zipName" -ForegroundColor White
Write-Host ""
Write-Host "📋 Files included:" -ForegroundColor Yellow
Write-Host "   - main.js ($([math]::Round($mainSize, 2)) KB)" -ForegroundColor White
Write-Host "   - manifest.json" -ForegroundColor White
if (Test-Path "release/styles.css") {
    Write-Host "   - styles.css" -ForegroundColor White
}
Write-Host ""
Write-Host "📝 Release notes:" -ForegroundColor Yellow
Write-Host "   RELEASE_NOTES.md" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Test the plugin in Obsidian" -ForegroundColor White
Write-Host "   2. Create a GitHub release" -ForegroundColor White
Write-Host "   3. Upload $zipName" -ForegroundColor White
Write-Host "   4. Copy RELEASE_NOTES.md content" -ForegroundColor White
Write-Host ""
Write-Host "Happy releasing!" -ForegroundColor Cyan
