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

### Phases 4-8

Unchanged from the plan: handheld shell, sprite packs, content port, saves and PWA, then the
Phaser upgrade decision.
