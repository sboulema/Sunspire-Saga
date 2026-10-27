// Keep the keys the game uses from acting on the page: space, arrows, page up / down (volume and
// debug camera) and backspace (Select).
window.addEventListener("keydown", function(e) {
    if ([8, 32, 33, 34, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        if (window.GoldenSun && GoldenSun.game.input.enabled && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
            e.preventDefault();
        }
    }
}, false);
