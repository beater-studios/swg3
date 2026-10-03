// FR/LG Town Map (Kanto, Sevii) and Hoenn.
// Images and grid: tools/gen_town_map.py (src/data/region_map of pokefirered and pokeemerald).

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import data from "@data/frlg_region_map.json";
import { t } from "../i18n";
import { mapSection } from "../lib/gen3/species";
import mapHoenn from "../assets/townmap/map-hoenn.png";
import mapKanto from "../assets/townmap/map-kanto.png";
import mapSevii123 from "../assets/townmap/map-sevii123.png";
import mapSevii45 from "../assets/townmap/map-sevii45.png";
import mapSevii67 from "../assets/townmap/map-sevii67.png";
import switchKantoOn from "../assets/townmap/switch-kanto-on.png";
import switchKantoOff from "../assets/townmap/switch-kanto-off.png";
import switchSevii123On from "../assets/townmap/switch-sevii123-on.png";
import switchSevii123Off from "../assets/townmap/switch-sevii123-off.png";
import switchSevii45On from "../assets/townmap/switch-sevii45-on.png";
import switchSevii45Off from "../assets/townmap/switch-sevii45-off.png";
import switchSevii67On from "../assets/townmap/switch-sevii67-on.png";
import switchSevii67Off from "../assets/townmap/switch-sevii67-off.png";
import caseLeft from "../assets/townmap/case-left.png";
import caseRight from "../assets/townmap/case-right.png";
import caseLeftTall from "../assets/townmap/case-left-tall.png";
import caseRightTall from "../assets/townmap/case-right-tall.png";
import cursor from "../assets/townmap/cursor.png";

export type TownMapGame = "frlg" | "rse";
interface Region {
  id: string; name: string; game: TownMapGame;
  /** Region screen, map image corner within it and grid origin, in game pixels. */
  screen: [number, number]; image: [number, number]; origin: [number, number];
  size: [number, number]; none: number;
  label: { x: number; y: number; width: number };
  /** Case: left edge of each half closed and open, top, height and whether it uses the tall version (Hoenn). */
  case: { closed: [number, number]; open: [number, number]; top: number; height: number; tall: boolean };
  map: number[][]; dungeon: number[][];
  /** Locations that fall on an already occupied cell: [x, y, section]. */
  extra: [number, number, number][];
}
const ALL_REGIONS = data.regions as Region[];
const CELL = data.cell;
const LINE = 12;   // height of each name in the label (plus 2 of margin)
const ORIGINS: Record<TownMapGame, number[]> = { rse: [1, 2, 3], frlg: [4, 5] };
const IMAGES: Record<string, { map: string; on?: string; off?: string }> = {
  kanto: { map: mapKanto, on: switchKantoOn, off: switchKantoOff },
  sevii123: { map: mapSevii123, on: switchSevii123On, off: switchSevii123Off },
  sevii45: { map: mapSevii45, on: switchSevii45On, off: switchSevii45Off },
  sevii67: { map: mapSevii67, on: switchSevii67On, off: switchSevii67Off },
  hoenn: { map: mapHoenn },
};
// Case: open, its edge sits against the map (pixels 24 to 215 in FR/LG), covering the screen's white columns.
const OPEN_MS = 420;
// Zoom scales only the map layer. The view stores the visible top-left corner as a screen fraction.
const ZOOMS = [1, 1.5, 2, 3];
const MAX_ZOOM = ZOOMS[ZOOMS.length - 1];
const DRAG_PX = 6;   // beyond this it is a drag, not a tap on a cell
interface View { z: number; u: number; v: number }
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const fitView = (z: number, u: number, v: number): View => {
  const zoom = clamp(z, 1, MAX_ZOOM);
  return { z: zoom, u: clamp(u, 0, 1 - 1 / zoom), v: clamp(v, 0, 1 - 1 / zoom) };
};
/** View at zoom `z` centered on (cx, cy), as screen fractions. */
const centered = (z: number, cx: number, cy: number) => fitView(z, cx - 1 / (2 * z), cy - 1 / (2 * z));

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

export interface TownMapChoice { value: string; label: string }

function ChoiceMenu({ options, onPick, onCancel }: { options: TownMapChoice[]; onPick: (value: string) => void; onCancel: () => void }) {
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => { items.current[0]?.focus(); }, [options]);
  const onKey = (e: KeyboardEvent, i: number) => {
    // The map behind also listens to arrows: the menu takes them while open.
    e.stopPropagation();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items.current[(i + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };
  return (
    <div className="townmap-menu" role="menu" aria-label={t("Escolha o local")}>
      {options.map((o, i) => (
        // Hovering an item moves focus (and the arrow) to it: a single arrow, as in game.
        <button key={o.value} ref={(el) => { items.current[i] = el; }} type="button" role="menuitem"
          onPointerEnter={(e) => { if (e.pointerType === "mouse") e.currentTarget.focus(); }}
          onKeyDown={(e) => onKey(e, i)} onClick={() => onPick(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/** Section name: Hoenn from Emerald (0xC5 onward exists only there), Kanto and Sevii from FR/LG. */
const nameOf = (region: Region, section: number) => mapSection(section, region.game === "rse" ? 3 : null).replaceAll("_", " ");

function sectionsAt(region: Region, x: number, y: number): number[] {
  const extra = region.extra.filter((e) => e[0] === x && e[1] === y).map((e) => e[2]);
  return [region.map[y][x], region.dungeon[y][x], ...extra].filter((s, i, all) => s !== region.none && all.indexOf(s) === i);
}

function findSection(regions: Region[], section: number | null, prefer: TownMapGame | null): { region: number; x: number; y: number } | null {
  if (section === null) return null;
  const order = regions.map((_, i) => i).sort((a, b) => Number(regions[b].game === prefer) - Number(regions[a].game === prefer));
  for (const r of order) {
    for (let y = 0; y < regions[r].map.length; y++) {
      for (let x = 0; x < regions[r].map[y].length; x++) {
        if (sectionsAt(regions[r], x, y).includes(section)) return { region: r, x, y };
      }
    }
  }
  return null;
}

export function TownMap({ games = ["frlg"], game = null, value, choices, marked, onPick, onClose }: {
  games?: TownMapGame[];
  /** Origin game (pk3 number). */
  game?: number | null;
  value: number | null;
  /** Locations the section yields, given the map's game; empty: not pickable. */
  choices: (section: number, games: TownMapGame) => TownMapChoice[];
  marked?: ReadonlySet<number>;
  onPick: (value: string) => void;
  onClose?: () => void;
}) {
  const key = games.join();
  const regions = useMemo(() => ALL_REGIONS.filter((r) => games.includes(r.game)), [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Pallet and Littleroot share cell (4, 11).
  const family = (Object.keys(ORIGINS) as TownMapGame[]).find((g) => game !== null && ORIGINS[g].includes(game)) ?? null;
  const start = useMemo(() => findSection(regions, value, family)
    ?? { region: Math.max(0, regions.findIndex((r) => r.game === family)), x: 4, y: 11 }, [regions, value, family]);
  const [regionIndex, setRegionIndex] = useState(start.region);
  const [cursorAt, setCursorAt] = useState({ x: start.x, y: start.y });
  const [pending, setPending] = useState<TownMapChoice[] | null>(null);
  // Touch: the first tap only moves the cursor; a second tap or "Choose" confirms.
  const [touch, setTouch] = useState(false);
  const pointer = useRef("mouse");
  const [open, setOpen] = useState(false);
  const screen = useRef<HTMLDivElement>(null);
  const region = regions[regionIndex] ?? regions[0];
  const [SW, SH] = region.screen;
  const [IX, IY] = region.image;
  const [OX, OY] = region.origin;
  const [GW, GH] = region.size;
  const CASE = region.case;
  const [view, setView] = useState<View>({ z: 1, u: 0, v: 0 });
  const dragged = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const cursorPoint = (at = cursorAt) => [(OX + CELL * at.x + CELL / 2) / SW, (OY + CELL * at.y + CELL / 2) / SH] as const;
  const zoomStep = (dir: 1 | -1) => setView((cur) => {
    const next = ZOOMS[clamp(ZOOMS.findIndex((z) => z >= cur.z) + dir, 0, ZOOMS.length - 1)];
    if (next === 1) return { z: 1, u: 0, v: 0 };
    // Zooming in from the full map centers on the cursor; afterwards it keeps the view's center.
    const [cx, cy] = cur.z === 1 ? cursorPoint() : [cur.u + 1 / (2 * cur.z), cur.v + 1 / (2 * cur.z)];
    return centered(next, cx, cy);
  });
  useEffect(() => {
    setView((cur) => {
      if (cur.z === 1) return cur;
      const [cx, cy] = cursorPoint();
      const span = 1 / cur.z, margin = CELL / SW;
      const u = cx < cur.u + margin ? cx - margin : cx > cur.u + span - margin ? cx - span + margin : cur.u;
      const v = cy < cur.v + margin ? cy - margin : cy > cur.v + span - margin ? cy - span + margin : cur.v;
      return u === cur.u && v === cur.v ? cur : fitView(cur.z, u, v);
    });
  }, [cursorAt]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Listens on window during the gesture so a finger leaving the map is not lost.
  const onViewPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const box = e.currentTarget.parentElement!.getBoundingClientRect();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) dragged.current = false;
    const start = new Map(pointers.current);
    const startView = view;
    const pts = () => [...pointers.current.values()];
    const startPts = [...start.values()];
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const move = (ev: globalThis.PointerEvent) => {
      if (!pointers.current.has(ev.pointerId)) return;
      pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const now = pts();
      if (now.length >= 2 && startPts.length >= 2) {
        dragged.current = true;
        const mid = { x: (now[0].x + now[1].x) / 2 - box.left, y: (now[0].y + now[1].y) / 2 - box.top };
        const startMid = { x: (startPts[0].x + startPts[1].x) / 2 - box.left, y: (startPts[0].y + startPts[1].y) / 2 - box.top };
        const z = clamp(startView.z * (dist(now[0], now[1]) / Math.max(1, dist(startPts[0], startPts[1]))), 1, MAX_ZOOM);
        // The map point between the fingers stays between them.
        const cu = startView.u + startMid.x / box.width / startView.z, cv = startView.v + startMid.y / box.height / startView.z;
        setView(fitView(z, cu - mid.x / box.width / z, cv - mid.y / box.height / z));
        return;
      }
      const first = startPts[0];
      const dx = ev.clientX - first.x, dy = ev.clientY - first.y;
      if (!dragged.current && Math.hypot(dx, dy) < DRAG_PX) return;
      dragged.current = true;
      if (startView.z > 1) setView(fitView(startView.z, startView.u - dx / box.width / startView.z, startView.v - dy / box.height / startView.z));
    };
    const up = (ev: globalThis.PointerEvent) => {
      pointers.current.delete(ev.pointerId);
      if (pointers.current.size) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // Opens on the frame after the first paint so the transition runs (OPEN_MS matches site.css).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    const done = window.setTimeout(() => setReady(true), OPEN_MS);
    screen.current?.focus();
    return () => { cancelAnimationFrame(frame); window.clearTimeout(done); };
  }, []);

  const here = sectionsAt(region, cursorAt.x, cursorAt.y);
  const optionsAt = (x: number, y: number) => sectionsAt(region, x, y).flatMap((s) => choices(s, region.game));
  const pick = (x: number, y: number) => {
    const options = optionsAt(x, y);
    if (options.length === 1) onPick(options[0].value);
    else if (options.length > 1) setPending(options);
  };
  const moveTo = (x: number, y: number) => {
    setCursorAt({ x, y });
    setPending(null);
  };
  const onKey = (e: KeyboardEvent) => {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (delta) {
      e.preventDefault();
      moveTo(clamp(cursorAt.x + delta[0], 0, GW - 1), clamp(cursorAt.y + delta[1], 0, GH - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(cursorAt.x, cursorAt.y);
    }
  };
  const switchRegion = (index: number) => {
    setRegionIndex(index);
    const first = regions[index].map.flatMap((row, y) => row.map((_, x) => ({ x, y }))).find((c) => sectionsAt(regions[index], c.x, c.y).length);
    if (first) setCursorAt(first);
    setPending(null);
    setView({ z: 1, u: 0, v: 0 });
  };

  const cells = region.map.flatMap((row, y) => row.map((_, x) => ({ x, y, sections: sectionsAt(region, x, y) }))).filter((c) => c.sections.length);
  const label = region.label;
  const labelHeight = 2 + LINE * here.length;
  const frlgRegions = regions.filter((r) => r.game === "frlg");
  const families = [...new Set(regions.map((r) => r.game))];
  const switchFamily = (dir: 1 | -1) => {
    const next = families[(families.indexOf(region.game) + dir + families.length) % families.length];
    switchRegion(regions.findIndex((r) => r.game === next));
  };
  const box = (x: number, y: number, w: number, h: number): CSSProperties => ({ left: pct(x, SW), top: pct(y, SH), width: pct(w, SW), height: pct(h, SH) });

  return (
    <div className="townmap">
      <div className={open ? "townmap-screen open" : "townmap-screen"} ref={screen} tabIndex={0} onKeyDown={onKey}
        style={{ aspectRatio: `${SW} / ${SH}`, "--gpx": `calc(100cqw / ${SW})` } as CSSProperties}
        role="application" aria-label={t("Mapa da região: setas andam, Enter escolhe")}
        onClick={(e) => { if (!(e.target as Element).closest(".townmap-menu, .townmap-cell, button")) setPending(null); }}>
        <div className="townmap-bar">
          {families.length > 1 ? (
            <span className="townmap-region">
              <button type="button" aria-label={t("Região anterior")} title={t("Região anterior")} onClick={() => switchFamily(-1)}>◀</button>
              <span>{region.name}</span>
              <button type="button" aria-label={t("Próxima região")} title={t("Próxima região")} onClick={() => switchFamily(1)}>▶</button>
            </span>
          ) : <span>{region.name}</span>}
          <span className="townmap-bar-actions">
            {touch && ready && !pending && optionsAt(cursorAt.x, cursorAt.y).length > 0 && (
              <button type="button" className="townmap-confirm" onClick={() => pick(cursorAt.x, cursorAt.y)}>
                <span className="townmap-key" aria-hidden="true">A</span>{t("Escolher")}
              </button>
            )}
            {onClose && <button type="button" className="townmap-close" aria-label={t("Fechar")} title={t("Fechar")} onClick={onClose}>×</button>}
          </span>
        </div>
        <div className={view.z > 1 ? "townmap-view zoomed" : "townmap-view"} onPointerDown={onViewPointerDown}
          style={{ transform: `scale(${view.z}) translate(${-view.u * 100}%, ${-view.v * 100}%)` }}>
        <img key={region.id} className="townmap-map" src={IMAGES[region.id].map} alt="" width={240} height={160} draggable={false}
          style={box(IX, IY, 240, 160)} />
        {cells.map(({ x, y, sections }) => {
          const selectable = sections.some((s) => choices(s, region.game).length);
          const isMarked = marked && sections.some((s) => marked.has(s));
          return (
            <button key={`${x}-${y}`} type="button" tabIndex={-1} style={box(OX + CELL * x, OY + CELL * y, CELL, CELL)}
              className={["townmap-cell", selectable ? "" : "off", isMarked ? "marked" : ""].filter(Boolean).join(" ")}
              aria-label={sections.map((s) => nameOf(region, s)).join(" / ")} aria-disabled={!selectable}
              onPointerDown={(e) => { pointer.current = e.pointerType; if (e.pointerType !== "mouse") setTouch(true); }}
              onPointerEnter={(e) => { if (e.pointerType === "mouse") setCursorAt({ x, y }); }}
              onClick={() => {
                // End of a drag or pinch: not a tap on the cell.
                if (dragged.current) { dragged.current = false; return; }
                const again = cursorAt.x === x && cursorAt.y === y;
                if (pointer.current !== "mouse" && !again) { moveTo(x, y); return; }
                setCursorAt({ x, y });
                setPending(null);
                if (selectable) pick(x, y);
              }} />
          );
        })}
        <span className="townmap-cursor" style={{ ...box(OX + CELL * cursorAt.x - 4, OY + CELL * cursorAt.y - 4, 16, 16), backgroundImage: `url(${cursor})` }} />
        </div>
        {ready && here.length > 0 && (
          <div className="townmap-label" style={box(label.x, label.y, label.width, labelHeight)}>
            {here.map((s, i) => <span key={s} className={i ? "dungeon" : undefined}>{nameOf(region, s)}</span>)}
          </div>
        )}
        {pending && <ChoiceMenu options={pending} onPick={onPick} onCancel={() => { setPending(null); screen.current?.focus(); }} />}
        {/* Keyed by region: switching regions remounts the case already open, without animating. */}
        <img key={`case-left-${region.id}`} className="townmap-case left" src={CASE.tall ? caseLeftTall : caseLeft} alt="" width={29} height={CASE.tall ? 165 : 149} style={{ ...box(open ? CASE.open[0] : CASE.closed[0], CASE.top, 29, CASE.height) }} />
        <img key={`case-right-${region.id}`} className="townmap-case right" src={CASE.tall ? caseRightTall : caseRight} alt="" width={29} height={CASE.tall ? 165 : 149} style={{ ...box(open ? CASE.open[1] : CASE.closed[1], CASE.top, 29, CASE.height) }} />
      </div>
      <div className="townmap-zoom" role="group" aria-label={t("Zoom do mapa")}>
        <button type="button" aria-label={t("Afastar")} title={t("Afastar")} disabled={view.z === 1} onClick={() => zoomStep(-1)}>−</button>
        <span className="townmap-zoom-level" aria-live="polite">{view.z.toLocaleString(document.documentElement.lang || undefined)}×</span>
        <button type="button" aria-label={t("Aproximar")} title={t("Aproximar")} disabled={view.z === MAX_ZOOM} onClick={() => zoomStep(1)}>+</button>
        <button type="button" className="townmap-zoom-all" disabled={view.z === 1} onClick={() => setView({ z: 1, u: 0, v: 0 })}>{t("Mapa inteiro")}</button>
        {view.z > 1 && <span className="townmap-zoom-hint">{t("Arraste para mover")}</span>}
      </div>
      {region.game === "frlg" && frlgRegions.length > 1 && (
        <div className="townmap-switch" role="group" aria-label={t("Região")}>
          {frlgRegions.map((r) => {
            const i = regions.indexOf(r);
            return (
              <button key={r.id} type="button" aria-pressed={i === regionIndex} title={r.name} onClick={() => switchRegion(i)}>
                <img src={i === regionIndex ? IMAGES[r.id].on : IMAGES[r.id].off} alt={r.name} width={96} height={32} draggable={false} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
