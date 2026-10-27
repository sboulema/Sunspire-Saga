# Sunspire Saga (engine build)

An original GBA-style pixel-art JRPG for the browser, being moved onto a fork of
[goldensun_html5](https://github.com/jjppof/goldensun_html5) (MIT, Phaser CE 2.19.0) for its Tiled
maps with height, puzzles, overworld, battle animations, menus and ability/spirit systems.

Sunspire Saga is an independent homage, with no assets from Nintendo or Camelot. Every sprite,
tile, name, line of dialog and number in this repository is original; `ASSETS.md` lists where each
asset comes from. The engine code keeps its MIT licence and copyright notice (`LICENSE.txt`).

**Status:** Phase 2 of the migration (see `MIGRATION.md`). The engine boots on a placeholder set
of Sunspire content: the town of Brindle, its shop and inn, four villagers and a Fang Wolf battle.
The finished game (`game.js`, one script with no build step) lives on the `main` branch until the
port catches up with it.

## Running it

- Node 20 or newer (`.nvmrc` says 22) and npm 10 or newer.
- `npm install`.
- `npm start` serves the game on [http://localhost:9000](http://localhost:9000) and rebuilds on
  change. Use a Chromium browser for now.
- `npm run build` type-checks and bundles for development; `npm run build_prod` makes the
  minified bundle; `npm run site` builds the static site in `site/` (what CI publishes);
  `npm run build:assets` regenerates the game assets from `assets/sunspire/`; `npm run format`
  runs Prettier over `base/` (the pre-commit hook does the same).
- Controls: arrows to move, **Z** = A, **X** = B, **A / S** = L / R, **Backspace** = Select,
  **Enter** = Start. **M** unmutes.

## Layout

| Path | What |
|---|---|
| `base/` | the engine, TypeScript (entry `base/GoldenSun.ts`; the class name is kept for now) |
| `assets/dbs/` | the game data: characters, classes, abilities, items, enemies, spirits (`djinni_db`), summons, maps, NPCs, shops, inn, dialog, audio |
| `assets/sunspire/` | Sunspire's source art: the exported sprites, the Brindle tileset and grid, the 5x5 font glyphs |
| `scripts/build_sunspire_assets.js` | generates `assets/images`, `assets/maps`, `assets/font` and `assets/sounds` (plus `bgm_db` / `se_db`) from `assets/sunspire/`; run it after changing the source art |
| `scripts/build_site.js` | copies the page, bundle, assets and static files into `site/` |
| `.github/workflows/build.yml` | CI: format check, build, site artifact; deploys to GitHub Pages only when run by hand with the deploy option |
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
