// Names sent to the Codes page from other pages, and the tour's example code.

import { create } from "zustand";

interface CodesState {
  pending: string | null;
  example: string | null;
  open: (names: string) => void;
  suggest: (names: string | null) => void;
  take: () => string | null;
}

export const useCodes = create<CodesState>((set, get) => ({
  pending: null,
  example: null,
  open: (names) => set({ pending: names }),
  suggest: (names) => set({ example: names }),
  take: () => {
    const names = get().pending;
    set({ pending: null });
    return names;
  },
}));
