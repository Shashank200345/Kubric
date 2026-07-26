# Redacts PII (account email / username) from the docs screenshots by
# pixelating a rectangular region. Originals are backed up once to
# public/docs/_original/ so the redaction can be re-run or reverted.
#
# Usage:
#   powershell -File scripts/redact-docs-shots.ps1
#   powershell -File scripts/redact-docs-shots.ps1 -Restore

param(
  [switch]$Restore,
  # Region to redact, as fractions of image width/height.
  # Defaults target the bottom-left sidebar account block.
  [double]$XFrac = 0.0,
  [double]$YFrac = 0.915,
  [double]$WFrac = 0.155,
  [double]$HFrac = 0.085,
  [int]$Block = 12,
  [string[]]$Only
)

Add-Type -AssemblyName System.Drawing

$docsDir  = Join-Path $PSScriptRoot '..\public\docs'
$docsDir  = (Resolve-Path $docsDir).Path
$backupDir = Join-Path $docsDir '_original'

if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }

if ($Restore) {
  Get-ChildItem (Join-Path $backupDir '*.png') | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $docsDir $_.Name) -Force
    Write-Output "restored $($_.Name)"
  }
  return
}

$targets = Get-ChildItem (Join-Path $docsDir '*.png')
if ($Only) { $targets = $targets | Where-Object { $Only -contains $_.Name } }

foreach ($file in $targets) {
  # Back up the pristine original exactly once.
  $backup = Join-Path $backupDir $file.Name
  if (-not (Test-Path $backup)) { Copy-Item $file.FullName $backup }

  # Always redact from the original so re-runs don't stack blurs.
  $src = [System.Drawing.Image]::FromFile($backup)
  $bmp = New-Object System.Drawing.Bitmap $src
  $src.Dispose()

  $x = [int]([math]::Floor($bmp.Width  * $XFrac))
  $y = [int]([math]::Floor($bmp.Height * $YFrac))
  $w = [int]([math]::Floor($bmp.Width  * $WFrac))
  $h = [int]([math]::Floor($bmp.Height * $HFrac))
  if ($x + $w -gt $bmp.Width)  { $w = $bmp.Width  - $x }
  if ($y + $h -gt $bmp.Height) { $h = $bmp.Height - $y }

  # Mosaic: average each Block x Block cell and fill it with that colour.
  for ($by = $y; $by -lt $y + $h; $by += $Block) {
    for ($bx = $x; $bx -lt $x + $w; $bx += $Block) {
      $r = 0; $g = 0; $b = 0; $n = 0
      $maxY = [math]::Min($by + $Block, $y + $h)
      $maxX = [math]::Min($bx + $Block, $x + $w)
      for ($py = $by; $py -lt $maxY; $py++) {
        for ($px = $bx; $px -lt $maxX; $px++) {
          $c = $bmp.GetPixel($px, $py)
          $r += $c.R; $g += $c.G; $b += $c.B; $n++
        }
      }
      if ($n -eq 0) { continue }
      $avg = [System.Drawing.Color]::FromArgb([int]($r / $n), [int]($g / $n), [int]($b / $n))
      for ($py = $by; $py -lt $maxY; $py++) {
        for ($px = $bx; $px -lt $maxX; $px++) {
          $bmp.SetPixel($px, $py, $avg)
        }
      }
    }
  }

  $tmp = "$($file.FullName).tmp.png"
  $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Move-Item $tmp $file.FullName -Force
  Write-Output "redacted $($file.Name)  region=${x},${y} ${w}x${h}"
}
