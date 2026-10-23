# Dumps a small pixel-art PNG/GIF (first frame) as a letter grid + palette, for hand-drawing new frames.
# Usage: pwsh -File dump-sprite.ps1 <image> [outPrefix]
#   writes <outPrefix>.grid.txt (one row per line, '.' = transparent) and <outPrefix>.pal.txt (letter=rrggbb, by frequency)
#   and prints both, plus a 10x upscale at <outPrefix>-10x.png for viewing.
param([Parameter(Mandatory=$true)][string]$Image, [string]$OutPrefix)
Add-Type -AssemblyName System.Drawing
if (-not $OutPrefix){ $OutPrefix = [IO.Path]::Combine([IO.Path]::GetDirectoryName((Resolve-Path $Image)), [IO.Path]::GetFileNameWithoutExtension($Image)) }
$src = [System.Drawing.Image]::FromFile((Resolve-Path $Image))
try { $fd = [System.Drawing.Imaging.FrameDimension]::Time; if ($src.GetFrameCount($fd) -gt 1){ $src.SelectActiveFrame($fd, 0) | Out-Null } } catch {}
$bmp = New-Object System.Drawing.Bitmap $src
$counts = New-Object 'System.Collections.Generic.Dictionary[string,int]'([System.StringComparer]::Ordinal)
$rows = @()
for ($y = 0; $y -lt $bmp.Height; $y++){
  $row = @()
  for ($x = 0; $x -lt $bmp.Width; $x++){
    $c = $bmp.GetPixel($x, $y)
    if ($c.A -lt 128){ $row += '.' } else { $hex = ('{0:x2}{1:x2}{2:x2}' -f $c.R, $c.G, $c.B); $row += $hex; if ($counts.ContainsKey($hex)){ $counts[$hex]++ } else { $counts[$hex] = 1 } }
  }
  $rows += ,$row
}
$letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
$key = New-Object 'System.Collections.Generic.Dictionary[string,string]'([System.StringComparer]::Ordinal)
$i = 0
foreach ($kv in ($counts.GetEnumerator() | Sort-Object Value -Descending)){ if ($i -ge $letters.Length){ throw "more than $($letters.Length) colours - reduce the palette first" }; $key[$kv.Key] = [string]$letters[$i]; $i++ }
$grid = $rows | ForEach-Object { ($_ | ForEach-Object { if ($_ -eq '.'){ '.' } else { $key[$_] } }) -join '' }
$pal = $counts.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { "$($key[$_.Key])=$($_.Key)  # x$($_.Value)" }
$grid | Set-Content "$OutPrefix.grid.txt"
$pal | Set-Content "$OutPrefix.pal.txt"
$s = 10
$big = New-Object System.Drawing.Bitmap ($bmp.Width * $s), ($bmp.Height * $s)
$g = [System.Drawing.Graphics]::FromImage($big); $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$g.Clear([System.Drawing.Color]::FromArgb(255, 60, 60, 60)); $g.DrawImage($bmp, 0, 0, $bmp.Width * $s, $bmp.Height * $s)
$big.Save("$OutPrefix-10x.png"); $g.Dispose(); $big.Dispose(); $bmp.Dispose(); $src.Dispose()
"$($rows[0].Count)x$($rows.Count), $($counts.Count) colours"
$y = 0; $grid | ForEach-Object { ('{0,2} {1}' -f $y, $_); $y++ }
'--- palette (letter=rrggbb, most used first)'
$pal
