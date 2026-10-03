// Game PIDs for given IVs: in CreateBoxMon (src/pokemon.c) the PID comes from two Random() calls (low half first) and the IVs
// from the next two, with one call skipped for methods 2 and 4 (rng.ts). The 1st IV fixes 15 of the 16 high bits of a state,
// so testing 2 × 65,536 states is enough. Same idea as PokeFinder's IVs-to-seed search, reimplemented.

import { STATS, type StatValues } from "./pk3";
import { nextSeed, prevSeed, type Method } from "./rng";

export interface PidIv {
  pid: number;
  method: Method;
  /** Generator state before the first call (this Pokémon's "seed" for the method). */
  origin: number;
}

/** The two 15-bit IV words as the game generates them: HP/Atk/Def and Spe/SpA/SpD (STATS order). */
function ivWords(ivs: StatValues): [number, number] {
  const v = STATS.map((k) => ivs[k] & 0x1f);
  return [v[0] | (v[1] << 5) | (v[2] << 10), v[3] | (v[4] << 5) | (v[5] << 10)];
}

/** Every PID the game generates together with these IVs, in methods 1, 2 and 4, sorted by method and PID. */
export function pidsForIvs(ivs: StatValues): PidIv[] {
  const [first, second] = ivWords(ivs);
  const out: PidIv[] = [];
  for (const high of [first, first | 0x8000]) {
    for (let low = 0; low < 0x10000; low++) {
      const iv1 = ((high << 16) | low) >>> 0;
      const next = nextSeed(iv1);
      const afterNext = nextSeed(next);
      // Methods 1 and 2: the 2nd IV comes right after the 1st. Method 4: one call skipped between them.
      const direct = ((next >>> 16) & 0x7fff) === second;
      const skipped = ((afterNext >>> 16) & 0x7fff) === second;
      if (!direct && !skipped) continue;
      const before = prevSeed(iv1);
      if (direct) {
        // Method 1: PID from the two calls right before the 1st IV.
        out.push(spread(prevSeed(before), before, 1));
        // Method 2: one call skipped between the PID and the 1st IV.
        const skip = before;
        const pidHigh = prevSeed(skip);
        out.push(spread(prevSeed(pidHigh), pidHigh, 2));
      }
      if (skipped) out.push(spread(prevSeed(before), before, 4));
    }
  }
  return out.sort((a, b) => a.method - b.method || a.pid - b.pid);
}

function spread(pidLow: number, pidHigh: number, method: Method): PidIv {
  return { pid: ((pidLow >>> 16) | ((pidHigh >>> 16) << 16)) >>> 0, method, origin: prevSeed(pidLow) };
}

/**
 * Method (1, 2 or 4) in which the game generates this PID together with these IVs, or null if none does. The PID fixes
 * the 16 high bits of the first two calls; testing the 65,536 states of the first one and stepping to the IVs is enough.
 */
export function pidIvMethod(pid: number, ivs: StatValues): Method | null {
  const [first, second] = ivWords(ivs);
  const low = pid & 0xffff, high = pid >>> 16;
  for (let bits = 0; bits < 0x10000; bits++) {
    const s1 = ((low << 16) | bits) >>> 0;
    const s2 = nextSeed(s1);
    if (s2 >>> 16 !== high) continue;
    const s3 = nextSeed(s2), s4 = nextSeed(s3), s5 = nextSeed(s4);
    const iv = (s: number) => (s >>> 16) & 0x7fff;
    if (iv(s3) === first && iv(s4) === second) return 1;
    if (iv(s4) === first && iv(s5) === second) return 2;
    if (iv(s3) === first && iv(s5) === second) return 4;
  }
  return null;
}
