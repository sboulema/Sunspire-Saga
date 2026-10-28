import {SnapshotData} from "../Snapshot";

/**
 * The browser save: one slot in localStorage holding the engine's snapshot, with a format
 * version so an incompatible save is ignored instead of breaking the game. The game autosaves
 * here on every map change, after battles and at inns, and the Start prompt saves here too;
 * the title screen's Continue resumes from it (the JSON file import remains as a fallback).
 */
export class SaveSlot {
    private static readonly KEY = "sunspire_engine_save";
    /** Bump when SnapshotData changes shape in a way old saves cannot satisfy. */
    public static readonly VERSION = 1;

    private static read(): {version: number; saved_at: string; snapshot: SnapshotData} | null {
        try {
            const raw = localStorage.getItem(SaveSlot.KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data?.version !== SaveSlot.VERSION || !data.snapshot?.map_data) {
                console.warn(
                    `Sunspire: ignoring a save of version ${data?.version}; this build reads version ${SaveSlot.VERSION}.`
                );
                return null;
            }
            return data;
        } catch {
            return null;
        }
    }

    /** Whether a readable save is stored. */
    static exists() {
        return SaveSlot.read() !== null;
    }

    /** The stored snapshot, or null. */
    static load(): SnapshotData | null {
        return SaveSlot.read()?.snapshot ?? null;
    }

    /** Stores a snapshot. Returns false when the browser refuses (private mode, full storage). */
    static store(snapshot: SnapshotData) {
        try {
            localStorage.setItem(
                SaveSlot.KEY,
                JSON.stringify({version: SaveSlot.VERSION, saved_at: new Date().toISOString(), snapshot})
            );
            return true;
        } catch {
            return false;
        }
    }

    static clear() {
        try {
            localStorage.removeItem(SaveSlot.KEY);
        } catch {
            // nothing to clear
        }
    }
}
