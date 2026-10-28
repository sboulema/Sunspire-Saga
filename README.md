# Sunspire Saga (engine build)

An original GBA-style pixel-art JRPG for the browser, being moved onto a fork of
[goldensun_html5](https://github.com/jjppof/goldensun_html5) (MIT, Phaser CE 2.19.0) for its Tiled
maps with height, puzzles, overworld, battle animations, menus and ability/spirit systems.

Sunspire Saga is an independent homage, with no assets from Nintendo or Camelot. Every sprite,
tile, name, line of dialog and number in this repository is original; `ASSETS.md` lists where each
asset comes from. The engine code keeps its MIT licence and copyright notice (`LICENSE.txt`).

**Status:** Phase 7 of the migration (see `MIGRATION.md`): the whole game is on the engine, from
Thera to the Sunspire, with every map, character, art, spirit, summon, enemy, chest, shop and
boss of the single-script game, a push puzzle and a field art; it saves in the browser, installs
as an app and plays offline. The migration plan is complete; the engine stays on Phaser CE 2.19
(Phase 8, the decision and what is still owed, is in `MIGRATION.md`). The single-script game
(`game.js`) lives on the `main` branch until the switch.

## Running it

- Node 20 or newer (`.nvmrc` says 22) and npm 10 or newer.
- `npm install`.
- `npm start` serves the game on [http://localhost:9000](http://localhost:9000) and rebuilds on
  change. Use a Chromium browser for now.
- `npm run build` type-checks and bundles for development; `npm run build_prod` makes the
  minified bundle; `npm run site` builds the static site in `site/` (what CI publishes);
  `npm run build:content` regenerates the assets, the databases, the maps and the walkthrough
  from `assets/sunspire/` (run it after any change there); `npm run format` runs Prettier over
  `base/` (the pre-commit hook does the same).
- Controls: arrows to move, **Z** = A, **X** = B, **A / S** = L / R, **Backspace** = Select,
  **Enter** = Start, **M** sound, **F** immersive mode. The handheld shell around the screen has
  the same buttons for touch; the shell colour and the light / dark theme are remembered in the
  browser. `?debug=1` shows the engine's debug panels.

## The site

| Page | What it is |
|---|---|
| `index.html` | landing page: the story, in-game screenshots, concept art and box art |
| `play.html` | the game in its handheld shell, with the immersive toggle, the sprite pack loader and the install button |
| `pack-guide.html` | the sprite pack guide with the generated slot list |
| `changelog.html` | what changed in each version |
| `walkthrough.html` | the plain-text walkthrough, generated from the game data |

Every page has the light / dark toggle and the handheld colour choice, remembered in the browser.
The nginx config in `docker/` serves clean URLs (`/play`), and `npm run preview` does the same
locally; the pages link to each other with `.html` so they also work from a plain static host.

## Saving and installing

The game autosaves to the browser on every map change, after battles and at the inns, and Start
saves on demand; *Continue* on the title screen resumes it. The site is a progressive web app:
`static/manifest.webmanifest` and the service worker written by the site build cache every file,
so the installed app launches straight into the saved game, full screen, and works offline.
Browsers that support installing show an *Install as app* button under the shell (iOS uses *Add
to Home Screen* in Safari's share sheet). Installing needs HTTPS or `localhost`; `npm run site`
then `npm run preview` tries it locally on port 9100.

## Layout

| Path | What |
|---|---|
| `base/` | the engine, TypeScript (entry `base/GoldenSun.ts`; the class name is kept for now) |
| `base/shell/HandheldShell.ts`, `index.html`, `static/site.css`, `static/site.js` | the handheld shell: on-screen buttons, integer scaling, immersive mode; the page's theme and shell colour |
| `base/shell/SpritePacks.ts`, `pack-guide.html`, `static/pack-guide.js`, `static/pack-slots.json`, `packs/README.md` | sprite packs: sheets the player loads (PNG / GIF / WebP or a zip) replace the built-in art; the guide lists every slot |
| `assets/sunspire/content.json` | **the game**: characters, arts, gear, items, shops, chests, spirits, summons, enemies, encounters, maps, villagers, dialog and story. Edit this, not the databases. |
| `assets/sunspire/` | Sunspire's source art: the exported sprites, the five map grids and tilesets, the 5x5 font glyphs |
| `assets/dbs/`, `assets/maps/`, `walkthrough.html` | **generated** from `content.json` by the scripts below (`misc_animations_db`, `interactable_objects_db`, the battle recipes and `init.json` are hand-written) |
| `scripts/build_sunspire_assets.js` | generates `assets/images`, `assets/font`, `assets/sounds`, `bgm_db` / `se_db` and the pack slot list from `assets/sunspire/` |
| `scripts/build_sunspire_content.js` | generates the databases and the Tiled maps from `content.json` and the map grids |
| `scripts/build_walkthrough.js` | generates `walkthrough.html`, the plain-text walkthrough, from the same data |
| `scripts/build_site.js`, `scripts/serve_site.js` | assembles `site/` with its service worker; serves it locally (`npm run preview`) |
| `base/shell/SaveSlot.ts` | the versioned browser save slot |
| `static/manifest.webmanifest`, `static/icons/` | the web app manifest and icons |
| `.github/workflows/build.yml` | CI: format check, build, site artifact; deploys to GitHub Pages only when run by hand with the deploy option |
| `.github/workflows/publish.yml`, `Dockerfile`, `docker/nginx.conf` | on `main` and `vNN` tags: the site as a Docker image (GHCR, optionally Docker Hub) and a zip, with a GitHub Release on tags |
| `tools/` | the logo / icon generator, the favicon builder and the pack zipper |
| `assets/art/`, `assets/screens/` | the box art, concept sheets, hero portraits and screenshots on the landing page |
| `assets/filters/`, `assets/plugins/` | WebGL filters and the particle plugin the engine ships with |
| `static/` | Phaser, the site shell and the debug editor |
| `MIGRATION.md` | the migration plan, decisions and phase log |
| `ASSETS.md` | origin and licence of every asset |

Engine documentation: the upstream [wiki](https://github.com/jjppof/goldensun_html5/wiki)
(database configuration, tutorials) and [API docs](https://gshtml5.org/docs/); `npm run docs`
generates the latter locally. Learn Phaser 2 from its
[examples](https://phaser.io/examples/v2) and [API](https://photonstorm.github.io/phaser-ce/index.html).

## Credits

- Engine: [goldensun_html5](https://github.com/jjppof/goldensun_html5) by jjppof and contributors, MIT.
- [Phaser CE](https://github.com/photonstorm/phaser-ce), MIT.
- Game, art, data and text: Sunspire Saga.
