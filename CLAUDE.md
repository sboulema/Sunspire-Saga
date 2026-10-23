# Sunspire Saga

A browser JRPG in one script, `game.js`. The site around it is `index.html`, `play.html`,
`pack-guide.html` and `changelog.html`; `README.md` describes the layout.

## Keep the walkthrough in sync with the game

`walkthrough.txt` is a classic plain-text FAQ/walkthrough whose every number and position is
taken from the data in `game.js`. **Any change to the game that a player could notice must be
reflected in `walkthrough.txt` in the same change.** That includes, but is not limited to:

- maps and map builders (`build*` functions, `TRANS`): redraw the affected ASCII map in section 7
  and fix every coordinate that moved (chests, spirits, bosses, villagers, doors, exits, the well
  and spring, safe lanes);
- `CHEST_DEFS` (section 10 and the per-area lists), `SPIRIT_DEFS` / `SPIRIT_ORDER` (section 8),
  `SUMMON_DEFS` (section 9), `ENEMY_DEFS` / `ENC` (section 13 and the per-area enemy lists),
  `CHAR_DEFS` / `ART_DEFS` (sections 5.3 and 6), `GEAR_DEFS` / `ITEM_DEFS` / `SHOPS` (sections 11
  and 12);
- battle rules and formulas (damage, set bonus, stagger, flee chance, encounter rate, PP regen,
  XP curve, boss behaviour): sections 5 and the boss strategies in 7.8 and 7.11;
- story flow, who joins where, key items, dialogue hints, controls and the menu: sections 3, 4
  and the walkthrough steps;
- `GAME_VERSION`: update the "Game version" line in the header, bump the guide version, set the
  "Last updated" date and add a line to the guide's version history (section 2).

When a change is bigger than a number, re-check the recommended levels and the boss plans still
hold against the formulas in section 5.9. Keep the file at 79 columns or narrower, plain ASCII,
and keep the section codes (`[WLK07]` etc.) stable so Find still works.

The ASCII maps in the walkthrough can be regenerated from the builders: extract `h32`, `makeGrid`,
`house`, the `build*` functions and `TRANS` from `game.js` into a Node script and print each grid
with the legend from section 7 (`f`→`.`, `e`→`:`, `R`/`Q`/`W`→`H`, `B`→`O`, `E`→`>`, `C`→`^`,
`G`→`=`, chests numbered, spirits `*`, bosses `X`, villagers `@`).
