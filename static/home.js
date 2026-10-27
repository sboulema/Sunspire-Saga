// Keep the keys the game uses from acting on the page: space, arrows, page up / down (volume and
// debug camera) and backspace (Select).
window.addEventListener("keydown", function(e) {
    if ([8, 32, 33, 34, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        if (window.GoldenSun && GoldenSun.game.input.enabled) {
            e.preventDefault();
        }
    }
}, false);

const dom_ready = () => {
    const input_anim_1 = document.getElementById("animation_tester_enemy_party");
    input_anim_1.onfocus = () => (GoldenSun.game.input.enabled = false);
    input_anim_1.onblur = () => (GoldenSun.game.input.enabled = true);
    const input_anim_2 = document.getElementById("animation_tester_ability_keyname");
    input_anim_2.onfocus = () => (GoldenSun.game.input.enabled = false);
    input_anim_2.onblur = () => (GoldenSun.game.input.enabled = true);
};
document.addEventListener('DOMContentLoaded', dom_ready, false);
