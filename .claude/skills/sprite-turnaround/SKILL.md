---
name: sprite-turnaround
description: Draw the missing frames of a small pixel-art character (right / right2 / up / up2, and the Sunspire Saga battle set back / attack / cast / hit / downed) from a single front-facing _down sprite, in that sprite's own palette and proportions. Use when the user gives a _down sprite and asks for a _right, _up, side view, back view, walk frame or turnaround.
---

# Sprite turnaround from a single `_down` frame

Turn one front-facing sprite into the other frames a character needs, hand-drawn pixel by pixel in
the **same palette and size**. There is no automatic way to derive a side or back view; this skill
makes the manual job fast, exact and repeatable.

## Workflow

1. **Dump the source** (first frame of a PNG or GIF) to a letter grid and palette:
   ```
   pwsh -File .claude/skills/sprite-turnaround/dump-sprite.ps1 <down.png> <outPrefix>
   ```
   It prints the grid with row numbers, the palette (`letter=rrggbb`, most-used first) and writes
   `<outPrefix>.grid.txt`, `<outPrefix>.pal.txt` and `<outPrefix>-10x.png`. Look at the 10x image and
   read the grid to identify what each letter is (outline, hair light/mid/dark, skin, eye, shirt, vest,
   belt, trousers, boots...). Note the width, height and where the feet row is.

2. **Draw the new frame as a grid** in a new text file (same width and height, `.` = transparent),
   using only letters from the palette. Keep the head rows, hairline, scarf/collar and boot colours
   identical to the source so the frames match when they alternate in game.

3. **Render and compare**:
   ```
   pwsh -File .claude/skills/sprite-turnaround/render-grid.ps1 -Grid <frame>.grid.txt -Pal <outPrefix>.pal.txt -Out <id>_right.png -Ref <down.png>
   ```
   The script fails loudly on a wrong row width or unknown letter, writes the PNG at native size and
   a `*-preview.png` with the source at 10x on the left and the new frame on the right. View the
   preview, fix the grid, render again. Deliver the native PNG (and the preview, so the user can judge
   it) with SendUserFile, or write it straight into the pack folder when asked.

3b. **Finish everything in one go** once the `_right` grid looks right - this is the normal path:
   ```
   pwsh -File .claude/skills/sprite-turnaround/finish-turnaround.ps1 -Down <dropped file> -RightGrid <grid> -Hair <hair hexes> -Fill <hair mid> -Nape <hair shade> [-HeadRows N] [-KeepTop N] [-Flatten "..."] [-LegRows N] [-OutDir <dir>]
   ```
   It keeps the **naming scheme of the dropped sprite**: `lyn_down.gif` gives `lyn_down.gif` (copied),
   `lyn_down2.png`, `lyn_right.png`, `lyn_right2.png`, `lyn_up.png`, `lyn_up2.png`; a file without a
   `_down` suffix uses its whole base name as the prefix (override with `-Prefix`). It renders the side
   view, derives the walk frames (`down2` from the dropped sprite, `right2`, `up2`), builds the back view,
   writes a labelled contact sheet `<prefix>-turnaround-sheet.png` and zips the six game-ready frames into
   **`<prefix>-turnaround.zip`**. View the sheet, then deliver the zip (and the sheet) with SendUserFile.
   Steps 4 and 5 below describe the individual scripts it calls, for one-off fixes.

4. **Make the walking frame mechanically** once `_right` is approved - do not redraw it by hand:
   ```
   pwsh -File .claude/skills/sprite-turnaround/walk-frame.ps1 -In <id>_right.png -Out <id>_right2.png
   ```
   It keeps everything above the legs identical and moves the lower leg and foot one pixel forward
   and one pixel up (knee re-joined), writing `<id>_right2.png` and a `*-preview.png` of both frames.
   Defaults suit 22-26 px sprites (legs = bottom 27 % of the height); use `-LegRows` when the hip
   line sits elsewhere, `-Step -1` for a back-step instead, `-ArmRows 6` to also swing the arm. View
   the preview: the two frames should read as one stride when flipped between. The same script makes
   `up2` from `up` and `down2` from `down` (there the step reads as one leg moving).

5. **Make the back view mechanically** from the `_down` sprite, then its walk frame:
   ```
   pwsh -File .claude/skills/sprite-turnaround/back-view.ps1 -In <id>_down.png -Out <id>_up.png -Hair <hair hexes> -Fill <hair mid> -Nape <hair shade> [-HeadRows 9] [-Flatten "808080>703838,..."]
   pwsh -File .claude/skills/sprite-turnaround/walk-frame.ps1 -In <id>_up.png -Out <id>_up2.png
   ```
   `back-view.ps1` mirrors the sprite (the character's right arm is now on the viewer's left), keeps the
   head's outline and every pixel already in a hair colour, turns the rest of the head (face, eyes,
   mouth) into the fill colour with the lowest head rows in the nape shade, and replaces front-only
   details listed in `-Flatten` (buckle greys, vest highlight, eye white) with their base colours.
   Read the hair and detail colours off the palette from step 1; `-HeadRows` is the row just past the
   chin (default 35 % of the height), `-KeepTop` leaves the top spikes untouched. Check the preview;
   if a stray face pixel survives (a colour shared by face and clothing), add it to `-Flatten`.

## Drawing rules per frame (Sunspire Saga conventions, 16-17 wide, 22-26 tall, feet on the bottom row)

- **right** (true side view, facing right): the body turns fully - do not just narrow the front view.
  Head: hair mass behind (left), one eye and its highlight near the front, a **subtle nose** - a single
  pixel proud of the face line at eye height in the light skin tone, with a shaded pixel on the face
  edge just above it - mouth below it, back-of-head outline. Keep the nose small unless the user asks
  for more; the face line itself should stay nearly straight. **Shade the face with the same tones the `down`
  sprite uses** - never one flat skin colour: brightest tone on the brow and the top of the cheek, the
  main light tone on the forehead and cheek, the pink or warm shade on the lower cheek and under the
  nose, the darkest skin shade along the jaw and under the chin, matching the light direction of the
  front view (usually from the upper left, so the back of the head is lit and the face front is softer). Torso 7-8 px wide: shirt/back colour at the rear
  column, the vest or tunic front with its opening edge toward the front, one arm hanging in front
  of the torso with the hand below the belt. **One leg and one foot only** (the near leg hides the
  far one), toe pointing right, foot slightly longer than it is tall. The game mirrors `right` to
  `left`; never draw `left`.
- **right2** (walk): same as right with the leg mid-stride - knee bent, foot lifted 1 px and moved
  1 px back, the arm swung 1 px.
- **up** (back view): same silhouette as `down`; the face becomes hair (keep the hairline shape),
  no eyes, scarf knot or collar seen from behind, the back of the vest plain, heels of the boots.
  **up2**: legs alternated as in `down2`.
- **down2** if missing: `down` with legs alternated (one leg up 1 px, the other down 1 px).
- Battle set (back view, same size): **back** = `up` with feet apart and fists at the hips;
  **attack / attack2** = blade raised then swung; **cast / cast2** = hands raised with a glow, then
  arms spread; **hit** = recoil, arms up, head tilted; **downed** = lying on the ground, head to the
  left, occupying the bottom third of the frame.
- Keep outlines 1 px and use the source's own outline colour; add no new colours unless the user asks.
- Do not use these scripts on sprites ripped from commercial games for anything that will be
  distributed; drawing matching frames for a user's own local pack is fine.

## Files

- `dump-sprite.ps1` - image -> grid + palette + 10x view
- `render-grid.ps1` - grid + palette -> PNG + side-by-side preview
- `walk-frame.ps1` - finished frame -> its walking frame (lower leg stepped and lifted) + preview
- `back-view.ps1` - front sprite -> back view (mirrored, face filled with hair, details flattened) + preview
- `finish-turnaround.ps1` - dropped sprite + right grid -> all six frames named after the dropped file, contact sheet, zip
