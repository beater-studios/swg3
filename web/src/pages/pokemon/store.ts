import { create } from "zustand";
import type { Pk3Description } from "../../lib/services/pokemon";

export type PokemonTab = "read" | "edit" | "send";

export interface CurrentMon {
  label: string;
  info: Pk3Description;
  own?: boolean;
}

interface PokemonState {
  tab: PokemonTab;
  current: CurrentMon | null;
  editing: CurrentMon | null;      // null = creating from scratch
  editRevision: number;            // bumped when a Pokémon is sent to the editor, so it reloads
  setTab: (tab: PokemonTab) => void;
  send: (mon: CurrentMon) => void;
  edit: (mon: CurrentMon | null) => void;
  setEditing: (mon: CurrentMon | null) => void;
  setCurrent: (mon: CurrentMon | null) => void;
}

export const usePokemon = create<PokemonState>((set, get) => ({
  tab: "read",
  current: null,
  editing: null,
  editRevision: 0,
  setTab: (tab) => set({ tab }),
  send: (mon) => set({ current: mon, tab: "send" }),
  edit: (mon) => set({ editing: mon, editRevision: get().editRevision + 1, tab: "edit" }),
  setEditing: (mon) => set({ editing: mon }),
  setCurrent: (mon) => set({ current: mon }),
}));
