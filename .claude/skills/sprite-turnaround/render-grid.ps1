# Renders a letter grid + palette to a PNG, and a 10x preview beside a reference sprite.
# Usage: pwsh -File render-grid.ps1 -Grid frame.grid.txt -Pal base.pal.txt -Out ari_right.png [-Ref ari_down.png]
#   Grid: one row per line, '.' = transparent; every row must have the same width.
#   Pal: letter=rrggbb per line (anything after '#' is ignored). Letters are case-sensitive.
param([Parameter(Mandatory=$true)][string]$Grid, [Parameter(Mandatory=$true)][string]$Pal, [Parameter(Mandatory=$true)][string]$Out, [string]$Ref)
Add-Type -AssemblyName System.Drawing
$palette = New-Object 'System.Collections.Generic.Dictionary[string,string]'([System.StringComparer]::Ordinal)  # PowerShell variables are case-insensitive: keep this distinct from the $Pal parameter
Get-Content $Pal | ForEach-Object { $l = ($_ -split '#')[0].Trim(); if ($l){ $kv = $l.Split('='); $palette[$kv[0].Trim()] = $kv[1].Trim() } }
$rows = Get-Content $Grid | Where-Object { $_.Trim() -ne '' } | ForEach-Object { $_.TrimEnd() }
$w = $rows[0].Length; $h = $rows.Count
$bad = @(); for ($y = 0; $y -lt $h; $y++){ if ($rows[$y].Length -ne $w){ $bad += "row $y has width $($rows[$y].Length), expected $w" } }
if ($bad){ $bad -join "`n"; exit 1 }
$bmp = New-Object System.Drawing.Bitmap $w, $h
for ($y = 0; $y -lt $h; $y++){ for ($x = 0; $x -lt $w; $x++){
  $ch = [string]$rows[$y][$x]
  if ($ch -eq '.'){ continue }
  if (-not $palette.ContainsKey($ch)){ "unknown palette key '$ch' at $x,$y"; exit 1 }
  $hex = $palette[$ch]
  $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, [Convert]::ToInt32($hex.Substring(0,2),16), [Convert]::ToInt32($hex.Substring(2,2),16), [Convert]::ToInt32($hex.Substring(4,2),16)))
} }
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$s = 10; $refBmp = $null
if ($Ref){ $refImg = [System.Drawing.Image]::FromFile((Resolve-Path $Ref)); try { $fd = [System.Drawing.Imaging.FrameDimension]::Time; if ($refImg.GetFrameCount($fd) -gt 1){ $refImg.SelectActiveFrame($fd, 0) | Out-Null } } catch {}; $refBmp = New-Object System.Drawing.Bitmap $refImg }
$pw = $w * $s + $(if ($refBmp){ $refBmp.Width * $s + 20 } else { 0 })
$ph = [Math]::Max($h, $(if ($refBmp){ $refBmp.Height } else { 0 })) * $s
$big = New-Object System.Drawing.Bitmap $pw, $ph
$g = [System.Drawing.Graphics]::FromImage($big); $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$g.Clear([System.Drawing.Color]::FromArgb(255, 60, 60, 60))
$ox = 0
if ($refBmp){ $g.DrawImage($refBmp, 0, 0, $refBmp.Width * $s, $refBmp.Height * $s); $ox = $refBmp.Width * $s + 20 }
$g.DrawImage($bmp, $ox, 0, $w * $s, $h * $s)
$prev = [IO.Path]::ChangeExtension($Out, $null).TrimEnd('.') + '-preview.png'
$big.Save($prev); $g.Dispose(); $big.Dispose(); $bmp.Dispose(); if ($refBmp){ $refBmp.Dispose(); $refImg.Dispose() }
"wrote $Out ($w x $h) and $prev"
