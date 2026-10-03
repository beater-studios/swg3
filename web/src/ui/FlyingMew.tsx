// Mew flying across the site, fleeing the mouse. Frames: Emerald's Faraway Island Mew (tools/gen_player.py).
// Steps from sAnimTable_Standard; facing right mirrors the left frames, as in game.

import { useEffect, useRef } from "react";
import mew from "../assets/mew.png";

const TICK = 1000 / 60;          // one game frame, in ms
const STEP_TICKS = 8;            // game frames per animation step
const SPEED = 1.5;               // game pixels per frame
const BOB = { px: 2, ms: 1200 }; // hover bob: height and period
// Steps per direction (sAnim_GoSouth, GoNorth and GoWest) and the still front-facing frame.
const WALK = { south: [3, 0, 4, 0], north: [5, 1, 6, 1], west: [7, 2, 8, 2] };
const STILL = 0;
const FIRST = [6000, 15000];     // first appearance, ms after the site opens
const NEXT = [25000, 70000];
const HOVER = [1200, 2600];
// Flee: mouse distance that scares it (px); speed and step rate multipliers; dash duration (ms); with the mouse
// within again * radius mid-dash (after turn ms), it turns again.
const FLEE = { radius: 140, speed: 4, step: 3, dash: [450, 750], again: 0.6, turn: 150 };
// Headings tried around "straight away from the mouse", in degrees.
const TURNS = [-80, -55, -30, 0, 30, 55, 80];
const EDGE = 8;                  // screen margin while fleeing (px)
const BLINK_MS = 320;

export const MEW_EVENT = "swg3:mew";
export const summonMew = () => window.dispatchEvent(new Event(MEW_EVENT));

const between = ([lo, hi]: number[]) => lo + Math.random() * (hi - lo);
interface Point { x: number; y: number; hover: number }

function offscreen(w: number, h: number, W: number, H: number): Point {
  const edge = Math.floor(Math.random() * 4);
  const x = between([0.05 * W, 0.95 * W - w]), y = between([0.05 * H, 0.9 * H - h]);
  const at = [{ x: -w, y }, { x: W, y }, { x, y: -h }, { x, y: H }][edge];
  return { ...at, hover: 0 };
}

export function FlyingMew() {
  const sprite = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let timer = 0, frame = 0, flying = false;
    let mouse: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => { mouse = e.pointerType === "touch" ? null : { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouse = null; };
    const schedule = (range: number[]) => { timer = window.setTimeout(fly, between(range)); };
    function fly() {
      const el = sprite.current;
      if (!el || flying) return;
      if (document.hidden) { schedule(NEXT); return; }
      flying = true;
      const W = window.innerWidth, H = window.innerHeight;
      const scale = 2;
      const w = 16 * scale, h = 32 * scale;
      const inside = (): Point => ({ x: between([0.08 * W, 0.92 * W - w]), y: between([0.1 * H, 0.85 * H - h]), hover: 0 });
      const path = [offscreen(w, h, W, H), inside(), inside(), offscreen(w, h, W, H)];
      if (Math.random() < 0.6) path[1 + Math.floor(Math.random() * 2)].hover = between(HOVER);
      let { x, y } = path[0];
      let next = 1, hoverLeft = 0, ticks = 0, last = performance.now(), facing: keyof typeof WALK = "west", east = false;
      Object.assign(el.style, { width: `${w}px`, height: `${h}px`, backgroundSize: `${144 * scale}px ${32 * scale}px` });
      el.classList.add("on");
      const farFrom = (m: { x: number; y: number }): Point => {
        let best = inside(), far = -1;
        for (let i = 0; i < 12; i++) {
          const p = inside(), d = Math.hypot(p.x + w / 2 - m.x, p.y + h / 2 - m.y);
          if (d > far) { best = p; far = d; }
        }
        return best;
      };
      let blinkUntil = 0;
      let dash: { ux: number; uy: number; left: number; age: number } | null = null;
      // One of the best headings at random, so it does not always flee the same way.
      const dodge = (m: { x: number; y: number }) => {
        const ms = between(FLEE.dash);
        const reach = FLEE.speed * SPEED * scale * (ms / TICK);
        const cx = x + w / 2, cy = y + h / 2;
        const base = Math.atan2(cy - m.y, cx - m.x);
        const options = TURNS.map((deg) => {
          const a = base + ((deg + between([-10, 10])) * Math.PI) / 180;
          const ux = Math.cos(a), uy = Math.sin(a);
          const ex = x + ux * reach, ey = y + uy * reach;
          const fits = ex >= EDGE && ey >= EDGE && ex <= W - w - EDGE && ey <= H - h - EDGE;
          const cxEnd = Math.min(W - w - EDGE, Math.max(EDGE, ex)) + w / 2, cyEnd = Math.min(H - h - EDGE, Math.max(EDGE, ey)) + h / 2;
          return { ux, uy, score: Math.hypot(cxEnd - m.x, cyEnd - m.y) * (fits ? 1 : 0.5) };
        });
        const best = Math.max(...options.map((o) => o.score));
        const good = options.filter((o) => o.score >= 0.85 * best);
        const pick = good[Math.floor(Math.random() * good.length)];
        dash = { ux: pick.ux, uy: pick.uy, left: ms, age: 0 };
        hoverLeft = 0;
      };
      const step = (now: number) => {
        const dt = Math.min(100, now - last);
        last = now;
        ticks += dt / TICK;
        let still = false;
        const onScreen = x >= 0 && y >= 0 && x <= W - w && y <= H - h;
        const m = mouse;
        const cx = x + w / 2, cy = y + h / 2;
        const near = m ? Math.hypot(cx - m.x, cy - m.y) : Infinity;
        const touched = m && m.x > x - EDGE && m.x < x + w + EDGE && m.y > y - EDGE && m.y < y + h + EDGE;
        if (m && touched && now > blinkUntil) {
          ({ x, y } = farFrom(m));
          hoverLeft = 0;
          blinkUntil = now + BLINK_MS;
          el.classList.remove("blink");
          void el.offsetWidth;
          el.classList.add("blink");
          if (next < path.length - 1) path[next] = farFrom(m);
          dash = null;
        } else if (m && onScreen && near < FLEE.radius && (!dash || (dash.age > FLEE.turn && near < FLEE.again * FLEE.radius))) {
          dodge(m);
        }
        if (dash && !touched) {
          const move = FLEE.speed * SPEED * scale * (dt / TICK);
          const nx = x + dash.ux * move, ny = y + dash.uy * move;
          x = Math.min(W - w - EDGE, Math.max(EDGE, nx));
          y = Math.min(H - h - EDGE, Math.max(EDGE, ny));
          if (Math.abs(dash.ux) >= Math.abs(dash.uy)) { facing = "west"; east = dash.ux > 0; } else { facing = dash.uy < 0 ? "north" : "south"; east = false; }
          ticks += (FLEE.step - 1) * (dt / TICK);
          dash.left -= dt;
          dash.age += dt;
          if (dash.left <= 0 || nx !== x || ny !== y) {
            dash = null;
            if (next < path.length - 1) path[next] = m ? farFrom(m) : inside();
          }
        } else if (touched) {
        } else if (hoverLeft > 0) {
          hoverLeft -= dt;
          still = true;
        } else {
          const target = path[next];
          const dx = target.x - x, dy = target.y - y, dist = Math.hypot(dx, dy);
          const move = SPEED * scale * (dt / TICK);
          if (Math.abs(dx) >= Math.abs(dy)) { facing = "west"; east = dx > 0; } else { facing = dy < 0 ? "north" : "south"; east = false; }
          if (dist <= move) {
            x = target.x; y = target.y;
            hoverLeft = target.hover;
            next++;
            if (next === path.length) {
              el.classList.remove("on");
              flying = false;
              schedule(NEXT);
              return;
            }
          } else {
            x += (dx / dist) * move; y += (dy / dist) * move;
          }
        }
        const index = still ? STILL : WALK[facing][Math.floor(ticks / STEP_TICKS) % 4];
        const bob = Math.sin((now / BOB.ms) * 2 * Math.PI) * BOB.px * scale;
        el.style.backgroundPosition = `${-16 * scale * index}px 0`;
        el.style.transform = `translate(${x}px, ${y + bob}px) scaleX(${east && !still ? -1 : 1})`;
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }
    const summon = () => { window.clearTimeout(timer); fly(); };
    window.addEventListener(MEW_EVENT, summon);
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    schedule(FIRST);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener(MEW_EVENT, summon);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return (
    <div className="mew-layer" aria-hidden="true">
      <span className="mew" ref={sprite} style={{ backgroundImage: `url(${mew})` }} />
    </div>
  );
}
