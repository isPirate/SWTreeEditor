# build-icon.ps1 — 把 icon.svg 的几何用 GDI+ 重绘成多尺寸 app.ico（原生 alpha 透明）
# 用法：pwsh -ExecutionPolicy Bypass -File .\build-icon.ps1
Add-Type -AssemblyName System.Drawing

function Get-RoundedRectPath([double]$x, [double]$y, [double]$w, [double]$h, [double]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2.0 * $r
  if ($d -gt $w) { $d = $w }
  if ($d -gt $h) { $d = $h }
  $rr = $d / 2.0
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

# 几何来自 icon.svg（256 坐标系）
$bg     = @{ x=8;   y=8;   w=240; h=240; r=52 }  # 蓝色底板
$root   = @{ x=48;  y=62;  w=160; h=48;  r=16 }
$stem   = @{ x=118; y=110; w=20;  h=20;  r=0 }
$branch = @{ x=48;  y=130; w=160; h=16;  r=6 }
$leftC  = @{ x=48;  y=146; w=68;  h=48;  r=14 }
$rightC = @{ x=140; y=146; w=68;  h=48;  r=14 }

function Draw-Icon([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap -ArgumentList $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::Transparent)
  $s = $size / 256.0
  $blue  = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::FromArgb(255,37,99,235))
  $white = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::FromArgb(255,255,255,255))

  $g.FillPath($blue,  (Get-RoundedRectPath ($bg.x*$s)     ($bg.y*$s)     ($bg.w*$s)     ($bg.h*$s)     ($bg.r*$s)))
  $g.FillPath($white, (Get-RoundedRectPath ($root.x*$s)   ($root.y*$s)   ($root.w*$s)   ($root.h*$s)   ($root.r*$s)))
  $g.FillRectangle($white, [float]($stem.x*$s), [float]($stem.y*$s), [float]($stem.w*$s), [float]($stem.h*$s))
  $g.FillPath($white, (Get-RoundedRectPath ($branch.x*$s) ($branch.y*$s) ($branch.w*$s) ($branch.h*$s) ($branch.r*$s)))
  $g.FillPath($white, (Get-RoundedRectPath ($leftC.x*$s)  ($leftC.y*$s)  ($leftC.w*$s)  ($leftC.h*$s)  ($leftC.r*$s)))
  $g.FillPath($white, (Get-RoundedRectPath ($rightC.x*$s) ($rightC.y*$s) ($rightC.w*$s) ($rightC.h*$s) ($rightC.r*$s)))

  $g.Dispose(); $blue.Dispose(); $white.Dispose()
  return $bmp
}

function Bmp-ToPngBytes($bmp) {
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  return $ms.ToArray()
}

$sizes = 256, 48, 32, 16
$entries = @()
foreach ($sz in $sizes) {
  $bmp = Draw-Icon $sz
  $png = Bmp-ToPngBytes $bmp
  $bmp.Dispose()
  $entries += [pscustomobject]@{ size = $sz; png = $png }
}

# 组装 ICO：ICONDIR(6) + ICONDIRENTRY(16*n) + PNG 数据
$n = $entries.Count
$out = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter -ArgumentList $out
$bw.Write([uint16]0)        # reserved
$bw.Write([uint16]1)        # type = ICO
$bw.Write([uint16]$n)       # 图片数量
$offset = 6 + 16 * $n
foreach ($e in $entries) {
  $dim = if ($e.size -ge 256) { [byte]0 } else { [byte]$e.size }
  $bw.Write([byte]$dim)             # 宽（0 => 256）
  $bw.Write([byte]$dim)             # 高
  $bw.Write([byte]0)                # 调色板色数
  $bw.Write([byte]0)                # 保留
  $bw.Write([uint16]1)              # 颜色平面数
  $bw.Write([uint16]32)             # 每像素位数
  $bw.Write([uint32]$e.png.Length)  # 图片大小
  $bw.Write([uint32]$offset)        # 图片偏移
  $offset += $e.png.Length
}
foreach ($e in $entries) { $bw.Write([byte[]]$e.png, 0, $e.png.Length) }

$icoPath = Join-Path $PSScriptRoot 'app.ico'
[System.IO.File]::WriteAllBytes($icoPath, $out.ToArray())
Write-Output ("已生成 app.ico ({0} 字节，尺寸 {1}) -> {2}" -f $out.ToArray().Length, ($sizes -join ','), $icoPath)
