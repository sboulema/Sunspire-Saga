# Sprite packs

Sunspire Saga draws every sprite from built-in pixel art, and any of it can be replaced by loading a
**sprite pack**: image files named after the slot they replace (`wolf.png`, `tree_2.gif`,
`ari_attack.png` …), loaded one by one or as a zip through the "Sprite packs" panel under the game.
Packs stay in the player's own browser (IndexedDB); nothing is uploaded.

The complete, always-current list of slot names is in the game: open **Pack guide → Complete slot
list** (it is generated from the game data and has a *Copy all names* button). With a pack loaded, the
same list marks every slot the pack covers and names files that match no slot.

## Quick rules

- One image per slot, named exactly after the slot, in `.png`, `.gif` (animated GIFs play their
  frames) or `.webp`. Folder names inside a zip are ignored.
- Sizes near the built-ins fit best: characters 16×22 with the feet on the bottom row, map objects
  16×16 bottom-anchored, battle enemies 20–30 px tall, battle backgrounds 240×160.
- Slots marked *variants* in the guide also take suffixed names (`tree_2`, `bg_field_deep`) and
  the game picks among them per tile or per battle.
- Partial packs are fine; everything you leave out keeps the built-in art.

## Art you may use

**Only art you made yourself or have the rights to use.** Do not put sprites ripped from commercial
games — Golden Sun or any other — in this repository, in example packs, or in packs you distribute.
Pull requests containing such material will be closed.

## Sharing a pack

Zip the folder and share the zip; players load it with the file picker. A pack is a good fit for a
separate repository or a release asset here rather than for the main tree.
