// Front sprite built as the game does (LoadSpecialPokePic in src/decompress.c, DrawSpindaSpots in src/pokemon.c).
// Files in public/mon (tools/gen_mon_sprites.py) are grayscale: palette index * 16.

import { formKey } from "../lib/gen3/forms";

interface Spot { x: number; y: number; rows: number[] }
interface MonPicData {
  species: { unown: number; unownB: number; spinda: number; egg: number };
  palettes: Record<string, string[][]>;
  noFlip: number[];
  spinda: Spot[];
}

const BASE = `${import.meta.env.BASE_URL}mon/`;
const SIZE = 64;
let data: Promise<MonPicData> | null = null;
const loadData = () => (data ??= fetch(`${BASE}palettes.json`).then((r) => r.json() as Promise<MonPicData>));

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Each spot shifts -8 to +7 pixels by the PID (4 bits for x, 4 for y) and adds 4 to skin indices 1 to 3. */
function spindaSpots(indices: Uint8Array, pid: number, spots: Spot[]) {
  let p = pid >>> 0;
  for (const spot of spots) {
    const x0 = (spot.x + (p & 0x0f) - 8) & 0xff;
    let y = (spot.y + ((p & 0xf0) >> 4) - 8) & 0xff;
    for (const row of spot.rows) {
      for (let col = 0; col < 16; col++) {
        const x = x0 + col;
        if (row & (1 << col) && x < SIZE && y < SIZE) {
          const i = y * SIZE + x;
          if (indices[i] >= 1 && indices[i] <= 3) indices[i] += 4;
        }
      }
      y = (y + 1) & 0xff;
    }
    p >>>= 8;
  }
}

/** Finished 64 x 64 sprite, mirrored as on the summary screen; null without a sprite. */
export async function frontPic(species: number, pid: number, shiny: boolean, egg: boolean, game: number | null = null, flip = true): Promise<HTMLCanvasElement | null> {
  const d = await loadData();
  // Sprite key ("410-attack", the Unown letter); the palette is the species' (Deoxys forms share it).
  const key = egg ? String(d.species.egg) : formKey(species, { pid, game });
  const pals = d.palettes[key.split("-")[0]];
  if (!pals) return null;
  const img = await loadImage(`${BASE}front/${key}.png`);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, SIZE, SIZE);
  const indices = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < indices.length; i++) indices[i] = pixels.data[i * 4] >> 4;
  if (!egg && species === d.species.spinda) spindaSpots(indices, pid, d.spinda);
  const palette = (shiny && !egg && pals[1] ? pals[1] : pals[0]).map((hex) => [1, 3, 5].map((j) => parseInt(hex.slice(j, j + 2), 16)));
  const mirror = flip && !d.noFlip.includes(egg ? d.species.egg : species);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = indices[y * SIZE + (mirror ? SIZE - 1 - x : x)];
      const o = (y * SIZE + x) * 4;
      const [r, g, b] = palette[v];
      pixels.data[o] = r; pixels.data[o + 1] = g; pixels.data[o + 2] = b; pixels.data[o + 3] = v ? 255 : 0;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
