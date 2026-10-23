# Finishes a turnaround from the dropped _down sprite and the hand-drawn _right grid:
#   <prefix>_down.<ext> (copy of the input), <prefix>_down2.png, <prefix>_right.png, <prefix>_right2.png,
#   <prefix>_up.png, <prefix>_up2.png, a contact sheet <prefix>-turnaround-sheet.png and <prefix>-turnaround.zip.
# The prefix follows the dropped file's name: "lyn_down.gif" -> "lyn", "hero.png" -> "hero" (override with -Prefix).
# Usage: pwsh -File finish-turnaround.ps1 -Down lyn_down.gif -RightGrid lyn_right.grid.txt -Hair <hexes> -Fill <hex> -Nape <hex>
#          [-HeadRows 9] [-KeepTop 2] [-Flatten "..."] [-LegRows 0] [-Prefix lyn] [-OutDir .]
param([Parameter(Mandatory=$true)][string]$Down, [Parameter(Mandatory=$true)][string]$RightGrid,
      [Parameter(Mandatory=$true)][string]$Hair, [Parameter(Mandatory=$true)][string]$Fill, [string]$Nape,
      [int]$HeadRows = 0, [int]$KeepTop = 2, [int]$NapeRows = 2, [string]$Flatten = '', [int]$LegRows = 0, [string]$Prefix, [string]$OutDir)
$ErrorActionPreference = 'Stop'
$sk = Split-Path -Parent $MyInvocation.MyCommand.Path
$downPath = (Resolve-Path $Down).Path
$base = [IO.Path]::GetFileNameWithoutExtension($downPath)
if (-not $Prefix){ $Prefix = $(if ($base -match '^(.*)_down$'){ $Matches[1] } else { $base }) }
if (-not $OutDir){ $OutDir = Split-Path -Parent $downPath }
$work = Join-Path $OutDir "$Prefix-turnaround"
New-Item -ItemType Directory -Force $work | Out-Null
Get-ChildItem $work | Remove-Item -Force
$ext = [IO.Path]::GetExtension($downPath)
Copy-Item $downPath (Join-Path $work "${Prefix}_down$ext")
# palette from the source, side view from the grid
pwsh -NoProfile -File (Join-Path $sk 'dump-sprite.ps1') $downPath (Join-Path $work "_src") | Out-Null
$pal = Join-Path $work '_src.pal.txt'
pwsh -NoProfile -File (Join-Path $sk 'render-grid.ps1') -Grid $RightGrid -Pal $pal -Out (Join-Path $work "${Prefix}_right.png") -Ref $downPath
if ($LASTEXITCODE -ne 0){ throw 'render-grid failed' }
pwsh -NoProfile -File (Join-Path $sk 'walk-frame.ps1') -In (Join-Path $work "${Prefix}_right.png") -Out (Join-Path $work "${Prefix}_right2.png") -LegRows $LegRows
pwsh -NoProfile -File (Join-Path $sk 'walk-frame.ps1') -In $downPath -Out (Join-Path $work "${Prefix}_down2.png") -LegRows $LegRows
$bv = @('-In', $downPath, '-Out', (Join-Path $work "${Prefix}_up.png"), '-Hair', $Hair, '-Fill', $Fill, '-HeadRows', $HeadRows, '-KeepTop', $KeepTop, '-NapeRows', $NapeRows)
if ($Nape){ $bv += @('-Nape', $Nape) }; if ($Flatten){ $bv += @('-Flatten', $Flatten) }
pwsh -NoProfile -File (Join-Path $sk 'back-view.ps1') @bv
pwsh -NoProfile -File (Join-Path $sk 'walk-frame.ps1') -In (Join-Path $work "${Prefix}_up.png") -Out (Join-Path $work "${Prefix}_up2.png") -LegRows $LegRows
# contact sheet: down, down2, right, right2, up, up2 at 8x
Add-Type -AssemblyName System.Drawing
$names = @("${Prefix}_down$ext", "${Prefix}_down2.png", "${Prefix}_right.png", "${Prefix}_right2.png", "${Prefix}_up.png", "${Prefix}_up2.png")
$imgs = @(); foreach ($n in $names){ $im = [System.Drawing.Image]::FromFile((Join-Path $work $n)); try { $fd = [System.Drawing.Imaging.FrameDimension]::Time; if ($im.GetFrameCount($fd) -gt 1){ $im.SelectActiveFrame($fd, 0) | Out-Null } } catch {}; $imgs += ,(New-Object System.Drawing.Bitmap $im); $im.Dispose() }
$s = 8; [int]$w = ($imgs | ForEach-Object { $_.Width } | Measure-Object -Maximum).Maximum; [int]$h = ($imgs | ForEach-Object { $_.Height } | Measure-Object -Maximum).Maximum
[int]$sheetW = ($w * $s + 12) * $imgs.Count + 12; [int]$sheetH = $h * $s + 40
$sheet = New-Object System.Drawing.Bitmap $sheetW, $sheetH
$g = [System.Drawing.Graphics]::FromImage($sheet); $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$g.Clear([System.Drawing.Color]::FromArgb(255, 60, 60, 60))
$font = New-Object System.Drawing.Font('Arial', 11); $brush = [System.Drawing.Brushes]::White
for ($i = 0; $i -lt $imgs.Count; $i++){ $x = 12 + $i * ($w * $s + 12); $g.DrawImage($imgs[$i], $x, 8, $imgs[$i].Width * $s, $imgs[$i].Height * $s); $g.DrawString(($names[$i] -replace '\.(png|gif)$', ''), $font, $brush, $x, $h * $s + 14) }
$sheet.Save((Join-Path $work "$Prefix-turnaround-sheet.png")); $g.Dispose(); $sheet.Dispose(); $imgs | ForEach-Object { $_.Dispose() }
# the deliverable zip holds only the game-ready frames
Remove-Item (Join-Path $work '_src.*') -Force
$zip = Join-Path $OutDir "$Prefix-turnaround.zip"
if (Test-Path $zip){ Remove-Item $zip -Force }
Compress-Archive -Path ($names | ForEach-Object { Join-Path $work $_ }) -DestinationPath $zip
Get-ChildItem $work | Where-Object { $_.Name -like '*-preview.png' } | Remove-Item -Force
"prefix: $Prefix"
"frames: $($names -join ', ')"
"sheet:  $(Join-Path $work "$Prefix-turnaround-sheet.png")"
"zip:    $zip"
