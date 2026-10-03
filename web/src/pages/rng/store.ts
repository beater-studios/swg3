// RNG page state. Game and timer settings are stored in the browser; chosen seed and target are not.

import { create } from "zustand";
import { load, save } from "../../app/prefs";
import { storageKey } from "../../brand";
import { DEFAULT_TIMER, type ChosenSeed, type Target, type TimerSettings } from "../../lib/rngflow";

export interface GameParams {
  version: "firered" | "leafgreen";
  console: "switch1" | "switch2";
  setting: string;
  strict: boolean;
  tid: string;
  sid: string;
  ot: string;
}

export type Step = "seed" | "target" | "timer" | "adjust" | "check" | "calc";

interface RngState {
  game: GameParams;
  chosen: ChosenSeed | null;
  target: Target | null;
  timer: TimerSettings;
  step: Step;
  setGame: (patch: Partial<GameParams>) => void;
  choose: (chosen: ChosenSeed | null) => void;
  aim: (target: Target) => void;
  setTimer: (patch: Partial<TimerSettings>) => void;
  setStep: (step: Step) => void;
}

const KEY = storageKey("rng");
const DEFAULT_GAME: GameParams = { version: "firered", console: "switch1", setting: "", strict: true, tid: "", sid: "", ot: "" };
type Saved = Pick<GameParams, "version" | "console" | "setting" | "strict" | "tid" | "sid" | "ot">;
const savedGame = (game: GameParams): Saved =>
  ({ version: game.version, console: game.console, setting: game.setting, strict: game.strict, tid: game.tid, sid: game.sid,
    ot: typeof game.ot === "string" ? game.ot.slice(0, 7) : "" });
function savedTimer(value: unknown): TimerSettings {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_TIMER };
  for (const key of Object.keys(DEFAULT_TIMER) as (keyof TimerSettings)[]) {
    const v = raw[key];
    if (typeof DEFAULT_TIMER[key] === "boolean" ? typeof v === "boolean" : typeof v === "number" && Number.isFinite(v)) {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}
const loaded = load<{ game?: Partial<GameParams>; timer?: unknown }>(KEY, {});
const stored: Partial<Saved> = savedGame({ ...DEFAULT_GAME, ...loaded.game });
const storedTimer = savedTimer(loaded.timer);
save(KEY, { game: stored, timer: storedTimer });

export const useRng = create<RngState>((set, get) => {
  const persist = () => save(KEY, { game: savedGame(get().game), timer: savedTimer(get().timer) });
  return {
    game: { ...DEFAULT_GAME, ...stored },
    chosen: null,
    target: null,
    timer: storedTimer,
    step: "seed",
    setGame: (patch) => {
      const game = { ...get().game, ...patch };
      const before = get().game;
      // Another seed table: the chosen seed and target no longer apply.
      const table = game.version !== before.version || game.console !== before.console || game.setting !== before.setting;
      set(table ? { game, chosen: null, target: null } : { game });
      persist();
    },
    choose: (chosen) => {
      set({ chosen });
      persist();
    },
    aim: (target) => { set({ target, step: "timer" }); persist(); },
    setTimer: (patch) => { set({ timer: { ...get().timer, ...patch } }); persist(); },
    setStep: (step) => set({ step }),
  };
});
