import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Data generated from the decomp, shared by Python and TS.
const data = fileURLToPath(new URL("../src/swg3/data", import.meta.url));
// Site name, slug and URL: single source, also read by Python.
const brandFile = fileURLToPath(new URL("../src/swg3/brand.json", import.meta.url));
const brand = JSON.parse(readFileSync(brandFile, "utf8")) as { name: string; slug: string; url: string };
// Site version: package.json, kept equal to pyproject.toml and the first changelog entry (tested).
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// <!--head--> and <!--app--> are filled per page by the prerender (scripts/build.mjs); the dev server only adds a title.
const brandHtml: Plugin = {
  name: "brand-html",
  transformIndexHtml: (html, ctx) => {
    const out = html.replaceAll("%BRAND_SLUG%", brand.slug);
    return ctx.server ? out.replace("<!--head-->", `<title>${brand.name}</title>`) : out;
  },
};

// Preview serves the build like production: /rng serves rng.html, unknown paths get the language 404 page with status 404.
const prerenderedPreview: Plugin = {
  name: "prerendered-preview",
  configurePreviewServer(server) {
    const dist = server.config.build.outDir;
    const file = (path: string) => existsSync(join(dist, path)) && statSync(join(dist, path)).isFile();
    server.middlewares.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      const [path, query = ""] = (req.url ?? "/").split(/\?(.*)/s);
      const clean = decodeURIComponent(path).replace(/\/+$/, "") || "/";
      if (clean === "/" || file(clean)) return next();
      if (file(`${clean}.html`)) {
        req.url = `${clean}.html${query ? `?${query}` : ""}`;
        return next();
      }
      const notFound = clean === "/en" || clean.startsWith("/en/") ? "en/404.html" : "404.html";
      if (!file(notFound)) return next();
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(readFileSync(join(dist, notFound)));
    });
  },
};

export default defineConfig({
  base: "/",
  plugins: [react(), brandHtml, prerenderedPreview],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: { alias: { "@data": data, "@brand": brandFile } },
  server: { fs: { allow: [".", data, brandFile] } },
  // The main bundle carries the guides of both languages (~600 KB); splitting Markdown per language is pending.
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 650 },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
