# Sprite packs

Sunspire Saga draws every sprite, tile, background and icon from sheets under `assets/images/`,
and any sheet can be replaced by loading a **sprite pack**: image files named after the slot they
replace (`ari_field.png`, `wolf_battle.png`, `brindle.png` ...), loaded one by one or as a zip with
the *Load sprite pack* button on the play page. Packs stay in the player's own browser
(IndexedDB); nothing is uploaded.

The complete, always-current list of slots is on the **pack guide page** (`pack-guide.html`): every
sheet with its size, a preview and its frame names, with a *Copy all names* button. With a pack
loaded, the list marks every slot the pack covers. The list is generated from the asset tree by
`scripts/build_sunspire_assets.js` into `static/pack-slots.json`.

## Quick rules

- One image per slot, named exactly after the slot, in `.png`, `.gif` (first frame only) or
  `.webp`. Folder names inside a zip are ignored.
- The image must be the exact size of the sheet it replaces: slots are whole sheets, and the game
  cuts them into the same frames at the same positions. Open the original sheet from the guide to
  see the layout.
- Or bring your own layout: a `<slot>.json` TexturePacker atlas next to the sheet, with exactly
  the frame names the guide lists for that slot, lets the sheet be any size that holds those
  frames. Plain images (no frames in the guide) take no atlas.
- Partial packs are fine; everything you leave out keeps the built-in art. Files that match no slot
  or have the wrong size are reported and skipped.
- Trees (`tree`, `tree_trail`), fences (`fence_h` the run piece, `fence_post` facing right with
  its mirror for left ends, `fence_v` and `fence_v2`), the `houses` (one frame per house) and the
  `well` and `spring` are sprites, not tiles: they stand on the bottom row of their tile and may
  be taller or wider than it (a tree can cover several tiles), and they sort with the hero by
  that row. Give them any size you like with an atlas.
- A loaded pack takes effect at once: the play page reloads itself and confirms how many sheets
  the pack replaced. *Built-in art* clears the pack the same way.

## Art you may use

**Only art you made yourself or have the rights to use.** Do not put sprites ripped from commercial
games in this repository, in example packs, or in packs you distribute. Pull requests containing
such material will be closed.

## Sharing a pack

Zip the folder and share the zip; players load it with the file picker. A pack is a good fit for a
separate repository or a release asset here rather than for the main tree.

## For the port

The legacy game had one slot per sprite (`ari_down.png`, `tree.png`). The engine build replaces
whole sheets, laid out either like the built-in sheet or by the pack's own atlas; stitching
single frames into a sheet in the browser (the same thing `scripts/build_sunspire_assets.js` does
at build time) is the planned follow-up, so that per-sprite packs work again.
