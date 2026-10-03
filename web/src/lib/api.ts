import * as Comlink from "comlink";
import type { WorkerApi } from "./worker";

let remote: Comlink.Remote<WorkerApi> | null = null;
let nextJob = 1;

export function worker(): Comlink.Remote<WorkerApi> {
  remote ??= Comlink.wrap<WorkerApi>(new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }));
  return remote;
}

export const newJob = () => nextJob++;
export { Comlink };
