// Site name, URL and source repository. Single source: src/swg3/brand.json (shared with Python).

import brand from "@brand";

export const BRAND_NAME: string = brand.name;
export const SLUG: string = brand.slug;

// No trailing slash. When empty, nothing needing an absolute URL is generated.
export const SITE_URL: string = (brand.url ?? "").replace(/\/+$/, "");

// Public source code (AGPLv3). When empty, the footer and pages show no link to it.
export const REPO_URL: string = (brand.repo ?? "").replace(/\/+$/, "");

export const storageKey = (name: string) => `${SLUG}.${name}`;

export const fileName = (rest: string) => `${SLUG}-${rest}`;

