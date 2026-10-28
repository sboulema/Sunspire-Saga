# Sunspire Saga on the gshtml5 engine

This branch (`claude/sunspire-gshtml5-migration-c37ec5`) carries a copy of
[jjppof/goldensun_html5](https://github.com/jjppof/goldensun_html5) (MIT, Phaser CE 2.19.0),
fetched from upstream `master` at `b8b086dc` on 2026-10-27, as the base for moving Sunspire Saga
onto it. The current game (`game.js` and the site around it) stays on `main` until the port is
done; nothing here is published yet.

Target engine features: Tiled maps with height differences, puzzles, overworld, battle
animations, menus, Psynergy usage and djinn (spirit) usage.

## Guardrails

- The engine code is MIT. `LICENSE.txt` and its copyright notice stay in the repo; Sunspire's
  own code is added under the same licence.
- **No Golden Sun assets, names or data in the finished fork.** MIT covers the code, not
  Nintendo/Camelot media. Everything listed under "Inventory" below gets removed or replaced.
- The README keeps the line that Sunspire Saga is an independent homage with no assets from
  Nintendo or Camelot.
- `upstream` is the engine remote (`git remote add upstream
  https://github.com/jjppof/goldensun_html5.git`); pull engine fixes from `upstream/master`.

## Phase log

### Phase 0 - decisions

- Fork lives on this branch of the Sunspire-Saga repo, not in a new repo. `main` keeps `game.js`
  as the live game; it becomes the `legacy` branch when this branch replaces it.
- Repo name and GitHub account: unchanged (`sboulema/Sunspire-Saga`).

### Phase 1 - fork and run (done 2026-10-27)

- Node `.nvmrc` says `14/*`; Node 26.12 / npm 11.20 work fine.
- `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install --legacy-peer-deps` installs 704 packages
  (8 audit findings, 3 moderate / 5 high, not yet looked at). The Electron binary is not needed
  for the web build.
- `npx webpack serve --config webpack.config.dev.js --no-open` serves on port 9000; the bundle is
  25.6 MiB in dev mode (2128 node_modules modules + 232 under `base/`) and compiles in ~25 s.
  `.claude/launch.json` has this as `engine-dev`.
- Verified in Chromium: title screen -> PRESS START (Enter) -> New Game (Z) -> loads the `madra`
  map at tile (30, 13) as `isaac` and plays the welcome dialog. Keyboard: arrows, Z = A, X = B,
  A/S = L/R, Enter = Start, Backspace = Select, Q/W/E/R = Psynergy shortcuts.
- Still to read: the [wiki](https://github.com/jjppof/goldensun_html5/wiki) (database
  configuration, tutorials, project tech info), the
  [developer guidelines](https://github.com/jjppof/goldensun_html5/wiki/Introduction-for-developers#some-coding-guidelines)
  and the [API docs](https://gshtml5.org/docs/) (or `npm run docs`).

### Phase 2 - strip Golden Sun content (done 2026-10-27)

- Removed: `assets/images`, `assets/maps`, `assets/sounds`, `assets/font`, every database, every
  battle animation recipe that referenced GS sprites, `help/docs/battle_mechanics.txt`, the GS
  logo, `static/gtag.js`. The GS text in `index.html`, `index-electron.html`, `electron/main.js`,
  `package.json`, `static/manifest.webmanifest`, `humans.txt`, the logger prefix and one code
  comment was rewritten. The `GoldenSun` class and the `djinn` / `psynergy` identifiers in the
  code and database keys stay (player-facing text says spirit / art); renaming them is a
  code-only pass for later.
- Added `assets/sunspire/` (the 255 sprites exported from the legacy game with
  `tools/export-pack.js`, the Brindle tileset and grid rendered from `buildBrindle`, the 5x5
  glyphs) and `scripts/build_sunspire_assets.js`, which generates the engine's atlases, map, font
  and placeholder audio from them. `ASSETS.md` lists the origin of everything left.
- Placeholder set: map `brindle` (30x20, one tile layer, collision object layer `0`, both exits
  blocked until their maps exist), NPCs Dov (shop `brindle`), Ina (inn `brindle_inn`), Miner
  (dialog, then battle `wolf_pair`) and Lyn (dialog); hero `ari` with class `adept`
  (Quake / Spire / Gaia Blade), spirit `flint`, summon `gnome`, items herb / potion / wood blade /
  travel vest; enemy `wolf`. The engine's placeholder art for widgets it needs (menu arrows,
  status icons, battle cursor, emoticons, most buttons) is drawn by the build script as labelled
  boxes.
- Engine facts learned the hard way (all verified in code; keep them in mind when adding data):
  - initializers that queue nothing for Phaser's loader hang on "Loading...": `bgm_db`,
    `enemies_db`, `npc_db`, `main_chars_db` (needs a non-empty `weapons_sprites`),
    `misc_animations_db`, `interactable_objects_db` each need at least one entry;
  - `misc_animations_db` must have `move_hand`, `pound_hand`, `sand` (field psynergy
    constructors), `dialog_crystal` and `battle_status_sprites`;
  - `npc_db` must have `venus_djinn`, `mercury_djinn`, `mars_djinn` and `jupiter_djinn` with `set`
    and `standby` actions (the spirit menu is built at boot for all four);
  - `abilities_db` must have `attack`, `defend`, `set_djinn` and `flee`; `bgm_db` must have
    `page_one`, `victory`, `fallen_heroes` and the `battle_bgms.default` key;
  - Tiled maps must be the 1.1 JSON format with object-form `properties`, one embedded tileset,
    and the tileset image comes from `maps_db.tileset_files.image`, loaded under the map key;
  - atlases are TexturePacker JSON hash, frames `<action>/<animation>/NN`;
  - `frame_rate` is mandatory on every action.
- Verified in Chromium: title (Sunspire font), New Game, Brindle with the four NPCs, walking, Dov's
  shop (buy list, prices, coins), the Miner's dialog, the wolf battle through Fight / Attack to
  victory (coins 30 -> 42). Note for testing in a hidden browser pane: Phaser drops to ~2 fps, so
  drive `GoldenSun.game.update()` from a Web Worker timer and synthesise key holds.

How the engine takes content: `base/initializers/assets_loader.ts` queues every database JSON
and the shared atlases with Phaser's loader (`game.load.json`, `game.load.atlasJSONHash`,
`game.load.image`, `game.load.audio`, `game.load.bitmapFont`, `game.load.tilemap`); the per-type
initializers under `base/initializers/` then load the sheets each database entry names. All
asset paths are strings under `assets/`, which is what the sprite-pack hook in Phase 5 will
rewrite.

## Inventory of Golden Sun-derived content

Everything below is GS media or data and must go, except where marked *keep*.

**Databases** (`assets/dbs/`, 503 KB):

| file | entries | GS content |
|---|---|---|
| `main_chars_db.json` | 4 | isaac, garet, sheba, piers |
| `classes_db.json` | 2 | GS class table |
| `djinni_db.json` | 21 | flint ... chill (GS djinn names) |
| `summons_db.json` | 17 | venus ... thor (GS summon names) |
| `abilities_db.json` | 165 | GS Psynergy names and numbers |
| `items_db.json` | 35 | GS items (gaia_blade, apollos_axe, ...) |
| `enemies_db.json` / `enemies_parties_db.json` | 8 / 7 | briggs, sea_fighter, mini_goblin, ... |
| `npc_db.json` | 18 | isaac, garet, sheba, piers, alex, briggs, ... |
| `maps_db.json` | 10 | madra (6 maps), snowland, world_map, cave, nyungwe |
| `shops_db.json`, `inn_db.json`, `shopkeep_dialog_db.json` | 1 each | GS shop text |
| `bgm_db.json`, `se_db.json`, `misc_animations_db.json`, `storage_db.json`, `interactable_objects_db.json` | 7 / 9 / 12 / 24 / 13 | mostly structural; names reference GS sounds and sprites |
| `custom_field_psynergies_db.json` | 0 | *keep* (empty) |
| `abilities_animations/`, `common_abilities_animations/` | dirs | GS battle animation recipes |
| `assets/init.json` | - | hero `isaac`, map `madra`, GS shortcuts; *keep* the input tables |

**Images** (`assets/images/`, 2.1 MB): `spritesheets/` (101 files: battle, djinn, main_chars,
npc, places), `tilesets/` (cave, forest, madra, madra_interior, snowland, world_map),
`abilities_animations/` (44), `interactable_objects/` (30), `misc/` (31, incl. `logo.jpg` and
`start_screen.png`), `psynergies/` (14), `icons/` (abilities, battle_effects, items),
`battle_backgrounds/`, `avatars/`, `buttons/`, `keyboard/`, `debug/`. All ripped or redrawn GS
art except possibly `debug/`, `keyboard/` and `buttons/` (check each before keeping).

**Fonts** (`assets/font/`): `golden-sun.fnt/.png`, `golden-sun-italic`, `gs-item-font`, all GS
bitmap fonts. Sunspire's 5x5 bitmap font replaces them (Shoebox or a script makes the `.fnt`).

**Maps** (`assets/maps/`, 1.7 MB): Tiled JSON for cave, forest, madra (+ church, cave, corner,
houses, side), snowland, world_map. GS layouts, remove; use as reference for the Tiled
conventions (height layers, collision, events) while building Sunspire's maps.

**Audio** (`assets/sounds/`, 11 MB): 12 BGM `.ogg` (battle_isaac, little_madra, ...) and 9 SE
`.ogg` (actions, battle, psynergy, ...). All GS. Sunspire's WebAudio synth sound needs either a
rendered `.ogg` set or an engine hook for synthesised SE.

**Code and site** (`base/`, `static/`, `index.html`, `README.md`, `package.json`): 208 source
files mention GS terms; almost all are the `GoldenSun` class/namespace (393 hits), which stays
until a rename pass. Character names in code are 1 hit each (Isaac, Garet, Felix, Jenna, Mia).
`index.html` has the GS logo, keywords, demo text and copyright notice; `static/manifest.webmanifest`,
`humans.txt` and `gtag.js` are the upstream site's. `help/docs` and `help/utils` are upstream's
docs and tools.

**Keep**: `assets/filters/` (shaders), `assets/plugins/particle-storm.js` (check its licence),
`static/phaser.js`, `static/codemirror*` (debug editor), `static/styles.css`.

### Phase 2 next steps

1. Build the minimal placeholder set (one map, one NPC, one battle) with Sunspire art so the
   engine still boots, then delete the rest in one commit.
2. Rename GS terms in player-facing strings (djinn -> spirit, Psynergy -> art).
3. Add `ASSETS.md` listing the origin and licence of every asset left.

### Phase 3 - tooling and browser support (2026-10-27)

- Electron is gone: `electron/`, `index-electron.html`, `scripts/generate_deploy.js`, the
  `electron*`, `archiver`, `ajv*`, `pinst` and `@webpack-cli/serve` packages, the desktop npm
  scripts and every `electron_app` / `ipcRenderer` branch in `base/` (GoldenSun, Logger, Debug,
  StartMenu, TeleportEvent).
- `npm install` works without `--legacy-peer-deps` (the conflict was `@webpack-cli/serve` 3
  wanting webpack-cli 6). 482 packages instead of 704, 0 audit findings instead of 8. The
  `npm-shrinkwrap.json` is replaced by a committed `package-lock.json` (`.npmrc` now sets
  `package-lock = true`).
- Updated: webpack 5.112, webpack-cli 7, webpack-dev-server 6 (the dev config's `watchFiles`
  block became `static.watch.ignored`), webpack-merge 6, ts-loader 9.6, TypeScript stays 5.9,
  prettier 3 (`.prettierrc` pins `trailingComma: es5`; the reformat touched 14 files), husky 9
  (`prepare: husky`, plain `.husky/pre-commit`), typedoc 0.28 (`scripts/generate_docs.js`
  rewritten for its API), rxjs 7, mathjs 15, @turf/turf 7 (`turf.intersect` now takes a
  feature collection, `base/Collision.ts`), core-js 3.51. Node `>=20` (`.nvmrc` 22).
- `npm run site` (`scripts/build_site.js`) assembles the static site in `site/`;
  `.github/workflows/build.yml` runs format check, type-checked build and the site on every push
  and PR, uploads it as an artifact, and deploys to GitHub Pages only when started by hand with
  the deploy option (main's own workflow still publishes the legacy game there).
- Vite: not now. The build is stable on webpack 5 and the bundle is one file; revisit with the
  Phaser decision in Phase 8.
- Bundle: 3.25 MiB minified, of which lodash 533 KiB (whole-library import), turf/jsts 264 KiB
  and decimal.js (mathjs) 133 KiB. Switching to per-function lodash imports and dropping mathjs
  for the three `evaluate` calls would roughly halve it; left for later.
- Verified in Chromium after the update: title, New Game, Brindle, walking.
- Firefox and Safari: a code review (no Firefox or Safari was available here, so nothing below
  is tested in them; the first run on a real Firefox, macOS Safari and iPhone is still owed)
  found no Chrome-only API in the engine. What it found, and what was applied:
  - WebGL is required (mode7 and every filter) and Phaser throws "No fallback" without it:
    `GoldenSun` now probes for a context first and shows the `#webgl-warning` banner.
  - The debug overlay re-uploaded a texture every frame even in the shipped build:
    `Debug.set_debug_info` skips the clear when nothing is shown, and `build_site.js` sets
    `production_mode: true` in the site's `init.json` (which also turns the debug hotkeys off).
  - Phaser's Canvas2D contexts (BitmapData, TilemapLayer, Debug) carried WebGL-only options;
    they now ask for `willReadFrequently`, which keeps those canvases in CPU memory so Firefox
    and Safari don't read back from the GPU on every upload. The `animatedTiles.length` check in
    `TilemapLayer.update` compared an object's length and is now `Object.keys(...).length`.
  - GLSL: `reveal.js` used `pow` with a negative base (NaN on Metal), `levels.js` `pow(0, x)`;
    both rewritten. Every filter now asks for `highp` where `GL_FRAGMENT_PRECISION_HIGH` is
    defined, since iOS really runs `mediump` as fp16.
  - Fullscreen: `device.fullscreenKeyboard = false` (Safari rejects the numeric argument Phaser
    passes otherwise) and the fullscreen flag is read from `scale.isFullScreen`, not toggled.
  - Audio: the context is resumed on keydown / pointerdown / touchend / visibilitychange, not
    only on canvas clicks and the M key; the M handler no longer crashes without Web Audio.
  - Keys stuck down after Cmd+Tab or a hidden tab: `Gamepad.release_all()` runs on blur,
    visibilitychange and pagehide. The keyup handler wrongly marked the last input as gamepad.
  - AZERTY detection accepts any `fr*` locale. The save download attaches the anchor and
    keeps the blob URL alive; the load input is attached to the body for iOS.
  - The Firefox user-agent banner is gone; the FPS banner needs about three seconds of low FPS
    before it shows. `home.js` also prevents PageUp/PageDown and Backspace from acting on the page.
  - New for Phase 4: `Gamepad.press(button)` / `release(button)` are the way to drive the game
    from on-screen buttons (the `Button` enum is numeric: A 0, B 1, ..., LEFT 6, RIGHT 7, UP 8,
    DOWN 9); synthesised KeyboardEvents are not reliable across browsers and cannot unlock audio.
  - Left for later, with the review's pointers: battle trails read pixels back from the GPU per
    frame (`BattleAnimation.ts` ~2224, keep them in a RenderTexture); the particle plugin's pixel
    renderer calls `getImageData` per emitter per frame (`particle-storm.js` ~6046); tile layers
    redraw on the CPU each scrolling frame (bake small maps once); one Glow shader per character
    compiles on first use; `ignore_system_scaling` shrinks the canvas by the device pixel ratio
    (the shell will size the canvas instead, Phase 4); gamepads with non-standard mapping;
    `force_target_fps` (inactive) returns no RAF id. iPhone cannot play without a keyboard until
    the shell lands.
  - `static/phaser.js` is Phaser CE 2.19.0 plus about 30 upstream patches (mode7 sprite
    projection, sub-pixel camera, Tiled tile animations, object-layer format, tween/animation
    semantics, audio sprite offsets, p2 polygon bodies). Stock `phaser-ce` from npm is not a
    drop-in; `patch-package` over it, or a `phaser_patches.ts`, are the routes for Phase 8.

### Phase 4 - handheld shell (2026-10-27)

- `index.html` is now the play page: the legacy shell (frame, L / R shoulders, screen, d-pad,
  Select / Start, B / A) around the engine's `#game` div, the shell colour picker, a sound
  button, the immersive button, the key legend, and the engine's debug panels hidden under
  `#debug` (shown with `?debug=1` or the footer link). `static/site.css` / `static/site.js` are
  the legacy `assets/site.css` / `site.js`, trimmed to this page: colour theme (system until
  chosen; `localStorage` key `sunspire_theme`), shell colour (`sunspire_handheld`, same presets),
  so both choices carry over from the legacy site.
- `base/shell/HandheldShell.ts` is the engine side, created by `GoldenSun` and inactive on a page
  without `#shell`: on-screen buttons go through `Gamepad.press / release` with pointer capture
  (no synthesised key events); the screen is an integer multiple of 240x160 that fits the stage,
  or the viewport in immersive mode (`GoldenSun.set_scale_factor`), re-fitted on resize and
  orientation change; immersive mode shows the shell alone with the browser's fullscreen API when
  a gesture allows it (F key, the Immersive and Exit buttons, Esc follows fullscreen out);
  `?app=1` or a standalone display mode opens immersive at once (for Phase 7). The engine's own
  double-click fullscreen and the 1-4 zoom keys are off while the shell is active, and Phaser's
  fullscreen scale mode is `NO_SCALE` so it never resizes the canvas itself.
- `init.json`: `ignore_system_scaling` is off (the shell sizes the canvas; on a fractional device
  pixel ratio the integer CSS scale still gives slightly uneven pixels, which only a DPR-aware
  buffer size would fix).
- Verified in Chromium: desktop page at scale 2 (538 px shell), Start and A on the shell start a
  game, Ember shell and dark theme stored, immersive landscape grid at scale 2, F leaves; phone
  width (375 px) at scale 1 without horizontal overflow, portrait immersive. Not yet tried on a
  real phone: touch pointer capture, the fullscreen API from a tap, iOS safe areas.

### Phase 5 - sprite packs (2026-10-27)

- Slot granularity: sheet-level, as the plan said to do first. Every PNG under `assets/images`
  is a slot named after the file (78 today; the build script fails on a duplicate name), listed
  with size, group and frame names in `static/pack-slots.json` by
  `scripts/build_sunspire_assets.js`. Fonts and audio are not slots yet.
- `base/shell/SpritePacks.ts`: the stored pack is read from IndexedDB (`sunspire_engine_packs`
  / `sheets`) before the game is created (`GoldenSun` is now constructed from
  `SpritePacks.open()`), each sheet becomes a blob URL, and `Phaser.Loader.prototype.addToFileList`
  is wrapped so every `image`, `textureatlas` image and `bitmapfont` page whose file name is a
  covered slot loads from the pack. Import takes PNG / GIF / WebP files or a zip (stored or
  deflated entries, read with `DecompressionStream`, folders ignored); a file is accepted only if
  its name is a slot and its size equals the sheet's, otherwise it is reported and skipped.
  Accepted files are stored and take effect on the next reload; *Built-in art* clears the store.
- Page side: the *Load sprite pack* / *Built-in art* / *Pack guide* row on the play page with a
  status line; `pack-guide.html` + `static/pack-guide.js` render the slot list with a preview of
  each sheet, its size and frame names, mark the slots the stored pack covers, and copy all names.
  `packs/README.md` is rewritten for sheet slots.
- Verified in Chromium: a hue-shifted copy of `ari_field.png` was accepted, a 10x10 file for
  `wolf_battle` and a file with an unknown name were rejected with the right messages, after a
  reload Ari drew from a `blob:` URL with the new colours and the status said "Pack active",
  the guide marked `ari_field.png`, and *clear* restored the built-in art on the next reload.
- Follow-up (noted in `packs/README.md`): frame-level slots, so the legacy per-sprite packs
  (`ari_down.png` ...) work again, by stitching frames into sheets in the browser the way the
  build script does; animated GIF frames would come with that.

### Phase 6 - the content (2026-10-27/28)

- Everything the game is made of lives in `assets/sunspire/content.json` (characters, arts,
  gear, items, shops, inns, chests, spirits and their duels, summons, enemies, encounters, the
  five maps with exits, houses, signs, wells, boulder, gate, puzzle, bosses and joins, the
  villagers and their dialog, the story text and rules) and `assets/sunspire/maps/` (the tile
  grid and tileset of each map, captured from the legacy builders).
  `scripts/build_sunspire_content.js` generates every database and Tiled map from them;
  `scripts/build_walkthrough.js` generates `walkthrough.html` from the same data, so the guide
  cannot drift. Run `build_sunspire_assets.js`, then `build_sunspire_content.js`, then
  `build_walkthrough.js` (`npm run build:content`).
- How Sunspire's rules sit on the engine: characters level one by one (a member joins at the
  level the story expects: Lyn 3, Bram 5, Sera 8; exp curve from 18 + 12 x level); plain attacks
  do (atk - def) / 2, so bosses and spirit duels "shrug off steel" through a high def (ogre 30,
  wyrm 40, duels +18) while arts (`base_damage` psynergy, which ignores def) carry a flat +8 on
  their legacy power; spirits set give +4 hp, +2 pp, +1 atk, +1 def; summons are the engine's
  (power + 3% of each foe's max HP per spirit spent).
- Map objects are NPCs with events: chests (the engine's chest event for items and gear, a
  branch + `set_party_coins` for coins, storage key per chest), signs / doors / wells as an
  invisible `marker` NPC (shop, inn or a message; wells are an `event_trigger` tile that
  restores HP and PP), the boulder and the gate (branch on a flag, dialog, then the NPC is
  switched off), bosses (`battle` event; flags in `before_fade_victory_events`, the spire key
  and the ending in `all_enemies_fled_events`, which is where the engine fires post-fade
  victory events), spirits (`djinn_get` with a fight against a `duel_<id>` enemy). Party joins
  are `party_join` events: Lyn from a yes / no dialog, Bram and Sera in the map's `game_events`
  on first entry. Random encounters are one encounter zone per map (the paddock on top of the
  fields), one party per legacy group.
- The puzzle and the field art: a `loose_boulder` (pushable interactable object with
  `psynergies_info.move`) wedged in the trail's lower gap at (8,13), pushed by walking into it
  or with Ari's innate SHOVE (the engine's `move`, on the Q shortcut); its `allowed_tiles` run
  north out of the gap. The engine's push code and field-psynergy targeting are used as they
  are.
- Engine quirks met, all worked around in the generator or patched:
  - events in a list fire at once, so anything that must wait for a dialog hangs off its
    `finish_events`; a dialog inside `yes_no_events` is destroyed with its parent before it
    runs, so the whole exchange is one dialog with the question last;
  - deactivating an NPC (`set_value` with `check_npc_storage_values`) destroys its running
    events, so it is the last thing in a chain;
  - `set_value` on a storage key that does not exist aborts the rest of the chain: every flag
    is declared in `storage_db`;
  - map properties that the engine reads as strings (`background_key`) must not be JSON-encoded;
  - `is_close` uses the hero's `transition_direction`, set by walking, so NPCs are reached by
    walking into them (also what a test harness must do);
  - the hero needs `yes` and `no` actions (the nod and head shake after a yes / no answer);
  - the psynergy menu and the battle status window assumed every character has field psynergy
    and at least one spirit (`MainPsynergyMenu`, `ItemPsynergyChooseWindow`,
    `BattleStatusDjinn` guarded).
- Verified in Chromium end to end: the intro, Sorin, the coin chest, the Flint duel, the
  boulder, the exit to Brindle, Lyn's join, the mine with Bram's join, an item chest, the Maw
  Ogre and the spire key, the trail with Sera's join, the gate, the trail-to-spire exit, the
  spring, the Shadow Wyrm, the ending back in Thera, random encounters in the fields, Mara's
  shop and the farmstead inn, the push puzzle by walking and by Shove.
- Not done, left for later phases or a balance pass: height differences (Sunspire's maps are
  flat; the engine's collision layers are ready for them), battle animations beyond the
  engine's image-free attack / cure recipes, Sunspire's synthesised music and sound, the
  menu / status art the build script draws as labelled boxes, and a real balance pass of the
  engine's damage formulas against the legacy numbers (the Flint duel at level 1 is as tight as
  it was).

### Phase 7 - saves and the installable app (2026-10-28)

- Save format: the engine's own `SnapshotData` (storage flags, party, items, spirits, map,
  position, direction, encounter counter, sanctum, scale, sound) wrapped as
  `{version, saved_at, snapshot}` in one `localStorage` slot, `sunspire_engine_save`
  (`base/shell/SaveSlot.ts`). `SaveSlot.VERSION` is 1; a save of another version is ignored
  with a console warning rather than loaded. `Snapshot.build_snapshot()` is the pure part of
  the engine's save; `generate_snapshot()` (the JSON download) still exists and is the fallback
  when the browser refuses storage.
- Legacy saves (`localStorage.sunspire2` from `game.js`) are **not imported**: the shared
  party level, the chest and flag names and the engine's per-character state do not map one
  to one, and the game is a couple of hours long. The old key is left untouched for the legacy
  site.
- Autosave (`GoldenSun.autosave()`, skipped while loading, in battle or during a reveal): on
  every map change (`TeleportEvent`, after the map's events are fired), after every battle won
  (`BattleEvent`), at the inns (`InnMenu.inn_recovery`). The Start prompt ("Save your quest")
  saves to the slot and closes; the title's Continue loads the slot and falls back to the file
  picker when there is none.
- Installable app: `static/manifest.webmanifest` (start URL `/?app=1`, fullscreen, the
  Sunspire icons now under `static/icons/`, which also replaced the engine's favicon),
  Apple meta tags in `index.html`, an *Install as app* button that appears on
  `beforeinstallprompt`, and `?app=1` or a standalone display mode opening immersive play and
  resuming the slot without the title screen.
- Offline: `scripts/build_site.js` writes `site/sw.js`, which precaches every file of the
  built site (259 today, about 10 MB with the placeholder audio) under a cache named after the
  content; pages, the bundle and game data come from the network first, art, sounds and fonts
  from the cache first; a new build replaces the old cache on activation. `static/site.js`
  registers `/sw.js` (absent on the dev server, so development is never cached).
  `npm run preview` serves `site/` locally to try it.
- Verified in Chromium: autosave on arriving in Brindle, a second save from the Start prompt,
  Continue resuming at the saved tile with the flags intact, `?app=1` resuming straight into
  the immersive shell with no title screen, and the service worker installing with the whole
  site in its cache. Not verified: an actual install and offline launch on iOS and Android
  (needs HTTPS and a phone).

### Phase 8 - the Phaser decision (2026-10-28)

**Decision: stay on Phaser CE 2.19.0 (the patched copy in `static/phaser.js`). Do not port
to Phaser 3 or 4.** Revisit only if a concrete need appears that Phaser 2 cannot meet (so far
none has: the engine's own features cover everything in the plan), and then as a new engine
rather than a port.

The surface area, measured over `base/` (235 TypeScript files, 65,480 lines):

| Subsystem | What the engine uses | Phaser 3 / 4 |
|---|---|---|
| Display and rendering | `Phaser.Sprite` 207 uses, `Group` 107, `Graphics` 49, `BitmapText` 29, `TileSprite`, `BitmapData`, `game.add.*` 390 calls, `anchor` 97, `blendMode` 36, `tint` 42, `mask` 40; 30 direct `PIXI.*` uses (display-object internals) | PIXI is gone; Game Objects, origins, masks and blend modes are all different APIs |
| Filters | 123 `Phaser.Filter` uses, 13 filter classes in `assets/filters/*.js` (GLSL), applied per sprite and per layer | Phaser 3 FX pipelines, Phaser 4 a new unified filter system; every shader is rewritten |
| Physics | `game.physics.p2` throughout: 182 `.body.*` uses in 25 files, 42 direct `p2.*` calls, collision groups per map layer, polygon bodies from Tiled | p2 is not in Phaser 3 or 4 (Arcade / Matter); collision layers, bevels and polygon handling are rebuilt |
| Time, tweens, signals | `game.time.events` 56, `game.time.create` 45, `Phaser.Timer` 58, `Phaser.Easing` 186, `onComplete` 150, `Phaser.Signal` 14 | Clock, Tween Manager and EventEmitter have different shapes |
| Camera, input, sound, loader | `game.camera` 132, `game.load` 105, `game.input` 15, `game.sound` 14, audio sprites with the engine's patched offsets | all different APIs (Scenes, Loader plugin, Sound Manager) |
| Tilemaps | `Phaser.Tilemap` / `TilemapLayer` with the engine's patches: animated Tiled tiles, object layers as `{objectsData, properties}`, the Tiled 1.1 object-form properties | Phaser 3 tilemaps read modern Tiled; the engine's whole map format changes |
| The Phaser patches | ~30 upstream changes inside `static/phaser.js` (see Phase 3): the mode7 sprite projection in `WebGLSpriteBatch.render`, sub-pixel camera and display-object rounding, Tiled tile animation, tween and animation semantics, audio sprite offsets, p2 polygon bodies, `window.GoldenSun` hooks in Cache and TilemapParser | none of this exists; each is new code on a new renderer |

In short, there is no subsystem of the engine that is not built directly on Phaser 2, PIXI 2
and p2, and the features we moved here for (mode7 overworld, height layers, battle animations,
the filter effects) are the ones that sit deepest in those APIs. A port to Phaser 3 or 4 is a
rewrite of the engine: its author would be choosing an engine, not upgrading one. Phaser 4
(4.0.0 released 10 April 2026, 4.1 and 4.2 since) is a new renderer and filter model even
relative to Phaser 3, so the gap only grew.

What staying costs, and what we do about it:

- Phaser CE is community-maintained with slow releases (2.20.2 in 2024, 2.21.0 on npm now);
  there are no security surfaces in it that matter for a static game, and the browser fixes we
  needed (Phase 3) were made in our copy. The copy is pinned by being in the repo.
- The patches live inside a 3.5 MB file. The recorded route to a cleaner setup is
  `phaser-ce` from npm plus `patch-package` with a diff of our changes (Phase 3 notes); it is
  housekeeping, not a prerequisite for anything, and it is not done.
- The Phase 3 review's performance items (GPU readbacks in battle trails and the particle
  plugin, CPU tilemap redraws) are the real Firefox / Safari risk and are independent of the
  Phaser version; they stay on the list.
- The adapter-layer idea from the plan is dropped: an adapter over this many APIs would be as
  large as the engine.

### Definition of done, checked against the plan

- Runs in current Chrome, Firefox and Safari: **Chrome yes; Firefox and Safari fixed by code
  review only, never run** (needs a push and a session on each).
- No Nintendo / Camelot assets, names or data: **yes** (`ASSETS.md`; the `GoldenSun` class and
  the `djinn` / `psynergy` identifiers in code and data keys are the engine's vocabulary, not
  content).
- Sprite packs and the handheld shell work as before: **shell yes; packs are sheet-level, so
  the legacy per-sprite packs need the frame-stitching follow-up.**
- Tiled maps with height differences, puzzles, overworld, battle animations, menus, Psynergy
  and spirit usage all work in the Sunspire content: **menus, spirits (duels, set / unleash,
  summons), the Shove field art and the push puzzle yes; Tiled maps yes but Sunspire's are
  flat, so height layers are unused; no overworld (the five maps connect directly); battle
  animations are the engine's image-free recipes only.**
- Installs as a PWA, opens in immersive play and resumes: **yes in Chromium; iOS / Android
  untested.**
- CI builds and publishes the site: **builds and uploads the artifact; publishing to Pages is a
  manual run until this branch replaces `main`.**
