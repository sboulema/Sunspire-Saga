<p align="center"><img src="assets/sunspire-logo-512.png" width="160" alt="Sunspire Saga logo"></p>

# Sunspire Saga

An original GBA-style pixel-art JRPG that runs in the browser, in a single HTML file. Gather eight
elemental spirits, master arts and summons, and bring the dawn back to the Sunspire.

**[Play it here](https://YOUR-GITHUB-USER.github.io/sunspire-saga/)** · no install, no build step, saves in your browser.

![Title card](assets/sunspire-card.png)

## Features

- Four adepts of earth, fire, water and wind, each with their own arts; a party of up to four.
- Eight spirits to duel and recruit; set them for stat bonuses, unleash them in battle, then call the
  great summons – up to the four-element Sol Avatar – with their own cutscenes.
- Overworld with towns, shops, an inn, treasure, a mine, a mountain trail and the Sunspire itself.
- Turn-based battles with an icon toolbar, hidden enemy HP, attack / cast / hit / downed poses, and
  bosses that shrug off plain steel – levelling, arts, spirits and potions all matter.
- **Sprite packs**: every sprite, tile, background and icon can be replaced with your own art, loaded
  locally as PNG/GIF/WebP files or a zip. See [packs/README.md](packs/README.md).
- Everything in one `index.html` (~250 KB). Hand-pixeled art, 5×5 bitmap font, WebAudio sound.

## Playing locally

Open `index.html` in a browser. If your browser blocks storage for `file://` pages (saves and
sprite packs use localStorage / IndexedDB), serve the folder instead, for example:

```bash
npx serve .
```

Controls: arrow keys or WASD to move, **Z / Space** = A (confirm), **X / Esc** = B (cancel),
**Enter** = Start / menu, **M** toggles sound. The handheld shell around the screen has clickable
D-pad, A, B and Start buttons for touch play.

## Hosting

The repo is laid out for GitHub Pages: enable Pages for the `main` branch, root folder, and the
game is live at `https://<user>.github.io/sunspire-saga/`. Then replace `YOUR-GITHUB-USER` in the
two social-card URLs in the `<head>` of `index.html` (and in this README) so link previews show
`assets/sunspire-card.png`. Alternatively copy `index.html` and `assets/` to any static host.
A workflow for Pages deployment via Actions is included in `.github/workflows/pages.yml` if you
prefer that over branch deployment.

## Repository layout

| Path | What it is |
|---|---|
| `index.html` | the whole game – source and distribution in one file |
| `assets/` | logo, social card, favicon |
| `packs/` | how to make and share sprite packs |
| `tools/` | generators for the logo, card and favicon |

Releases are tagged (`v34`, …); the in-game **changelog** button is the authoritative change list,
and the title screen shows the running version.

## Credits and licence

Code and art are original work, released under the [MIT licence](LICENSE). Sunspire Saga is an
independent homage to the handheld JRPGs of the early 2000s; it is not affiliated with or endorsed
by Nintendo or Camelot and contains no assets from their games.
