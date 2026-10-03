// Worker for long searches: runs in chunks, reports progress and can be cancelled between chunks.

import * as Comlink from "comlink";
import { setLang, type Lang } from "../i18n";
import * as rng from "./services/rng";

export type SearchName = "search_static" | "search_wild" | "search_egg_held" | "search_egg_pickup";

export interface Progress {
  done: number;
  total: number;
  count: number;
  results: unknown[];
}

const CHUNK = 200_000;
const cancelled = new Set<number>();
const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

const api = {
  async search(job: number, name: SearchName, params: rng.Params, lang: Lang, onProgress: (p: Progress) => void) {
    setLang(lang);
    const first = Number(params.first ?? 0);
    const last = Number(params.last ?? first);
    const total = last - first + 1;
    const limit = Number(params.limit ?? rng.MAX_RESULTS);
    const results: unknown[] = [];
    let count = 0;
    for (let start = first; start <= last; start += CHUNK) {
      if (cancelled.has(job)) break;
      const end = Math.min(last, start + CHUNK - 1);
      const reply = rng.FUNCTIONS[name]({ ...params, first: start, last: end, limit: Math.max(0, limit - results.length) }) as rng.SearchResult<unknown>;
      count += reply.count;
      const fresh = reply.results;
      results.push(...fresh);
      onProgress({ done: end - first + 1, total, count, results: fresh });
      await pause();
    }
    const stopped = cancelled.delete(job);
    return { count, stopped };
  },
  cancel(job: number) {
    cancelled.add(job);
  },
  // Progress at most every 100 ms: each report is a message posted to the page.
  calibrate(params: rng.Params, lang: Lang, onProgress?: (done: number, total: number) => void) {
    setLang(lang);
    let last = 0;
    return rng.calibrate(params, onProgress && ((done, total) => {
      const now = performance.now();
      if (done < total && now - last < 100) return;
      last = now;
      onProgress(done, total);
    }));
  },
};

export type WorkerApi = typeof api;

Comlink.expose(api);
