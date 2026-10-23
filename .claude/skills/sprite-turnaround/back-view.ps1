# Builds the back view (_up) from a front-facing sprite (_down):
#   1. mirrors the sprite horizontally (what was on the character's right is now seen on the left),
#   2. inside the head rows keeps the outline and every pixel that already is a hair colour, and turns the
#      rest (face, eyes, mouth) into hair - the fill colour, with the nape rows in the hair shade,
#   3. flattens front-only details on the body (buckle, vest highlight...) into their base colours.
# Usage: pwsh -File back-view.ps1 -In ari_down.png -Out ari_up.png -Hair e0b070,f8e070,b07038 -Fill e0b070 -Nape b07038
#          [-HeadRows 9] [-KeepTop 2] [-NapeRows 2] [-Flatten "808080>703838,e07070>b03838"] [-NoMirror]
#   -Hair     hair colours to keep (hex, comma separated; the outline colours need not be listed)
#   -Fill     hair colour that replaces the face
#   -Nape     darker hair colour for the lowest head rows (default: Fill)
#   -HeadRows rows from the top that belong to the head, up to the chin (default: 35% of the height)
#   -KeepTop  top rows left untouched (hair spikes), default 2
#   -Flatten  "from>to" hex pairs applied to the whole sprite after the head work
param([Parameter(Mandatory=$true)][string]$In, [Parameter(Mandatory=$true)][string]$Out, [Parameter(Mandatory=$true)][string]$Hair,
      [Parameter(Mandatory=$true)][string]$Fill, [string]$Nape, [int]$HeadRows = 0, [int]$KeepTop = 2, [int]$NapeRows = 2, [string]$Flatten = '', [switch]$NoMirror)
Add-Type -AssemblyName System.Drawing
function HexCol([string]$hex){ $hex = $hex.Trim().TrimStart('#'); [System.Drawing.Color]::FromArgb(255, [Convert]::ToInt32($hex.Substring(0,2),16), [Convert]::ToInt32($hex.Substring(2,2),16), [Convert]::ToInt32($hex.Substring(4,2),16)) }
function Key([System.Drawing.Color]$c){ '{0:x2}{1:x2}{2:x2}' -f $c.R, $c.G, $c.B }
$img = [System.Drawing.Image]::FromFile((Resolve-Path $In))
try { $fd = [System.Drawing.Imaging.FrameDimension]::Time; if ($img.GetFrameCount($fd) -gt 1){ $img.SelectActiveFrame($fd, 0) | Out-Null } } catch {}
$src = New-Object System.Drawing.Bitmap $img
$w = $src.Width; $h = $src.Height
if ($HeadRows -le 0){ $HeadRows = [Math]::Round($h * 0.35) }
if (-not $Nape){ $Nape = $Fill }
$hairSet = New-Object 'System.Collections.Generic.HashSet[string]'([System.StringComparer]::Ordinal)
foreach ($hx in $Hair.Split(',')){ if ($hx.Trim()){ [void]$hairSet.Add($hx.Trim().TrimStart('#').ToLower()) } }
[void]$hairSet.Add($Fill.Trim().TrimStart('#').ToLower()); [void]$hairSet.Add($Nape.Trim().TrimStart('#').ToLower())
$fillC = HexCol $Fill; $napeC = HexCol $Nape
$dst = New-Object System.Drawing.Bitmap $w, $h
for ($y = 0; $y -lt $h; $y++){ for ($x = 0; $x -lt $w; $x++){ $sx = $(if ($NoMirror){ $x } else { $w - 1 - $x }); $dst.SetPixel($x, $y, $src.GetPixel($sx, $y)) } }
# head: outline = opaque pixel with a transparent 4-neighbour (or at the image edge); everything else inside becomes hair unless it already is
function Opaque($b, $x, $y){ if ($x -lt 0 -or $y -lt 0 -or $x -ge $w -or $y -ge $h){ return $false }; return $b.GetPixel($x, $y).A -ge 128 }
$snap = New-Object System.Drawing.Bitmap $dst
for ($y = $KeepTop; $y -lt [Math]::Min($HeadRows, $h); $y++){
  for ($x = 0; $x -lt $w; $x++){
    if (-not (Opaque $snap $x $y)){ continue }
    $isOutline = -not ((Opaque $snap ($x-1) $y) -and (Opaque $snap ($x+1) $y) -and (Opaque $snap $x ($y-1)) -and (Opaque $snap $x ($y+1)))
    if ($isOutline){ continue }
    $k = Key $snap.GetPixel($x, $y)
    if ($hairSet.Contains($k)){ continue }
    $dst.SetPixel($x, $y, $(if ($y -ge $HeadRows - $NapeRows){ $napeC } else { $fillC }))
  }
}
# flatten front-only details
if ($Flatten){
  $map = @{}
  foreach ($pair in $Flatten.Split(',')){ if ($pair -match '>'){ $ab = $pair.Split('>'); $map[$ab[0].Trim().TrimStart('#').ToLower()] = HexCol $ab[1] } }
  for ($y = 0; $y -lt $h; $y++){ for ($x = 0; $x -lt $w; $x++){ $c = $dst.GetPixel($x, $y); if ($c.A -lt 128){ continue }; $k = Key $c; if ($map.ContainsKey($k)){ $dst.SetPixel($x, $y, $map[$k]) } } }
}
$dst.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$s = 10
$big = New-Object System.Drawing.Bitmap ($w * $s * 2 + 20), ($h * $s)
$g = [System.Drawing.Graphics]::FromImage($big); $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$g.Clear([System.Drawing.Color]::FromArgb(255, 60, 60, 60))
$g.DrawImage($src, 0, 0, $w * $s, $h * $s); $g.DrawImage($dst, $w * $s + 20, 0, $w * $s, $h * $s)
$prev = [IO.Path]::ChangeExtension($Out, $null).TrimEnd('.') + '-preview.png'
$big.Save($prev); $g.Dispose(); $big.Dispose(); $dst.Dispose(); $snap.Dispose(); $src.Dispose(); $img.Dispose()
"wrote $Out (head rows 0-$($HeadRows-1), top $KeepTop kept, nape $NapeRows rows) and $prev"
