// Types of sw.mjs for the tests.
export interface ServiceWorkerConfig { cache: string; prefix: string; urls: string[]; pages: string[] }
export function pageUrl(file: string): string;
export function offlineFiles(outDir: string): string[];
export function serviceWorker(outDir: string, options: { slug: string; version: string }): { config: ServiceWorkerConfig; source: string };
