import {GoldenSun} from "../GoldenSun";
import {AdvanceButton} from "../XGamepad";
import * as numbers from "../magic_numbers";

/**
 * The handheld shell drawn around the canvas in index.html: its on-screen buttons feed the
 * gamepad, the screen is sized to an integer multiple of the game resolution that fits the page
 * (or the viewport in immersive mode), and immersive mode shows the shell alone, in real
 * fullscreen where the browser allows it. The page chrome around it (colour theme, shell colour)
 * is plain page script in static/site.js.
 */
export class HandheldShell {
    /** data-k attribute of a shell button -> game button. */
    private static readonly BUTTONS: {[key: string]: AdvanceButton} = {
        up: AdvanceButton.UP,
        down: AdvanceButton.DOWN,
        left: AdvanceButton.LEFT,
        right: AdvanceButton.RIGHT,
        a: AdvanceButton.A,
        b: AdvanceButton.B,
        start: AdvanceButton.START,
        select: AdvanceButton.SELECT,
        l: AdvanceButton.L,
        r: AdvanceButton.R,
    };
    /** Horizontal space the shell takes around the canvas: shell padding, screen padding, borders. */
    private static readonly CHROME_WIDTH = 58;
    /** Vertical space taken by the shoulders, controls and paddings in the portrait layout. */
    private static readonly PORTRAIT_CHROME_HEIGHT = 250;
    /** Space the d-pad and button columns take beside the screen in the landscape layout. */
    private static readonly LANDSCAPE_SIDE_WIDTH = 400;
    private static readonly MAX_SCALE = 6;
    private static readonly RESIZE_DELAY = 80;

    private data: GoldenSun;
    private shell: HTMLElement;
    private stage: HTMLElement;
    /** Pointer id -> the button it holds down. */
    private held: Map<number, AdvanceButton> = new Map();
    private resize_timer: number = null;
    private via_fullscreen_api: boolean = false;
    /** Updates the sound button to the sound manager's state; set once the button is bound. */
    private sync_sound: () => void = null;

    constructor(data: GoldenSun) {
        this.data = data;
        this.shell = document.getElementById("shell");
        this.stage = document.getElementById("stage");
        if (!this.shell || !this.stage) {
            return;
        }
        this.bind_buttons();
        this.bind_sound_button();
        this.bind_immersive();
        window.addEventListener("resize", () => this.schedule_fit());
        matchMedia("(orientation: landscape)").addEventListener("change", () => this.schedule_fit());
    }

    /** Whether the page has a shell at all. */
    get active() {
        return Boolean(this.shell);
    }

    /** Whether the shell is shown alone, filling the viewport. */
    get immersive() {
        return document.body.classList.contains("immersive");
    }

    /**
     * Picks the largest integer scale whose canvas fits the space the shell has, applies it to the
     * game and sizes the shell around it.
     */
    fit() {
        if (!this.active || !this.data.game) {
            return;
        }
        this.sync_sound?.();
        const landscape = this.immersive && matchMedia("(orientation: landscape)").matches;
        let available_width: number;
        let available_height = Infinity;
        if (!this.immersive) {
            available_width = this.stage.clientWidth - HandheldShell.CHROME_WIDTH;
        } else if (landscape) {
            available_width = window.innerWidth - HandheldShell.LANDSCAPE_SIDE_WIDTH - HandheldShell.CHROME_WIDTH;
            available_height = window.innerHeight - 72;
        } else {
            available_width = window.innerWidth - 24 - HandheldShell.CHROME_WIDTH;
            available_height = window.innerHeight - HandheldShell.PORTRAIT_CHROME_HEIGHT;
        }
        const scale = Math.max(
            1,
            Math.min(
                HandheldShell.MAX_SCALE,
                Math.floor(available_width / numbers.GAME_WIDTH),
                Math.floor(available_height / numbers.GAME_HEIGHT)
            )
        );
        if (scale !== this.data.scale_factor) {
            this.data.set_scale_factor(scale);
        }
        this.shell.style.width = landscape ? "" : `${numbers.GAME_WIDTH * scale + HandheldShell.CHROME_WIDTH}px`;
    }

    private schedule_fit() {
        window.clearTimeout(this.resize_timer);
        this.resize_timer = window.setTimeout(() => this.fit(), HandheldShell.RESIZE_DELAY);
    }

    private bind_buttons() {
        this.shell.querySelectorAll<HTMLElement>("[data-k]").forEach(element => {
            const button = HandheldShell.BUTTONS[element.dataset.k];
            if (button === undefined) {
                return;
            }
            element.addEventListener("pointerdown", event => {
                event.preventDefault();
                if (!this.data.gamepad) {
                    return;
                }
                element.setPointerCapture(event.pointerId);
                this.held.set(event.pointerId, button);
                element.classList.add("held");
                this.data.gamepad.press(button);
            });
            const release = (event: PointerEvent) => {
                const held_button = this.held.get(event.pointerId);
                if (held_button === undefined) {
                    return;
                }
                this.held.delete(event.pointerId);
                element.classList.remove("held");
                this.data.gamepad?.release(held_button);
            };
            element.addEventListener("pointerup", release);
            element.addEventListener("pointercancel", release);
            element.addEventListener("lostpointercapture", release);
            element.addEventListener("contextmenu", event => event.preventDefault());
        });
    }

    /** The sound button beside the shell does what the M key does; on touch it is the only way to unmute. */
    private bind_sound_button() {
        const button = document.getElementById("soundBtn");
        if (!button) {
            return;
        }
        const sync = () => {
            if (!this.data.game?.sound) {
                return; // Phaser creates the sound manager while booting
            }
            const muted = this.data.game.sound.mute;
            button.setAttribute("aria-pressed", String(!muted));
            button.title = muted ? "Sound off (M)" : "Sound on (M)";
        };
        button.addEventListener("click", () => {
            this.data.game.sound.context?.resume();
            this.data.game.sound.mute = !this.data.game.sound.mute;
            sync();
            button.blur();
        });
        window.addEventListener("keyup", event => {
            if (event.key === "m" || event.key === "M") {
                sync();
            }
        });
        this.sync_sound = sync;
    }

    private bind_immersive() {
        const body = document.body;
        const enter_button = document.getElementById("immBtn");
        const exit_button = document.getElementById("immExit");
        const hint = document.getElementById("immHint");
        enter_button?.addEventListener("click", () => {
            enter_button.blur();
            this.enter_immersive();
        });
        exit_button?.addEventListener("click", () => {
            exit_button.blur();
            this.leave_immersive();
        });
        // Esc in real fullscreen ends fullscreen; follow it out of immersive mode too
        const on_fullscreen_change = () => {
            if (this.via_fullscreen_api && !HandheldShell.fullscreen_element()) {
                this.leave_immersive();
            }
        };
        document.addEventListener("fullscreenchange", on_fullscreen_change);
        document.addEventListener("webkitfullscreenchange", on_fullscreen_change);
        window.addEventListener("keydown", event => {
            const target = event.target as HTMLElement;
            if (
                (event.key === "f" || event.key === "F") &&
                !event.repeat &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey &&
                !event.shiftKey && // Shift+F is the engine's FPS debug toggle
                !/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
            ) {
                event.preventDefault();
                if (this.immersive) {
                    this.leave_immersive();
                } else {
                    this.enter_immersive();
                }
            }
        });
        // opened as the installed app, or asked for in the URL: straight into the immersive shell
        if (body.classList.contains("immersive")) {
            this.data.fullscreen = true;
            hint?.classList.add("shown");
        }
    }

    private static fullscreen_element() {
        return document.fullscreenElement || (document as any).webkitFullscreenElement;
    }

    /**
     * Shows the shell alone, scaled to the viewport, in real fullscreen where the browser allows it.
     * @param use_fullscreen_api whether to ask the browser for fullscreen; only works from a user gesture.
     */
    enter_immersive(use_fullscreen_api: boolean = true) {
        if (!this.active || this.immersive) {
            return;
        }
        document.body.classList.add("immersive");
        this.data.fullscreen = true;
        const hint = document.getElementById("immHint");
        if (hint) {
            hint.classList.remove("shown");
            void hint.offsetWidth; // restart the fade animation
            hint.classList.add("shown");
        }
        if (use_fullscreen_api) {
            const element = document.documentElement as any;
            const request = element.requestFullscreen || element.webkitRequestFullscreen;
            if (request) {
                try {
                    const promise = request.call(element, {navigationUI: "hide"});
                    this.via_fullscreen_api = true;
                    promise?.catch?.(() => (this.via_fullscreen_api = false));
                } catch {
                    this.via_fullscreen_api = false;
                }
            }
        }
        this.schedule_fit();
    }

    leave_immersive() {
        if (!this.active || !this.immersive) {
            return;
        }
        document.body.classList.remove("immersive");
        this.data.fullscreen = false;
        if (HandheldShell.fullscreen_element()) {
            const doc = document as any;
            (doc.exitFullscreen || doc.webkitExitFullscreen).call(document);
        }
        this.via_fullscreen_api = false;
        this.schedule_fit();
    }
}
