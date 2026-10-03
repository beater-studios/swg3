// FR/LG summary screen drawn on a 240 x 160 canvas as in src/pokemon_summary_screen.c. Parts: tools/gen_summary.py.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import data from "../assets/summary/summary.json";
import { frontPic } from "./monPic";
import pageInfo from "../assets/summary/page-info.png";
import pageSkills from "../assets/summary/page-skills.png";
import pageMoves from "../assets/summary/page-moves.png";
import pageInfoShiny from "../assets/summary/page-info-shiny.png";
import pageSkillsShiny from "../assets/summary/page-skills-shiny.png";
import pageMovesShiny from "../assets/summary/page-moves-shiny.png";
import fontMask from "../assets/summary/font-normal.png";
import typesSrc from "../assets/summary/types.png";
import ballsSrc from "../assets/summary/balls.png";
import extrasSrc from "../assets/summary/extras.png";
import barsSrc from "../assets/summary/bars.png";
import { t } from "../i18n";
import * as charset from "../lib/gen3/charset";
import * as species from "../lib/gen3/species";
import type { Pk3Description } from "../lib/services/pokemon";
import { Segmented } from "../ui";

type Page = "info" | "skills" | "moves";
const PAGES: Page[] = ["info", "skills", "moves"];
const IMAGES: Record<Page, [string, string]> = {
  info: [pageInfo, pageInfoShiny], skills: [pageSkills, pageSkillsShiny], moves: [pageMoves, pageMovesShiny],
};
const LV = 0x105, PP = 0x106;   // {LV_2} and {PP}: font glyphs 0x100 + n (text.c)
const C = data.colors;
// [color, shadow] of each text (sLevelNickTextColors and sPrintMoveTextColors).
const INK = {
  body: [C.types[14], C.types[10]], white: [C.header[1], C.header[2]],
  male: [C.header[9], C.header[8]], female: [C.header[5], C.header[4]],
  move: [C.moves[7], C.moves[8]], yellow: [C.moves[1], C.moves[2]], orange: [C.moves[3], C.moves[4]], red: [C.moves[5], C.moves[6]],
} as const;
type Ink = keyof typeof INK;

/** As the game writes it: uppercase, keeping the é of POKé; _ in internal names (PALLET_TOWN) becomes a space. */
export const gameText = (text: string) => text.replaceAll("_", " ").toUpperCase().replaceAll("POKÉ", "POKé");
const game = gameText;

/** Glyph codes of a text; \u0001 is the {LV_2} glyph. */
function glyphIds(text: string): number[] {
  return [...text].map((ch) => {
    if (ch === "\u0001") return LV;
    try {
      return charset.encode(ch, 1)[0];
    } catch {
      return charset.encode("?", 1)[0];
    }
  });
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

interface Sheets { pages: Record<string, HTMLImageElement>; font: HTMLImageElement; types: HTMLImageElement; balls: HTMLImageElement; extras: HTMLImageElement; bars: HTMLImageElement }
let sheets: Promise<Sheets> | null = null;
function loadSheets(): Promise<Sheets> {
  sheets ??= (async () => {
    const pages: Record<string, HTMLImageElement> = {};
    for (const page of PAGES) {
      pages[page] = await load(IMAGES[page][0]);
      pages[`${page}-shiny`] = await load(IMAGES[page][1]);
    }
    const [font, types, balls, extras, bars] = await Promise.all([fontMask, typesSrc, ballsSrc, extrasSrc, barsSrc].map(load));
    return { pages, font, types, balls, extras, bars };
  })();
  return sheets;
}

// Font tinted per color: the mask's red becomes the color, green becomes the shadow.
const inked = new Map<Ink, HTMLCanvasElement>();
function inkedFont(font: HTMLImageElement, ink: Ink): HTMLCanvasElement {
  const cached = inked.get(ink);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = font.width;
  canvas.height = font.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(font, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const [fg, shadow] = INK[ink].map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (!pixels.data[i + 3]) continue;
    const rgb = pixels.data[i] ? fg : shadow;
    pixels.data.set(rgb, i);
  }
  ctx.putImageData(pixels, 0, 0);
  inked.set(ink, canvas);
  return canvas;
}

function draw(ctx: CanvasRenderingContext2D, s: Sheets, info: Pk3Description, page: Page, pic: HTMLCanvasElement | null) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 240, 160);
  ctx.drawImage(s.pages[info.shiny ? `${page}-shiny` : page], 0, 0);
  const text = (value: string | number[], x: number, y: number, ink: Ink = "body") => {
    const ids = typeof value === "string" ? glyphIds(value) : value;
    const sheet = inkedFont(s.font, ink);
    for (const id of ids) {
      ctx.drawImage(sheet, (id % 16) * 16, Math.floor(id / 16) * 16, 16, 16, x, y, 16, 16);
      x += data.widths[id];
    }
  };
  const right = (value: string, rightEdge: number, y: number, ink: Ink = "body") => text(value, rightEdge - 6 * [...value].length, y, ink);
  const typeIcon = (type: number, x: number, y: number) => ctx.drawImage(s.types, type * 32, 0, 32, 12, x, y, 32, 12);

  const info0 = species.info(info.species.id);
  const level = info.party_data?.level ?? info.level ?? 1;
  const stats = info.party_data?.stats ?? info.stats ?? [];
  const ballIndex = info.ball.id >= 1 && info.ball.id <= 12 ? info.ball.id - 1 : 3;

  // Lv, nickname (up to 10) and gender in the strip below the title (PrintMonLevelNickOnWindow2).
  text([LV, ...glyphIds(String(level))], 4, 18, "white");
  text([...info.nickname].slice(0, 10).join(""), 40, 18, "white");
  if (info.gender === "M") text("♂", 105, 18, "male");
  else if (info.gender === "F") text("♀", 105, 18, "female");

  // Picture box: 64 x 64, centered at (60, 65) (PokeSum_CreateMonPicSprite).
  if (pic) ctx.drawImage(pic, 28, 33);
  else ctx.drawImage(s.balls, ballIndex * 16, 0, 16, 16, 44, 49, 32, 32);
  ctx.drawImage(s.balls, ballIndex * 16, 0, 16, 16, 98, 80, 16, 16);
  if (info.shiny) ctx.drawImage(s.extras, 0, 0, 8, 8, 102, 36, 8, 8);
  const infected = (info.pokerus & 0x0f) !== 0;
  if (infected) ctx.drawImage(s.extras, 18, 0, 30, 8, 2, 34, 30, 8);   // PKRS (the 2 leftmost columns fall outside the window)
  else if (info.pokerus) ctx.drawImage(s.extras, 8, 0, 8, 8, 110, 88, 8, 8);

  if (page === "info") {
    text(String(info.species.national ?? species.nationalNumber(info.species.id)).padStart(3, "0"), 167, 21);
    text(game(info.species.name), 167, 35);
    const [type1, type2] = info0.types;
    typeIcon(type1, 167, 51);
    if (type2 !== type1) typeIcon(type2, 203, 51);
    text([...info.ot_name].slice(0, 7).join(""), 167, 65);
    text(String(info.tid).padStart(5, "0"), 167, 80);
    text(info.held_item.id ? game(info.held_item.name) : "NONE", 167, 95);
    memo(info).forEach((line, i) => text(line, 8, 115 + 14 * i));
  } else if (page === "skills") {
    const [hp, atk, def, spe, spa, spd] = stats;
    const current = info.party_data?.current_hp ?? hp;
    if (hp !== undefined) right(`${current}/${hp}`, 237, 20);
    [atk, def, spa, spd, spe].forEach((v, i) => v !== undefined && right(String(v), 237, 38 + 13 * i));
    const table = species.expTable(info.species.id);
    const next = level >= species.MAX_LEVEL ? 0 : table[level + 1] - info.experience;
    right(String(info.experience), 238, 103);
    right(String(Math.max(0, next)), 238, 116);
    text("EXP. POINTS", 74, 103);
    text("NEXT LV.", 74, 116);
    const ability = info0.abilities[info.ability_num && info0.abilities[1] ? 1 : 0];
    text(game(species.abilityName(ability)), 74, 129);
    text(data.ability_desc[ability] ?? "", 10, 143);
    if (hp) hpBar(ctx, s.bars, current, hp);
    expBar(ctx, s.bars, table, level, info.experience);
  } else {
    info.moves.forEach((move, i) => {
      const y = 21 + 28 * i;
      if (!move.id) {
        text("-", 163, y, "move");
        text("--", 205, y + 11, "move");
        return;
      }
      typeIcon(species.data().move_type[move.id], 123, y);
      text(game(move.name), 163, y, "move");
      const bonus = (info.pp_bonuses >> (2 * i)) & 3;
      const base = species.data().move_pp[move.id];
      const max = base + Math.floor((base * 20 * bonus) / 100);
      const ink = ppInk(move.pp, max);
      text([PP], 196, y + 11, ink);
      right(String(move.pp), 218, y + 11, ink);
      text("/", 218, y + 11, ink);
      right(String(max), 236, y + 11, ink);
    });
  }
}

// PP color (sPrintMoveTextColors): red at 0 PP; yellow and orange when running low.
function ppInk(cur: number, max: number): Ink {
  if (cur === max) return "move";
  if (cur === 0) return "red";
  if (max === 3) return cur === 2 ? "orange" : "yellow";
  if (max === 2) return "yellow";
  if (cur <= Math.floor(max / 4)) return "orange";
  if (cur <= Math.floor(max / 2)) return "yellow";
  return "move";
}

/** Trainer Memo lines (PokeSum_PrintTrainerMemo_Mon, own-trainer path). */
function memo(info: Pk3Description): string[] {
  const nature = game(info.nature);
  const location = info.met_location.id >= 0x58 && info.met_location.id < 0xc5 ? game(info.met_location.name) : "a trade";
  const at = (lv: number) => `at \u0001 ${lv}`;
  if (info.met_level === 0) {
    return info.fateful
      ? [`${nature} nature. Met in a fateful`, `encounter (hatched: ${location}`, `${at(5)}).`]
      : [`${nature} nature.`, `Hatched: ${location}`, `${at(5)}.`];
  }
  if (info.met_location.id === 0xff) return [`${nature} nature.`, "Met in a fateful encounter when", `${at(info.met_level)}.`];
  return [`${nature} nature.`, `Met in ${location} ${at(info.met_level)}.`];
}

// Bars (CreateHpBarObjs and CreateExpBarObjs): 8 x 8 sheet tiles, label in tiles 9 and 10, end cap in 11.
function hpBar(ctx: CanvasRenderingContext2D, bars: HTMLImageElement, cur: number, max: number) {
  const fraction = cur ? Math.max(1, Math.floor((cur * 48) / max)) : 0;
  const row = cur === max || fraction > 24 || cur === 0 ? 0 : fraction > 9 ? 1 : 2;
  const fill = barTiles(cur, max, 6, 6);
  [9, 10, ...fill, 11].forEach((tile, i) => ctx.drawImage(bars, tile * 8, row * 8, 8, 8, 168 + 8 * i, 32, 8, 8));
}

function expBar(ctx: CanvasRenderingContext2D, bars: HTMLImageElement, table: number[], level: number, exp: number) {
  let fill = Array(8).fill(0);
  if (level < species.MAX_LEVEL) {
    fill = barTiles(exp - table[level], table[level + 1] - table[level], 8, 8);
    // With all 8 tiles full, the last shows 7 pixels: the bar never looks complete before leveling up.
    if (fill[7] === 8) fill[7] = 7;
  }
  [9, 10, ...fill, 11].forEach((tile, i) => ctx.drawImage(bars, tile * 8, 24, 8, 8, 152 + 8 * i, 128, 8, 8));
}

// Fill as in game: points per tile = total * 4 / n; full tiles, then the partial one at (remainder * mult) / ppt.
function barTiles(cur: number, total: number, count: number, mult: number): number[] {
  if (cur >= total) return Array(count).fill(8);
  const ppt = Math.floor((total * 4) / count);
  if (!ppt) return Array(count).fill(0);
  let rest = cur * 4, full = 0;
  while (rest > ppt && full < count) { rest -= ppt; full++; }
  return Array.from({ length: count }, (_, i) => (i < full ? 8 : i === full ? Math.floor((rest * mult) / ppt) : 0));
}

export function SummaryScreen({ info }: { info: Pk3Description }) {
  const [page, setPage] = useState<Page>("info");
  const canvas = useRef<HTMLCanvasElement>(null);
  const label = useMemo(() => ({ info: "INFO", skills: "SKILLS", moves: "MOVES" }), []);
  const pic = useMemo(() => frontPic(info.species.id, parseInt(info.pid, 16), info.shiny, info.is_egg, info.met_game.id).catch(() => null),
    [info.species.id, info.pid, info.shiny, info.is_egg, info.met_game.id]);
  useEffect(() => {
    let alive = true;
    Promise.all([loadSheets(), pic]).then(([s, p]) => {
      const ctx = canvas.current?.getContext("2d");
      if (alive && ctx) draw(ctx, s, info, page, p);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [info, page, pic]);
  const onKey = (e: KeyboardEvent) => {
    const i = PAGES.indexOf(page);
    if (e.key === "ArrowRight" && i < PAGES.length - 1) { e.preventDefault(); setPage(PAGES[i + 1]); }
    if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); setPage(PAGES[i - 1]); }
  };
  return (
    <div className="summary-screen">
      <canvas ref={canvas} width={240} height={160} tabIndex={0} onKeyDown={onKey}
        role="img" aria-label={t("Tela de resumo do jogo, página {page}", { page: label[page] })} />
      <Segmented label={t("Página")} name="summary-page" value={page} onChange={setPage}
        options={PAGES.map((p) => ({ value: p, label: label[p] }))} />
    </div>
  );
}
