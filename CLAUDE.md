# Sunspire Saga (engine build)

The browser JRPG Sunspire Saga on a fork of the goldensun_html5 engine (Phaser CE, TypeScript
under `base/`). `README.md` says how to run and change it, `packs/README.md` the sprite packs,
`ASSETS.md` where every asset comes from. No Nintendo / Camelot assets, names or data, ever.

## The game is generated from `assets/sunspire/`

- `assets/sunspire/content.json` is the single source of the game: characters, arts, gear,
  items, shops, inns, chests, spirits, summons, enemies, encounters, maps (exits, houses, signs,
  wells, boulder, gate, puzzle, bosses, joins), villagers, dialog, story and rules.
- `assets/sunspire/sprites/`, `maps/` and `glyphs.json` are the source art.
- `npm run build:content` regenerates everything derived from them: `assets/images`,
  `assets/font`, `assets/sounds`, `static/pack-slots.json`, the databases in `assets/dbs/`, the
  Tiled maps in `assets/maps/` and `walkthrough.html`. **Edit the sources and regenerate; never
  edit a generated file by hand** (the next regeneration would silently undo it). The
  hand-written exceptions are `assets/dbs/misc_animations_db.json`,
  `interactable_objects_db.json`, the attack, jump and cure recipes under
  `assets/dbs/*_animations/` (the arts' own recipes are generated next to them) and
  `assets/init.json`.
- Any change a player could notice must therefore go into `content.json` (or the generators),
  and the regenerated `walkthrough.html` is committed with it: that is how the walkthrough stays
  in sync with the game. The same commit also describes the change on the changelog page
  (`changelog.html`, hand-written; the top row while the engine build has no version number).

## Working on it

- `npm install`, `npm start` (port 9000; the dev server reloads the page on any file change, so
  do not regenerate assets in the middle of a browser test).
- `npm run build` type-checks; `npm run format` (also the pre-commit hook) runs Prettier over
  `base/`; `npm run site` builds the static site in `site/`.
- Engine quirks that bite when adding content: events in a
  list fire at once, so chain through `finish_events`; deactivate an NPC only as the last step of
  its chain; declare every storage flag in the generator; map properties the engine reads as
  strings are not JSON-encoded; NPCs are reached by walking into them.
- Testing in a hidden browser pane: Phaser drops to ~2 fps, so drive `GoldenSun.game.update()`
  from a Web Worker timer and synthesise keydown / keyup events carrying `keyCode`; NPCs must
  be reached by walking (teleporting the body does not set `transition_direction`).
