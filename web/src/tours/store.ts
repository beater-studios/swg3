// Open tour and per-tour progress, stored in the browser to resume later.

import { create } from "zustand";
import { load, save } from "../app/prefs";
import { storageKey } from "../brand";

const KEY = storageKey("tours");
type Progress = Record<string, number>;
const readProgress = (): Progress => {
  const raw = load<unknown>(KEY, {});
  return raw && typeof raw === "object" ? Object.fromEntries(Object.entries(raw).filter(([, v]) => Number.isInteger(v) && (v as number) >= 0)) as Progress : {};
};

interface TourState {
  active: string | null;
  index: number;
  start: (id: string, index?: number) => void;
  go: (index: number) => void;
  /** Leaves the tour keeping the step, to resume later. */
  stop: () => void;
  finish: () => void;
}

export function savedStep(id: string): number | null {
  return readProgress()[id] ?? null;
}

function remember(id: string, index: number | null) {
  const progress = readProgress();
  if (index === null) delete progress[id];
  else progress[id] = index;
  save(KEY, progress);
}

export const useTour = create<TourState>((set, get) => ({
  active: null,
  index: 0,
  start: (id, index = 0) => { set({ active: id, index }); remember(id, index); },
  go: (index) => { const { active } = get(); if (!active) return; set({ index }); remember(active, index); },
  stop: () => set({ active: null }),
  finish: () => { const { active } = get(); if (active) remember(active, null); set({ active: null, index: 0 }); },
}));
