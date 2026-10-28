// Builds the engine's game databases and the Tiled maps from Sunspire's content
// (assets/sunspire/content.json) and the captured map grids (assets/sunspire/maps/<id>_grid.json).
//
//   node scripts/build_sunspire_content.js
//
// Written here: abilities, items, classes, main_chars, npc, enemies, enemies_parties, djinni,
// summons, maps, shops, shopkeep_dialog, inn and storage databases, and assets/maps/<id>/<id>.json.
// misc_animations_db, interactable_objects_db, bgm_db and se_db are not touched. Run
// build_sunspire_assets.js first: the sprite sheets referenced here come from it.
//
// How Sunspire's rules map onto the engine:
// - the engine levels characters one by one, so a member joins at the level the party should
//   have by then (starting_level) instead of the shared party level;
// - plain attacks do max(0, atk - def) / 2, so bosses and spirits "shrug off steel" through a
//   high def; psynergy ignores def, so arts get a flat bonus on top of their power;
// - spirits on the map are djinn NPCs with a fight first; chests, signs, doors, the boulder,
//   the gate and the bosses are NPCs with events; story flags live in storage.
const fs = require("fs");
const path = require("path");
const png = require("./png.js");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "assets/sunspire");
const DBS = path.join(ROOT, "assets/dbs");
const C = JSON.parse(fs.readFileSync(path.join(SRC, "content.json"), "utf8"));
const EL = C.elements; // sunspire element -> engine element
const ALL_ELEMENTS = ["venus", "mercury", "mars", "jupiter"];
const T = 16;
const ART_BONUS = 8; // what atk/2 + level - def is worth, on average, in the legacy art formula
const JOIN_LEVEL = {ari: 1, lyn: 3, bram: 5, sera: 8};
const BOSS_DEF = {ogre: 30, wyrm: 40};
const DUEL_DEF_BONUS = 18;

function writeJson(file, obj) {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(obj, null, 4) + "\n");
}
const db = (name, obj) => writeJson(path.join(DBS, name + "_db.json"), obj);
const sheet = (dir, id) => ({image: `assets/images/spritesheets/${dir}/${id}.png`, json: `assets/images/spritesheets/${dir}/${id}.json`});
const say = lines => lines.join("${BREAK}");
const elemObj = (fn = () => 0) => Object.fromEntries(ALL_ELEMENTS.map(e => [e, fn(e)]));
const levels = n => Array.from({length: n}, (_, i) => i);

// ---------------- events ----------------
const ev = {
    dialog: (lines, extra = {}) => ({type: "dialog", dialog_info: {text: say(lines)}, ...extra}),
    set: (key, value, extra = {}) => ({type: "set_value", event_value: {type: "storage", value: {key_name: key, value}}, ...extra}),
    setNpc: (key, value, label) => ev.set(key, value, {check_npc_storage_values: true, npc_label: label}),
    branch: (key, value, events, else_events, condition = "=") => ({
        type: "branch",
        comparator_pairs: [{condition, left_comparator_value: {type: "storage", value: {key_name: key}}, right_comparator_value: {type: "value", value}}],
        events,
        else_events: else_events || [],
    }),
    coins: amount => ({type: "set_party_coins", control_type: "increment", amount}),
    heal: () => [
        {type: "set_char_hp_pp", char_key: "all", points_type: "hp", value: "full"},
        {type: "set_char_hp_pp", char_key: "all", points_type: "pp", value: "full"},
    ],
    teleport: (map, x, y, direction) => ({type: "teleport", target_map_key: map, target_tile_position: {x, y}, target_collision_layer: 0, target_direction: direction, fade_color: "0x0"}),
};

// ---------------- abilities ----------------
const BASE_ABILITY = {description: "", type: "utility", element: "no_element", battle_target: "user", range: 1, pp_cost: 0, ability_power: 0, effects_outside_battle: false, is_battle_ability: true, is_field_psynergy: false, effects: [], ability_category: "normal", battle_animation_key: "no_animation", priority_move: false, msg_type: "cast"};
const ability = (key_name, name, over) => ({key_name, name, ...BASE_ABILITY, ...over});
const abilities = [
    ability("attack", "Attack", {type: "added_damage", battle_target: "enemy", battle_animation_key: "attack", has_animation_variation: true, has_critical: true, crit_mult_factor: 1.25, can_switch_to_unleash: true, can_be_evaded: true, msg_type: "attack"}),
    ability("defend", "Defend", {msg_type: "defend"}),
    ability("set_djinn", "Set spirit", {effects: [{type: "set_djinn", usage: "on_use"}], ability_category: "djinn", msg_type: "set_djinn"}),
    ability("flee", "Flee", {type: "effect_only", battle_animation_key: "flee", ability_category: "skill", msg_type: "no_msg", affects_downed: false}),
];
// battle effects of the damaging arts: particle recipes for the engine's animation player, one per
// art, written to assets/dbs/abilities_animations (the attack, jump and cure recipes are hand-written)
const ART_FX = {
    earth: {main: [205, 160, 70], core: "rgba(255,240,200,0.85)"},
    fire: {main: [255, 130, 50], core: "rgba(255,240,160,0.9)"},
    water: {main: [110, 180, 255], core: "rgba(235,250,255,0.9)"},
    wind: {main: [205, 160, 255], core: "rgba(255,255,220,0.9)"},
};
const ART_STYLE = {
    quake: {from: "ground", lift: -12, zone: ["line", 44], total: 18, repeat: 2, size: 5, shake: "x"},
    spire: {from: "above", lift: 0, zone: ["circle", 10], total: 14, repeat: 2, size: 5},
    gaia_blade: {from: "ground", lift: -40, zone: ["line", 64], total: 24, repeat: 2, size: 6},
    flare: {from: "target", lift: -30, zone: ["circle", 12], total: 16, repeat: 2, size: 5},
    fire_bomb: {from: "target", lift: -36, zone: ["circle", 18], total: 24, repeat: 2, size: 6, shake: "y"},
    inferno: {from: "ground", lift: -44, zone: ["line", 72], total: 30, repeat: 3, size: 6, shake: "x"},
    ice_horn: {from: "ground", lift: -26, zone: ["line", 20], total: 16, repeat: 2, size: 4, rect: true},
    gust: {from: "left", lift: 0, zone: ["line", 10], total: 20, repeat: 3, size: 4},
    plasma: {from: "target", lift: -10, zone: ["circle", 18], total: 18, repeat: 3, size: 4, blink: true},
    bolt: {from: "above", lift: 0, zone: ["line", 6], total: 14, repeat: 2, size: 4, rect: true, blink: true},
};
function artRecipe(key, el) {
    const col = ART_FX[el];
    const style = ART_STYLE[key] || {from: "target", lift: -20, zone: ["circle", 10], total: 14, repeat: 2, size: 5};
    // where the particles spawn: the ground line under the target, above it, on it, or to its left
    const origin = {ground: {x: "targets", y: 135}, above: {x: "targets", y: "targets", shift_y: -80}, target: {x: "targets", y: "targets"}, left: {x: "targets", y: "targets", shift_x: -60}}[style.from];
    const spawn = style.zone[0] === "line" ? {type: "line", points: [{x: -style.zone[1], y: 0}, {x: style.zone[1], y: 0}]} : {type: "circle", radius: style.zone[1]};
    const recipe = {key_name: key, cast_type: "psynergy_cast", wait_for_cast_animation: true,
        particles_sequence: [{
            data: {energy: {red: col.main[0], green: col.main[1], blue: col.main[2], lifespan: 450, alpha: 0.85, target: {x: "targets", y: "targets", shift_x: style.from === "left" ? 40 : 0, shift_y: style.lift, zone_key: "hit_zone"}}},
            zones: {hit_zone: {type: "circle", radius: 6}, spawn_zone: spawn},
            emitters: [{...origin, position: "over", render_type: "pixel", show_trails: true, trails_clear_factor: 0.2, pixel_size: style.size, pixel_reducing_factor: 0.04, pixel_is_rect: !!style.rect, particles_display_blend_mode: "screen", render_white_core: true, core_custom_color: col.core, total: style.total, repeat: style.repeat, frequency: 40, random_in_zone: true, emitter_data_key: "energy", zone_key: "spawn_zone"}],
            emission_finish: 900,
        }]};
    if (style.shake) recipe.shake_sequence = [{start_delay: 500, sprite_index: "targets", ignore_if_dodge: true, ignore_if_no_effect: false, interval: 40, direction: style.shake, shake_count: 6, intensity: 3, random_delta: 1}];
    if (style.blink) recipe.blink_sequence = [{sprite_index: "targets", start_delay: 470, count: 2, interval: 100, duration: 300}];
    return recipe;
}
const ELEMENT_ART = {earth: "quake", fire: "flare", water: "ice_horn", wind: "gust"}; // the spirits' attacks borrow the element's first art
// a hand-written recipe under assets/sunspire/recipes/<art>_db.json wins over the generated one
for (const [key, a] of Object.entries(C.arts)) {
    const own = path.join(SRC, "recipes", key + "_db.json");
    if (!a.heal) writeJson(path.join(DBS, "abilities_animations", key + "_db.json"), fs.existsSync(own) ? JSON.parse(fs.readFileSync(own, "utf8")) : artRecipe(key, a.el));
    abilities.push(
        a.heal
            ? ability(key, a.name, {description: a.desc, type: "healing", element: EL[a.el], battle_target: "ally", pp_cost: a.cost, ability_power: a.heal, effects_outside_battle: true, ability_category: "psynergy", battle_animation_key: "cure"})
            : ability(key, a.name, {description: a.desc, type: "base_damage", element: EL[a.el], battle_target: "enemy", range: a.aoe ? 11 : 1, pp_cost: a.cost, ability_power: a.pow + ART_BONUS, ability_category: "psynergy", battle_animation_key: key})
    );
}
// field arts are the engine's built-in field psynergy under Sunspire names (the key stays the engine's)
for (const [key, a] of Object.entries(C.field_arts)) {
    abilities.push(ability(key, a.name, {description: a.desc, element: EL[a.el], battle_target: "no_target", pp_cost: a.cost, is_battle_ability: false, is_field_psynergy: true, msg_type: "no_msg"}));
}
for (const [key, s] of Object.entries(C.spirits)) {
    abilities.push(
        s.heal
            ? ability(key, s.name, {description: s.desc, type: "healing", element: EL[s.el], battle_target: "ally", ability_power: 60, ability_category: "djinn", battle_animation_key: "cure", msg_type: "unleash"})
            : s.healAll
            ? ability(key, s.name, {description: s.desc, type: "healing", element: EL[s.el], battle_target: "ally", range: 11, ability_power: 45, ability_category: "djinn", battle_animation_key: "cure", msg_type: "unleash"})
            : ability(key, s.name, {description: s.desc, type: "base_damage", element: EL[s.el], battle_target: "enemy", range: s.aoe ? 11 : 1, ability_power: s.pow + ART_BONUS, ability_category: "djinn", msg_type: "unleash", battle_animation_key: ELEMENT_ART[s.el]})
    );
}
for (const s of C.summons) {
    abilities.push(ability(s.key, s.name, {description: `The great ${s.el} summon.`, type: "summon", element: s.el === "sol" ? "all_elements" : EL[s.el], battle_target: "enemy", range: 11, ability_power: s.pow, ability_category: "summon", msg_type: "summon"}));
}
for (const [key, it] of Object.entries(C.items)) {
    abilities.push(
        it.revive
            ? ability(key, it.name, {description: it.desc, type: "healing", battle_target: "ally", ability_power: 60, effects_outside_battle: true, ability_category: "item", battle_animation_key: "cure", msg_type: "use", affects_downed: true})
            : it.pp
            ? ability(key, it.name, {description: it.desc, type: "healing", battle_target: "ally", ability_power: it.pp, effects_outside_battle: true, ability_category: "item", battle_animation_key: "cure", msg_type: "use", affects_pp: true})
            : ability(key, it.name, {description: it.desc, type: "healing", battle_target: "ally", ability_power: it.heal, effects_outside_battle: true, ability_category: "item", battle_animation_key: "cure", msg_type: "use"})
    );
}
db("abilities", abilities);

// ---------------- items ----------------
const BASE_ITEM = {curses_when_equipped: false, cant_be_removed: false, rare_item: false, important_item: false, carry_up_to_30: false, effects: [], element: "no_element", unleash_ability: "", unleash_rate: 0, use_ability: "", equipable_chars: [], granted_ability: ""};
const items = [];
for (const [key, it] of Object.entries(C.items)) {
    items.push({key_name: key, name: it.name, type: "general_item", description: it.desc, use_type: "single_use", ...BASE_ITEM, carry_up_to_30: true, use_ability: key, price: it.price});
}
for (const [key, g] of Object.entries(C.gear)) {
    items.push({key_name: key, name: g.name, type: g.kind === "wpn" ? "weapons" : "armor", description: g.desc, use_type: "no_use", ...BASE_ITEM, effects: [g.kind === "wpn" ? {type: "attack", quantity: g.atk, operator: "plus"} : {type: "defense", quantity: g.def, operator: "plus"}], equipable_chars: C.party_order, price: g.price});
}
items.push({key_name: "compass", name: "Lyn's Compass", type: "general_item", description: "Lyn's scouting compass, lost in the paddock.", use_type: "no_use", ...BASE_ITEM, important_item: true, price: 0});
db("items", items);

// ---------------- classes and characters ----------------
const CLASS_TYPE = {venus: 1, mercury: 2, mars: 3, jupiter: 4};
db("classes", {
    class_table: elemObj(primary => elemObj(() => CLASS_TYPE[primary])),
    classes: Object.entries(C.chars).map(([id, ch]) => ({
        key_name: `${ch.el}_adept`, name: `${ch.el[0].toUpperCase()}${ch.el.slice(1)} Adept`, required_level: elemObj(),
        hp_boost: 1.0, pp_boost: 1.0, atk_boost: 1.0, def_boost: 1.0, agi_boost: 1.0, luk_boost: 1.0,
        ability_level_pairs: ch.arts.map(([art, level]) => ({ability: art, level})), class_type: CLASS_TYPE[EL[ch.el]],
    })),
});
const xpNext = lv => 18 + 12 * lv;
const expCurve = levels(C.rules.max_level).map(i => levels(i).reduce((sum, l) => sum + xpNext(l + 1), 0));
const curve = (base, grow) => levels(C.rules.max_level).map(i => base + grow * i);
db("main_chars", Object.entries(C.chars).map(([id, ch]) => ({
    key_name: id, name: ch.name,
    hp_curve: curve(ch.base.hp, ch.grow.hp), pp_curve: curve(ch.base.pp, ch.grow.pp), atk_curve: curve(ch.base.atk, ch.grow.atk),
    def_curve: curve(ch.base.def, ch.grow.def), agi_curve: curve(ch.base.agi, ch.grow.agi), luk_curve: curve(3, 0), exp_curve: expCurve,
    starting_level: JOIN_LEVEL[id],
    base_level: elemObj(e => (e === EL[ch.el] ? 1 : 0)), base_power: elemObj(() => 100), base_resist: elemObj(() => 100),
    innate_abilities: Object.keys(C.field_arts).filter(k => C.field_arts[k].char === id), in_party: id === "ari", battle_scale: 1.0, battle_shadow_key: "00", status_sprite_shift: 15,
    djinn: [],
    items: id === "ari" ? [{key_name: "wood", quantity: 1, equipped: true}, {key_name: "herb", quantity: 3}] : [],
    battle_animations_variations: {},
    weapons_sprites: {sword: {spritesheet: sheet("battle", `${id}_battle`)}},
})));

// ---------------- spirits and summons ----------------
db("djinni", C.spirit_order.map(id => ({key_name: id, name: C.spirits[id].name, description: C.spirits[id].desc, element: EL[C.spirits[id].el], ability_key_name: id, hp_boost: 4, pp_boost: 2, atk_boost: 1, def_boost: 1, agi_boost: 0, luk_boost: 0})));
db("summons", C.summons.map(s => ({key_name: s.key, available: true, requirements: s.el === "sol" ? elemObj(() => 1) : elemObj(e => (e === EL[s.el] ? s.need : 0))})));

// ---------------- enemies ----------------
const BATTLE_ANIMS = ["idle_back", "idle_front", "attack_back", "attack_front", "damage_back", "damage_front", "attack_init_back", "attack_init_front", "cast_back", "cast_front", "cast_init_back", "cast_init_front"];
const enemy = (key, sprite, e, over) => ({
    key_name: key, name: e.name, level: 1, turns: e.double ? 2 : 1, max_hp: e.hp, max_pp: 0, hp_recovery: 0, pp_recovery: 0,
    atk: e.atk, def: e.def, agi: e.agi, luk: 3, battle_scale: 1.0, battle_shadow_key: "01", status_sprite_shift: 12,
    defeat_voice: "monster_defeat/monster_1", items: [], abilities: [{key_name: "attack", use_weight: 1.0}], vulnerabilities: [],
    coins_reward: e.gold, item_reward: e.drop ? e.drop[1] : "", item_reward_chance: e.drop ? e.drop[2] : 0, exp_reward: e.xp,
    base_level: elemObj(() => 1), base_power: elemObj(() => 100), base_resist: elemObj(() => 100),
    battle_animations_variations: {attack: "attack"},
    battle_spritesheet: {spritesheet: sheet("battle", `${sprite}_battle`), animations: BATTLE_ANIMS, frames_count: BATTLE_ANIMS.map(() => 1), frame_rate: BATTLE_ANIMS.map(a => (a.startsWith("attack_") && !a.startsWith("attack_init") ? 6 : 1)), loop: BATTLE_ANIMS.map(a => a.startsWith("idle"))},
    ...over,
});
const enemies = Object.entries(C.enemies).map(([key, e]) => enemy(key, key, e, e.boss ? {def: BOSS_DEF[key], level: 10, battle_shadow_key: "01"} : {}));
for (const id of C.spirit_order) {
    const d = C.spirit_duels[id];
    enemies.push(enemy(`duel_${id}`, `djinn_battle_${id}`, {...d, name: C.spirits[id].name, double: d.double}, {def: d.def + DUEL_DEF_BONUS, level: 5}));
}
db("enemies", enemies);

const parties = [];
const partyKey = {};
for (const [zone, enc] of Object.entries(C.encounters)) {
    partyKey[zone] = [];
    enc.groups.forEach((group, i) => {
        const key = `${zone}_${i + 1}`;
        partyKey[zone].push(key);
        const counts = {};
        group.forEach(k => (counts[k] = (counts[k] || 0) + 1));
        parties.push({key_name: key, name: group.map(k => C.enemies[k].name).join(" and "), can_escape: true, members: Object.entries(counts).map(([k, n]) => ({key: k, min: n, max: n}))});
    });
}
for (const id of C.spirit_order) parties.push({key_name: `duel_${id}`, name: `${C.spirits[id].name} the spirit`, can_escape: false, members: [{key: `duel_${id}`, min: 1, max: 1}]});
for (const key of Object.keys(C.enemies).filter(k => C.enemies[k].boss)) parties.push({key_name: `boss_${key}`, name: C.enemies[key].name, can_escape: false, members: [{key, min: 1, max: 1}]});
db("enemies_parties", parties);

// ---------------- shops and inns ----------------
const SHOP_LINES = {
    thera: {welcome: "Blades, mail and herbs - dawn prices, dear. What'll it be?", goodbye: "Mind the tall grass, dear!", artifacts: "Nothing rare this week, dear."},
    brindle: {welcome: "Iron from our own seams. Best gear north of Thera. What'll it be?", goodbye: "Mind the ogre in the east gallery!", artifacts: "Rare finds from the mine. Have a look."},
};
const shopkeep = (key, l) => ({key_name: key, messages: [
    {key: "welcome", text: l.welcome}, {key: "artifacts_menu", text: l.artifacts}, {key: "repair_menu", text: "Bent your blade? Hand it over."},
    {key: "buy_select", text: "Pick what you need."}, {key: "sell_select", text: "What are you selling?"}, {key: "repair_select", text: "Which piece needs fixing?"},
    {key: "character_select", text: "Who is it for?"}, {key: "equip_now", text: "Want ${HERO} to equip the ${ITEM} right away?"}, {key: "cant_equip", text: "${HERO} can't use the ${ITEM}."},
    {key: "equip_compliment", text: "Suits ${HERO} well."}, {key: "buy_quantity", text: "How many?"}, {key: "inventory_full", text: "${HERO} can't carry any more."},
    {key: "stack_full", text: "${HERO} already has as many ${ITEM} as one can carry."}, {key: "after_buy", text: "Anything else?"}, {key: "sell_equipped_cursed", text: "That ${ITEM} is cursed. I won't touch it."},
    {key: "sell_follow_up", text: "Anything else to sell?"}, {key: "sell_quantity_select", text: "How many ${ITEM}?"}, {key: "sell_quantity_confirm", text: "I'll give you ${PRICE} coins. Deal?"},
    {key: "sell_current", text: "I'll give you ${PRICE} coins for that ${ITEM}. Deal?"}, {key: "sell_normal", text: "I'll give you ${PRICE} coins for the ${ITEM}. Deal?"}, {key: "sell_artifact", text: "A rare one! ${PRICE} coins for the ${ITEM}. Deal?"},
    {key: "cant_sell_important", text: "You'll want to keep that ${ITEM}."}, {key: "cant_sell_equipped_cursed", text: "That ${ITEM} won't come off. I can't buy it."}, {key: "decline_sell_normal", text: "Keeping it, then."},
    {key: "decline_sell_artifact", text: "Hold on to it, then."}, {key: "after_sell_normal", text: "Thanks. Anything else?"}, {key: "after_sell_artifact", text: "I'll put that on the shelf. Anything else?"},
    {key: "game_ticket", text: "You've earned a lottery ticket!"}, {key: "game_ticket_select", text: "Want to try your luck?"}, {key: "game_ticket_decline", text: "Maybe next time."},
    {key: "repair_decline", text: "Leave it as it is, then."}, {key: "cant_repair", text: "Nothing here needs mending."}, {key: "repair_deal", text: "I can fix the ${ITEM} for ${PRICE} coins. Deal?"},
    {key: "repair_deal_accept", text: "Come back in a while and it'll be done."}, {key: "repair_deal_decline", text: "Suit yourself."}, {key: "repair_done", text: "Here's your ${ITEM}, good as new."},
    {key: "repair_follow_up", text: "Anything else to fix?"}, {key: "cancel_option", text: "Changed your mind?"}, {key: "not_enough_coins", text: "That's not enough coin for that."},
    {key: "no_artifacts", text: "No rare finds this week. Try again later."}, {key: "goodbye", text: l.goodbye},
]});
db("shops", Object.entries(C.shops).map(([key, s]) => ({key_name: key, dialog_key: key, shop_type: "general_shop", item_list: s.stock.map(([, k]) => ({key_name: k, quantity: -1}))})));
db("shopkeep_dialog", Object.keys(C.shops).map(key => shopkeep(key, SHOP_LINES[key])));
db("inn", Object.entries(C.inns).map(([id, inn]) => ({inn_id: id, cost: inn.cost, messages: {
    welcome_message: `Welcome to the ${inn.name}.`, price_message: "Twelve coins for warm beds and a hot meal. Will you stay?", cancel_message: "Suit yourself. Mind the roads.",
    stay_message: "Sleep well. The party sleeps deep and dreamless.", goodbye_message: "Morning! HP and PP restored. Off you go.", not_enough_coins: "A warm bed is 12 coins. Come back when your purse agrees.",
}})));

// ---------------- storage ----------------
const storage = {intro_done: false, compass: false, boulder_gone: false, gate_open: false, spire_key: false, boss_down: false, lyn_joined: false, bram_joined: false, sera_joined: false, spirits_found: 0, boss_ogre_alive: true, boss_wyrm_alive: true};
for (const id of C.spirit_order) {
    storage[`spirit_${id}_free`] = true;
    storage[`spirit_${id}`] = false;
}

// ---------------- npc database ----------------
const DIRS8 = ["down", "up", "left", "right", "down_left", "down_right", "up_left", "up_right"];
const fieldActions = (id, walks) => {
    const actions = {idle: {frame_rate: 1, animations: DIRS8, frames_count: 1, initial_animation: "down", loop: true, spritesheet: sheet("field", `${id}_field`)}};
    if (walks) actions.walk = {frame_rate: 6, animations: DIRS8, frames_count: 2, initial_animation: "down", loop: true, spritesheet: sheet("field", `${id}_field`)};
    return actions;
};
const BATTLE_CHAR_ANIMS = ["attack_back", "attack_front", "idle_back", "idle_front", "cast_back", "cast_front", "cast_init_back", "cast_init_front", "damage_back", "damage_front", "downed_back", "downed_front", "attack_init_back", "attack_init_front"];
const npcs = [];
for (const [id, ch] of Object.entries(C.chars)) {
    npcs.push({key_name: id, anchor_y: 0.8, initial_action: "idle", collision_body_bevel: 3, interaction_pattern: "cross", body_radius: 7.0, walk_speed: 70, dash_speed: 100, climb_speed: 50, voice_key: ch.voice, actions: {
        ...fieldActions(id, true),
        dash: {frame_rate: 10, animations: DIRS8, frames_count: 2, initial_animation: "down", loop: true, spritesheet: sheet("field", `${id}_field`)},
        yes: {frame_rate: 6, animations: DIRS8, frames_count: 3, initial_animation: "down", loop: false, spritesheet: sheet("field", `${id}_field`)},
        no: {frame_rate: 8, animations: DIRS8, frames_count: 4, initial_animation: "down", loop: false, spritesheet: sheet("field", `${id}_field`)},
        // the field cast (arms spread) and the pose that holds up a found item or a caught spirit
        cast: {frame_rate: 6, animations: DIRS8, frames_count: 2, initial_animation: "down", loop: true, spritesheet: sheet("field", `${id}_field`)},
        grant: {frame_rate: 1, animations: DIRS8, frames_count: 1, initial_animation: "down", loop: false, spritesheet: sheet("field", `${id}_field`)},
        battle: {spritesheet: sheet("battle", `${id}_battle`), animations: BATTLE_CHAR_ANIMS, frames_count: BATTLE_CHAR_ANIMS.map(() => 1), frame_rate: [10, 10, 3, 3, 10, 10, 12, 6, 1, 1, 1, 1, 1, 1], loop: BATTLE_CHAR_ANIMS.map(a => a.startsWith("idle") || a === "cast_back" || a === "cast_front")},
    }});
}
for (const [id, n] of Object.entries(C.npcs)) {
    if (C.chars[id]) continue;
    npcs.push({key_name: id, anchor_y: 0.8, initial_action: "idle", collision_body_bevel: 3, interaction_pattern: "cross", body_radius: 7.0, walk_speed: 40, voice_key: n.voice, actions: fieldActions(n.sprite, n.wander)});
}
for (const [engineEl, sunEl] of Object.entries(Object.fromEntries(Object.entries(EL).map(([s, e]) => [e, s])))) {
    const spiritSheet = C.spirit_order.find(id => C.spirits[id].el === sunEl);
    const action = rate => ({frame_rate: rate, animations: DIRS8, frames_count: 1, initial_animation: "down", loop: true, spritesheet: sheet("spirit", spiritSheet)});
    npcs.push({key_name: `${engineEl}_djinn`, anchor_y: 0.8, initial_action: "set", collision_body_bevel: 3, interaction_pattern: "tik_tak_toe", body_radius: 7.0, walk_speed: 60, actions: {set: action(1), standby: action(1)}, action_aliases: {idle: "standby", walk: "set"}});
}
const objectNpc = (key, actions, over = {}) => ({key_name: key, anchor_x: 0.5, anchor_y: 0.5, initial_action: Object.keys(actions)[0], collision_body_bevel: 3, interaction_pattern: "tik_tak_toe", no_shadow: true, body_radius: 7.0, actions, ...over});
const objectAction = (id, animations, frames_count, frame_rate, loop) => ({frame_rate, animations, frames_count, initial_animation: animations[0], loop, spritesheet: sheet("objects", id)});
npcs.push(objectNpc("chest", {chest: objectAction("chest", ["closed", "open", "opening", "shining", "empty"], [1, 1, 2, 2, 1], [1, 1, 6, 10, 1], [false, false, false, true, false])}, {anchor_y: 0.6}));
for (const id of ["marker", "sign", "boulder", "gate"]) npcs.push(objectNpc(id, {idle: objectAction(id, ["down"], 1, 1, false)}, {anchor_y: 0.6}));
for (const id of ["ogre_s", "wyrm_s"]) npcs.push(objectNpc(id, {idle: objectAction(id, ["down"], 2, 2, true)}, {anchor_y: 0.7, no_shadow: false}));
// decorations: trees, fences, houses and wells are body-less sprites over plain ground (the grid
// still blocks), so a sprite pack can replace them at any size; they stand on their tile's bottom
// row (anchored at the bottom, 7 px below the tile centre) and sort with the hero by that row
const HOUSE_IDS = [...new Set(Object.values(C.maps).flatMap(M => (M.houses || []).map(h => h.id)))];
const decor = (key, animations, over = {}, action = "idle") => ({key_name: key, anchor_x: 0.5, anchor_y: 1, sprite_y_offset: 7, initial_action: action, no_shadow: true, ignore_physics: true, interaction_pattern: "no_interaction",
    actions: {[action]: objectAction(key, animations, animations.map(() => 1), animations.map(() => 1), animations.map(() => false))}, ...over});
const TREE_VARIANTS = ["down", "alt1", "alt2"]; // the sprite, its mirror, a darker one
for (const id of ["tree", "tree_trail"]) npcs.push(decor(id, TREE_VARIANTS));
for (const id of ["fence_h", "fence_v", "fence_v2"]) npcs.push(decor(id, ["down"]));
npcs.push(decor("fence_post", ["right", "left"]));
npcs.push(decor("houses", HOUSE_IDS, {}, "house")); // the sheet's frames are house/<id>/00
for (const id of ["well", "spring"]) npcs.push(decor(id, ["down"], {anchor_y: 0.5, sprite_y_offset: 0})); // walked onto, so centred under the hero
db("npc", npcs);

// ---------------- maps ----------------
const SOLID = new Set(["t", "w", "r", "v", "R", "Q", "W", "D", "#", "s", "F"]); // k, B and G are objects that block by themselves; + E C are walkable
const OPPOSITE = {up: "down", down: "up", left: "right", right: "left"};
const mapsDb = [];
const BACKGROUND = {fields: "bg_field", brindle: "bg_field", mine: "bg_mine", trail: "bg_trail", shrine: "bg_tower"};
const EXPECTED_LEVEL = {fields: 2, brindle: 3, mine: 6, trail: 9, shrine: 12};

for (const id of C.map_order) {
    const grid = JSON.parse(fs.readFileSync(path.join(SRC, "maps", `${id}_grid.json`), "utf8"));
    const M = C.maps[id];
    const {w, h, chars} = grid;
    const at = (x, y) => (chars[y] || "")[x] || "t";
    let objectId = 1;
    const props = {};
    let npcN = 0, eventN = 0;
    const addNpc = p => (props[`npc/${String(++npcN).padStart(2, "0")}`] = p);
    const addTileEvent = p => (props[`tile_event/${String(++eventN).padStart(2, "0")}`] = p);
    const marker = (x, y, over) => addNpc({key_name: "marker", x, y, npc_type: "normal", movement_type: "idle", base_collision_layer: 0, ...over});

    // collision: every solid tile, horizontal runs merged; the exits are tile events
    const objects = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!SOLID.has(at(x, y))) continue;
        let x1 = x;
        while (x1 + 1 < w && SOLID.has(at(x1 + 1, y))) x1++;
        objects.push({id: objectId++, name: "", type: "", x: x * T, y: y * T, width: (x1 - x + 1) * T, height: T, rotation: 0, visible: true});
        x = x1;
    }

    // decorations as sprites: every tree and fence tile, the houses and the wells (the tiles under
    // them become plain ground below)
    const dec = (key_name, x, y, over = {}) => addNpc({key_name, x, y, npc_type: "normal", movement_type: "idle", base_collision_layer: 0, ...over});
    const hash = (x, y, s) => ((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) >>> 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const c = at(x, y);
        if (c === "t") dec(M.kind === "trail" ? "tree_trail" : "tree", x, y, {animation: TREE_VARIANTS[hash(x, y, 5) % TREE_VARIANTS.length]});
        else if (c === "F") {
            // a run tile between two fence tiles, a post at the end of a run (its mirror on the
            // left end) or a vertical piece, the second variant now and then
            const L = at(x - 1, y) === "F", R = at(x + 1, y) === "F";
            const hc = +L + +R;
            if (hc === 2) dec("fence_h", x, y);
            else if (hc === 1) dec("fence_post", x, y, {animation: R ? "left" : "right"});
            else dec(hash(x, y, 19) % 3 === 0 ? "fence_v2" : "fence_v", x, y);
        }
    }
    for (const house of M.houses || []) dec("houses", house.x + 1, house.y + 2, {animation: house.id});
    for (const well of M.wells || []) dec(at(well.x, well.y) === "E" ? "spring" : "well", well.x, well.y);

    // exits
    for (const exit of M.exits) {
        addTileEvent({type: "teleport", x: exit.x, y: exit.y, target: exit.to, activation_directions: exit.dir, x_target: exit.tx, y_target: exit.ty, destination_direction: exit.dir, dest_collision_layer: 0, activation_collision_layers: 0});
    }
    // houses: the door tile talks (shop, inn, or bolted)
    for (const house of M.houses || []) {
        const x = house.x + 1, y = house.y + 2;
        if (house.use === "shop") marker(x, y, {npc_type: "shop", shop_key: house.shop, avatar: C.shops[house.shop].keeper, voice_key: C.npcs[C.shops[house.shop].keeper].voice});
        else if (house.use === "inn") marker(x, y, {npc_type: "inn", inn_key: house.inn, avatar: "ina", voice_key: "adult_male_1"});
        else marker(x, y, {message: say(C.story.door_bolted)});
    }
    for (const sign of M.signs || []) marker(sign.x, sign.y, {message: say(sign.lines)});
    for (const well of M.wells || []) {
        addTileEvent({type: "event_trigger", x: well.x, y: well.y, activation_directions: "all", activation_collision_layers: 0, trigger_once: true, events: [...ev.heal(), ev.dialog([well.text])]});
    }
    // chests
    for (const chest of C.chests[id] || []) {
        const key = `chest_${id}_${chest.x}_${chest.y}`;
        storage[key] = "closed";
        const base = {key_name: "chest", label: key, storage_keys: {animation: key}, x: chest.x, y: chest.y, npc_type: "normal", movement_type: "idle", base_collision_layer: 0, message: ""};
        if (chest.gold) {
            addNpc({...base, events: [ev.branch(key, "closed", [ev.setNpc(key, "open", key), ev.coins(chest.gold), ev.dialog([`Found ${chest.gold} coins!`])], [ev.dialog(["The chest is empty."])])]});
        } else {
            const item = chest.item || chest.gear || "compass";
            const finish = chest.flag ? [ev.set(chest.flag, true), ev.dialog(["Someone must be missing this..."])] : chest.gear ? [ev.dialog(["Equip it from the menu."])] : [];
            addNpc({...base, events: [{type: "chest", item, standard_chest: true, finish_events: finish}]});
        }
    }
    // spirits: a duel, then the spirit joins
    for (const sid of C.spirit_order.filter(s => C.spirits[s].map === id)) {
        const s = C.spirits[sid];
        const elName = s.el.toUpperCase();
        const challenge = C.story.spirit_challenge.map(l => l.replace("{EL}", elName).replace("{NAME}", s.name.toUpperCase())).concat(C.spirit_duels[sid].double ? [C.story.spirit_double] : []);
        addNpc({key_name: `${EL[s.el]}_djinn`, label: `spirit_${sid}`, storage_keys: {active: `spirit_${sid}_free`}, x: s.x, y: s.y, npc_type: "normal", movement_type: "idle", base_collision_layer: 0, message: say(challenge),
            events: [{type: "djinn_get", djinn_key: sid, has_fight: true, enemy_party_key: `duel_${sid}`, custom_battle_bg: BACKGROUND[id],
                finish_events: [ev.set(`spirit_${sid}_free`, false), ev.set(`spirit_${sid}`, true), ev.set("spirits_found", 1, {increment: true}),
                    ev.dialog([`Humbled, the ${elName} spirit ${s.name.toUpperCase()} joins you!`, sid === "flint" ? C.story.spirit_won_flint : C.story.spirit_won_other])]}]});
    }
    // the boulder and the gate
    if (M.boulder) {
        const b = M.boulder;
        addNpc({key_name: "boulder", label: "boulder", storage_keys: {active: `not:${b.flag}_gone`}, x: b.x, y: b.y, npc_type: "normal", movement_type: "idle", base_collision_layer: 0, message: "",
            events: [ev.branch(`spirit_${b.needs}`, true, [ev.dialog(b.open, {finish_events: [ev.setNpc(`${b.flag}_gone`, true, "boulder")]})], [ev.dialog(b.locked)])]});
    }
    if (M.gate) {
        const g = M.gate;
        addNpc({key_name: "gate", label: "gate", storage_keys: {active: `not:${g.flag}`}, x: g.x, y: g.y, npc_type: "normal", movement_type: "idle", base_collision_layer: 0, message: "",
            events: [ev.branch(g.needs_flag, true, [ev.dialog(g.open, {finish_events: [ev.setNpc(g.flag, true, "gate")]})], [ev.dialog(g.locked)])]});
    }
    // the push puzzle: a loose boulder that walking into it, or the Shove art, pushes along its allowed tiles
    if (M.puzzle) {
        const p = M.puzzle;
        props["interactable_object/01"] = {key_name: p.object, x: p.x, y: p.y, base_collision_layer: 0, allowed_tiles: [{type: "rect", x0: p.allowed.x0, y0: p.allowed.y0, x1: p.allowed.x1, y1: p.allowed.y1, collision_layer: 0}]};
    }
    // bosses
    if (M.boss) {
        const b = M.boss;
        storage[b.flag] = false;
        const won = [ev.setNpc(`boss_${b.id}_alive`, false, `boss_${b.id}`), ev.set(b.flag, true)];
        if (b.gives_flag) won.push(ev.set(b.gives_flag, true));
        // events in a list fire at once, so what must wait for a dialog hangs off its finish_events
        const after = b.ending
            ? [ev.dialog(b.victory, {finish_events: [ev.dialog(C.story.ending, {finish_events: [ev.teleport("fields", C.story.start.x, C.story.start.y, "down")]})]})]
            : [ev.dialog(b.victory)];
        addNpc({key_name: `${b.id}_s`, label: `boss_${b.id}`, storage_keys: {active: `boss_${b.id}_alive`}, x: b.x, y: b.y, npc_type: "normal", movement_type: "idle", base_collision_layer: 0, message: say(b.intro),
            events: [{type: "battle", background_key: BACKGROUND[id], bgm: b.bgm, enemy_party_key: `boss_${b.id}`, before_fade_victory_events: won, all_enemies_fled_events: after}]});
    }
    // villagers
    for (const [nid, n] of Object.entries(C.npcs).filter(([, n]) => n.map === id)) {
        const base = {key_name: nid, label: nid, x: n.x, y: n.y, npc_type: "normal", movement_type: n.wander ? "random" : "idle", avatar: nid, base_collision_layer: 0, message: ""};
        if (n.shop) {
            addNpc({...base, npc_type: "shop", shop_key: n.shop});
            continue;
        }
        // the dialog list is tried top to bottom; the first entry whose conditions hold is said
        const chain = (entries) => {
            if (!entries.length) return [];
            const [d, ...rest] = entries;
            // a dialog inside yes_no_events is destroyed with its parent before it can run, so the
            // whole exchange is one dialog with the question last; the engine's own "joined your
            // party" message follows a yes, and the NPC is switched off only after that
            const lines = d.join ? [ev.dialog(d.lines.slice(0, -1).concat([`Ask ${n.name.toUpperCase()} to join the party?`]), {end_with_yes_no: true, yes_no_events: {
                yes: [{type: "party_join", char_key_name: n.joins, show_dialog: true, finish_events: [ev.setNpc(`${nid}_joined`, true, nid)]}],
                no: []}})] : [ev.dialog(d.lines)];
            let cond = null;
            if (d.unless) cond = [d.unless, false];
            else if (d.unless_spirit) cond = [`spirit_${d.unless_spirit}`, false];
            if (d.unless_spirits !== undefined) {
                const inner = cond ? [ev.branch(cond[0], cond[1], lines, chain(rest))] : lines;
                return [ev.branch("spirits_found", d.unless_spirits, inner, chain(rest), "<")];
            }
            return cond ? [ev.branch(cond[0], cond[1], lines, chain(rest))] : lines;
        };
        if (n.joins) base.storage_keys = {active: `not:${nid}_joined`};
        addNpc({...base, events: chain(n.dialog)});
    }
    // what runs on entering the map
    const gameEvents = [];
    if (id === C.story.start.map) gameEvents.push(ev.branch("intro_done", false, [ev.dialog(C.story.intro), ev.set("intro_done", true)]));
    if (M.join) gameEvents.push(ev.branch(`${M.join.flag}_joined`, false, [ev.dialog(M.join.lines, {finish_events: [{type: "party_join", char_key_name: M.join.char, show_dialog: false}, ev.set(`${M.join.flag}_joined`, true)]})]));
    if (gameEvents.length) props.game_events = gameEvents;
    if (M.kind === "field" || M.kind === "town") props.sanctum = {map_key: id, collision_layer: 0, tile_position: {x: M.start.x, y: M.start.y}};
    props.background_key = BACKGROUND[id];

    // encounters: one zone per rectangle; the paddock sits on top of the open fields
    const zones = [];
    for (const [zone, enc] of Object.entries(C.encounters)) {
        if (!enc.maps.includes(id)) continue;
        const area = enc.area || {x0: 0, y0: 0, x1: w - 1, y1: h - 1};
        zones.push({id: objectId++, name: zone, type: "", x: area.x0 * T, y: area.y0 * T, width: (area.x1 - area.x0 + 1) * T, height: (area.y1 - area.y0 + 1) * T, rotation: 0, visible: true,
            properties: {parties: JSON.stringify(partyKey[zone])}, propertytypes: {parties: "string"}});
    }
    zones.sort((a, b) => a.width * a.height - b.width * b.height); // the smaller (paddock) zone first

    const properties = {}, propertytypes = {};
    for (const [k, v] of Object.entries(props)) {
        // objects and lists travel as JSON strings (the engine parses them); plain strings stay as they are
        properties[k] = typeof v === "string" ? v : JSON.stringify(v);
        propertytypes[k] = "string";
    }
    const tileset = png.decode(fs.readFileSync(path.join(SRC, "maps", `${id}_tiles.png`)));
    // the ground layer: the tiles under the decorations drawn as sprites become the map's plain ground
    const DECOR = new Set(["t", "F", "+", "E", "R", "Q", "W", "D", "s"]);
    const groundCount = {};
    chars.forEach((row, y) => [...row].forEach((c, x) => {
        if (c === "." || c === "f") groundCount[grid.grid[y][x]] = (groundCount[grid.grid[y][x]] || 0) + 1;
    }));
    const ground = +Object.entries(groundCount).sort((a, b) => b[1] - a[1])[0][0];
    const data = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.push((DECOR.has(at(x, y)) ? ground : grid.grid[y][x]) + 1);
    const layers = [
        {name: "ground", type: "tilelayer", x: 0, y: 0, width: w, height: h, opacity: 1, visible: true, data},
        {name: "0", type: "objectgroup", x: 0, y: 0, opacity: 1, visible: true, draworder: "topdown", objects},
    ];
    if (zones.length) {
        layers.push({name: "encounter_zones", type: "objectgroup", x: 0, y: 0, opacity: 1, visible: true, draworder: "topdown", objects: zones,
            properties: {encounter_zone: true, base_rate: 60}, propertytypes: {encounter_zone: "bool", base_rate: "int"}});
    }
    writeJson(path.join(ROOT, "assets/maps", id, `${id}.json`), {
        version: 1.1, tiledversion: "1.1.0", type: "map", orientation: "orthogonal", renderorder: "right-down", infinite: false,
        width: w, height: h, tilewidth: T, tileheight: T, nextobjectid: objectId, properties, propertytypes, layers,
        tilesets: [{name: id, firstgid: 1, image: `../../images/tilesets/${id}.png`, imagewidth: tileset.width, imageheight: tileset.height, tilewidth: T, tileheight: T, columns: tileset.width / T, tilecount: (tileset.width / T) * (tileset.height / T), margin: 0, spacing: 0}],
    });
    mapsDb.push({name: M.name, key_name: id, bgm: {key: M.bgm, path: `assets/sounds/bgm/${M.bgm}.wav`}, tileset_files: {image: `assets/images/tilesets/${id}.png`, json: `assets/maps/${id}/${id}.json`},
        lazy_load: true, collision_embedded: true, background_key: BACKGROUND[id], expected_party_level: EXPECTED_LEVEL[id]});
}
db("maps", mapsDb);
db("storage", storage);
console.log(`built ${C.map_order.length} maps, ${abilities.length} abilities, ${items.length} items, ${enemies.length} enemies, ${parties.length} parties, ${npcs.length} npc sprites, ${Object.keys(storage).length} storage keys`);
