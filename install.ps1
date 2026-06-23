# install.ps1 — 构建 SW 元模型结构树编辑器单文件 + 安装 + 创建桌面快捷方式（应用窗口模式）
# 用法：在项目根目录运行  powershell -ExecutionPolicy Bypass -File .\install.ps1
# 可重复运行：每次改完 index.html / core.js 后重跑，刷新已安装的副本和快捷方式。
$ErrorActionPreference = 'Stop'
$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

# ---- 1. 构建单文件 dist/index.html（把 core.js 内联进去）----
$corePath = Join-Path $root 'core.js'
$htmlPath = Join-Path $root 'index.html'
if (-not (Test-Path $corePath)) { throw "找不到 core.js：$corePath" }
if (-not (Test-Path $htmlPath)) { throw "找不到 index.html：$htmlPath" }
$core = [System.IO.File]::ReadAllText($corePath, [System.Text.Encoding]::UTF8)
$html = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)
$distDir = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
$built = $html.Replace('<script src="core.js"></script>', "<script>`r`n$core`r`n</script>")
[System.IO.File]::WriteAllText((Join-Path $distDir 'index.html'), $built, (New-Object System.Text.UTF8Encoding $false))
Write-Output "[1/4] 已构建 dist\index.html"

# ---- 2. 安装到稳定目录（不依赖项目文件夹位置）----
$appDir = Join-Path $env:LOCALAPPDATA 'SWTreeEditor'
New-Item -ItemType Directory -Force -Path $appDir | Out-Null
$appFile = Join-Path $appDir 'index.html'
Copy-Item (Join-Path $distDir 'index.html') $appFile -Force
# 复制品牌图标（若已通过 build-icon.ps1 生成）
$iconDst = $null
$iconSrc = Join-Path $root 'app.ico'
if (Test-Path $iconSrc) {
  $iconDst = Join-Path $appDir 'app.ico'
  Copy-Item $iconSrc $iconDst -Force
}
Write-Output "[2/4] 已安装到: $appFile$(if ($iconDst) { '（含品牌图标）' })"

# ---- 3. 检测浏览器（优先 Edge，回退 Chrome）----
$candidates = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw '未找到 Microsoft Edge 或 Google Chrome，请先安装其中之一。' }
$browserName = if ($browser -match 'msedge') { 'Microsoft Edge' } else { 'Google Chrome' }
Write-Output "[3/4] 使用浏览器: $browserName"

# ---- 4. 创建桌面快捷方式（--app 应用窗口模式：独立窗口、无地址栏/标签页）----
$fileUrl = 'file:///' + ($appFile -replace '\\', '/')
$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'SW 元模型结构树编辑器.lnk'
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnkPath)
$sc.TargetPath = $browser
$sc.Arguments = "--app=$fileUrl --window-size=1100,780"
$sc.IconLocation = if ($iconDst) { $iconDst } else { $browser }   # 有品牌图标用品牌图标，否则用浏览器图标
$sc.Description = 'SystemWeaver 元模型结构树编辑器'
$sc.WindowStyle = 1
$sc.Save()
Write-Output "[4/4] 已创建桌面快捷方式: $lnkPath"

Write-Output ""
Write-Output "完成。双击桌面「SW 元模型结构树编辑器」即可在独立窗口中打开使用。"
Write-Output "（改了代码后，重跑本脚本即可刷新已安装的副本与快捷方式）"
