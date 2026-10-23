# Derives the walking frame (_right2) from a finished side-view sprite (_right):
# the lower leg and foot step forward and lift one pixel, the rest of the body stays put, so the two
# frames alternate into a stride in game. Also writes a 10x preview of both frames side by side.
# Usage: pwsh -File walk-frame.ps1 -In ari_right.png -Out ari_right2.png [-LegRows 7] [-Step 1] [-Lift 1] [-ArmRows 0]
#   -LegRows  rows counted from the bottom that belong to the leg (default: 27% of the height, e.g. 7 of 26)
#   -Step     horizontal move of the lower leg: positive = forward (right), negative = back
#   -Lift     pixels the lower leg rises
#   -ArmRows  optional: when > 0, the arm band (that many rows above the leg) is shifted 1 px against the step
param([Parameter(Mandatory=$true)][string]$In, [Parameter(Mandatory=$true)][string]$Out, [int]$LegRows = 0, [int]$Step = 1, [int]$Lift = 1, [int]$ArmRows = 0)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Resolve-Path $In))
try { $fd = [System.Drawing.Imaging.FrameDimension]::Time; if ($img.GetFrameCount($fd) -gt 1){ $img.SelectActiveFrame($fd, 0) | Out-Null } } catch {}
$src = New-Object System.Drawing.Bitmap $img
$w = $src.Width; $h = $src.Height
if ($LegRows -le 0){ $LegRows = [Math]::Max(3, [Math]::Round($h * 0.27)) }
$legTop = $h - $LegRows                       # first leg row
$mid = $h - [Math]::Ceiling($LegRows / 2)     # lower leg / foot starts here
$dst = New-Object System.Drawing.Bitmap $w, $h
$clear = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
for ($y = 0; $y -lt $h; $y++){ for ($x = 0; $x -lt $w; $x++){ $dst.SetPixel($x, $y, $(if ($y -lt $mid){ $src.GetPixel($x, $y) } else { $clear })) } }
# lower leg and foot: forward and up
for ($y = $mid; $y -lt $h; $y++){ for ($x = 0; $x -lt $w; $x++){
  $c = $src.GetPixel($x, $y); if ($c.A -lt 128){ continue }
  $nx = $x + $Step; $ny = $y - $Lift
  if ($nx -ge 0 -and $nx -lt $w -and $ny -ge 0 -and $ny -lt $h){ $dst.SetPixel($nx, $ny, $c) }
} }
# knee: the row just above the lift gap is re-filled from the upper leg so the leg stays joined
$kneeY = $mid - 1
if ($Lift -gt 0 -and $kneeY -ge $legTop){ for ($x = 0; $x -lt $w; $x++){ $c = $src.GetPixel($x, $kneeY); if ($c.A -ge 128 -and $dst.GetPixel($x, $kneeY).A -lt 128){ $dst.SetPixel($x, $kneeY, $c) } } }
# optional arm swing against the step
if ($ArmRows -gt 0){
  $a0 = [Math]::Max(0, $legTop - $ArmRows); $a1 = $legTop - 1
  $band = @{}; for ($y = $a0; $y -le $a1; $y++){ for ($x = 0; $x -lt $w; $x++){ $band["$x,$y"] = $dst.GetPixel($x, $y) } }
  for ($y = $a0; $y -le $a1; $y++){ for ($x = 0; $x -lt $w; $x++){ $dst.SetPixel($x, $y, $clear) } }
  foreach ($k in $band.Keys){ $p = $k.Split(','); $c = $band[$k]; if ($c.A -lt 128){ continue }; $nx = [int]$p[0] - [Math]::Sign($Step); $ny = [int]$p[1]; if ($nx -ge 0 -and $nx -lt $w){ $dst.SetPixel($nx, $ny, $c) } }
}
$dst.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$s = 10
$big = New-Object System.Drawing.Bitmap ($w * $s * 2 + 20), ($h * $s)
$g = [System.Drawing.Graphics]::FromImage($big); $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$g.Clear([System.Drawing.Color]::FromArgb(255, 60, 60, 60))
$g.DrawImage($src, 0, 0, $w * $s, $h * $s); $g.DrawImage($dst, $w * $s + 20, 0, $w * $s, $h * $s)
$prev = [IO.Path]::ChangeExtension($Out, $null).TrimEnd('.') + '-preview.png'
$big.Save($prev); $g.Dispose(); $big.Dispose(); $dst.Dispose(); $src.Dispose(); $img.Dispose()
"wrote $Out (legs: bottom $LegRows rows, lower leg from row $mid stepped $Step and lifted $Lift) and $prev"
