# OB English Learner Release Packaging Script
# Version: 1.4.0

param(
    [string]$Version = "1.4.0"
)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "OB English Learner Release Packager" -ForegroundColor Cyan
Write-Host "Version: $Version" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Output directory
$OutputDir = "releases"
$ReleaseDir = "$OutputDir\ob-english-learner-$Version"
$ZipFile = "$OutputDir\ob-english-learner-$Version.zip"

Write-Host "📦 Step 1: Creating release directory..." -ForegroundColor Yellow
if (Test-Path $OutputDir) {
    Write-Host "   Cleaning old releases..." -ForegroundColor Gray
    Remove-Item "$OutputDir\*" -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null
Write-Host "   ✅ Release directory created: $ReleaseDir" -ForegroundColor Green
Write-Host ""

Write-Host "📋 Step 2: Copying required files..." -ForegroundColor Yellow

# Required files for plugin
$RequiredFiles = @(
    "main.js",
    "manifest.json",
    "styles.css"
)

foreach ($file in $RequiredFiles) {
    if (Test-Path $file) {
        Copy-Item $file -Destination $ReleaseDir
        $size = (Get-Item $file).Length
        $sizeKB = [math]::Round($size / 1KB, 2)
        Write-Host "   ✅ $file ($sizeKB KB)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Missing: $file" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

Write-Host "📄 Step 3: Copying documentation..." -ForegroundColor Yellow

# Documentation files (optional but recommended)
$DocFiles = @(
    "README.md",
    "CHANGELOG.md",
    "首次使用必读.md"
)

foreach ($file in $DocFiles) {
    if (Test-Path $file) {
        Copy-Item $file -Destination $ReleaseDir
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Optional: $file (not found)" -ForegroundColor DarkYellow
    }
}
Write-Host ""

Write-Host "🔍 Step 4: Verifying manifest version..." -ForegroundColor Yellow
$manifestPath = "$ReleaseDir\manifest.json"
$manifest = Get-Content $manifestPath | ConvertFrom-Json
$manifestVersion = $manifest.version

if ($manifestVersion -eq $Version) {
    Write-Host "   ✅ Version matched: $manifestVersion" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Version mismatch!" -ForegroundColor Red
    Write-Host "      Expected: $Version" -ForegroundColor Red
    Write-Host "      Found: $manifestVersion" -ForegroundColor Red
    $continue = Read-Host "   Continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
}
Write-Host ""

Write-Host "🗜️  Step 5: Creating ZIP archive..." -ForegroundColor Yellow
if (Test-Path $ZipFile) {
    Remove-Item $ZipFile -Force
}

# Create ZIP using PowerShell 5.0+ built-in cmdlet
Compress-Archive -Path "$ReleaseDir\*" -DestinationPath $ZipFile -Force

if (Test-Path $ZipFile) {
    $zipSize = (Get-Item $ZipFile).Length
    $zipSizeKB = [math]::Round($zipSize / 1KB, 2)
    Write-Host "   ✅ ZIP created: $ZipFile ($zipSizeKB KB)" -ForegroundColor Green
} else {
    Write-Host "   ❌ Failed to create ZIP" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "📊 Step 6: Release summary..." -ForegroundColor Yellow
Write-Host "   Plugin: OB English Learner" -ForegroundColor Cyan
Write-Host "   Version: $manifestVersion" -ForegroundColor Cyan
Write-Host "   Files included:" -ForegroundColor Cyan

Get-ChildItem $ReleaseDir | ForEach-Object {
    $fileSize = [math]::Round($_.Length / 1KB, 2)
    Write-Host "     - $($_.Name) ($fileSize KB)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "   Total package size: $zipSizeKB KB" -ForegroundColor Cyan
Write-Host ""

Write-Host "==================================" -ForegroundColor Green
Write-Host "✅ Release package created successfully!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Release file: $ZipFile" -ForegroundColor White
Write-Host "📂 Extracted folder: $ReleaseDir" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test the release by copying to Obsidian plugins folder" -ForegroundColor White
Write-Host "  2. Create GitHub release with $ZipFile" -ForegroundColor White
Write-Host "  3. Update version in manifest.json for next release" -ForegroundColor White
Write-Host ""
