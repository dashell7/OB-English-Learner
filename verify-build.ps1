# Verify Build Script - Check if features are included

Write-Host "🔍 Verifying Build..." -ForegroundColor Cyan
Write-Host ""

# Check if main.js exists
if (!(Test-Path "main.js")) {
    Write-Host "❌ main.js not found!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ main.js found" -ForegroundColor Green

# Get file size
$size = (Get-Item "main.js").Length / 1KB
Write-Host "   Size: $([math]::Round($size, 2)) KB" -ForegroundColor Cyan
Write-Host ""

# Check for key features
Write-Host "📋 Checking for key features..." -ForegroundColor Yellow
Write-Host ""

$content = Get-Content "main.js" -Raw

# Feature checks
$features = @{
    "recordOnlyMode" = "Record Only Mode"
    "voice2text-modal-container" = "Recording UI Styles"
    "ttsAutoscroll" = "TTS Autoscroll"
    "tts-toolbar-player" = "TTS Toolbar"
    "highlightRange" = "Text Highlight"
}

$allFound = $true

foreach ($feature in $features.GetEnumerator()) {
    $key = $feature.Key
    $desc = $feature.Value
    
    if ($content -match [regex]::Escape($key)) {
        Write-Host "✅ $desc ($key)" -ForegroundColor Green
    } else {
        Write-Host "❌ $desc ($key) NOT FOUND!" -ForegroundColor Red
        $allFound = $false
    }
}

Write-Host ""

if ($allFound) {
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
    Write-Host "✅ All features verified successfully!" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "📦 Build is ready for release!" -ForegroundColor Cyan
} else {
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Red
    Write-Host "❌ Some features are missing!" -ForegroundColor Red
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Red
    Write-Host ""
    Write-Host "⚠️ Please rebuild the project" -ForegroundColor Yellow
    exit 1
}
