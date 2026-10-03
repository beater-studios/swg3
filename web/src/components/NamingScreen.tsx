// FR/LG box naming screen for typing guides. Images and positions: tools/gen_naming_screen.py (src/naming_screen.c).

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import layout from "../assets/naming/naming.json";
import screenUpper from "../assets/naming/screen-upper.png";
import screenLower from "../assets/naming/screen-lower.png";
import screenSymbols from "../assets/naming/screen-symbols.png";
import cursorStrip from "../assets/naming/cursor.png";
import glyphs from "../assets/naming/glyphs.png";
import titleGlyphs from "../assets/naming/title-glyphs.png";
import pcIcon from "../assets/naming/pc.png";
import underscore from "../assets/naming/underscore.png";
import inputArrow from "../assets/naming/input-arrow.png";
import litPage from "../assets/naming/lit-page.png";
import litBack from "../assets/naming/lit-back.png";
import litOk from "../assets/naming/lit-ok.png";
import boxForest from "../assets/naming/box-forest.png";
import boxCity from "../assets/naming/box-city.png";
import boxDesert from "../assets/naming/box-desert.png";
import boxSavanna from "../assets/naming/box-savanna.png";
import { t } from "../i18n";
import { COLUMNS, NAME_LENGTH, PAGES, press, START, type Cursor, type TypingStep } from "../lib/gen3/boxnames";
import { Button, Tag } from "../ui";

const SCREENS = [screenUpper, screenLower, screenSymbols];
const LIT = [litPage, litBack, litOk];
const WALLPAPERS: Record<string, string> = { forest: boxForest, city: boxCity, desert: boxDesert, savanna: boxSavanna };
const CHARS = [...layout.glyphs.chars];
const STEP_MS = 170;
const GLYPH_H = layout.glyphs.height;

const px = (value: number): string => `calc(var(--gpx) * ${value})`;
const at = (x: number, y: number, w: number, h: number): CSSProperties => ({ left: px(x), top: px(y), width: px(w), height: px(h) });

function frame(src: string, index: number, w: number, h: number, count: number): CSSProperties {
  return { backgroundImage: `url(${src})`, backgroundSize: `${px(w * count)} ${px(h)}`, backgroundPosition: `calc(var(--gpx) * ${-index * w}) 0` };
}

/** Is the cursor on the button column? The game hides the cursor and blinks the button (SpriteCB_Cursor). */
const onButtons = ([page, x]: Cursor) => x === COLUMNS[page];
/** Cursor on OK, where the game moves it on Start or after 8 letters (MoveCursorToOKButton). */
const okCursor = ([page, , , saved]: Cursor): Cursor => [page, COLUMNS[page], 2, saved];

function keyRect([page, x, y]: Cursor): [number, number, number, number] {
  if (x === COLUMNS[page]) return layout.buttons[y] as [number, number, number, number];
  return [layout.columns[page][x] + layout.cursor[0], y * layout.row + layout.cursor[1], 16, 16];
}

export interface NamingScreenProps {
  cursor: Cursor;
  text: string;
  /** Changes on every A press; with `squish`, the cursor plays the press animation. */
  pressed?: number;
  squish?: boolean;
}

export function NamingScreen({ cursor, text, pressed = 0, squish = false }: NamingScreenProps) {
  const [page] = cursor;
  const chars = [...text];
  const current = Math.min(chars.length, NAME_LENGTH - 1);
  const [cx, cy] = keyRect(cursor);
  const glyph = layout.glyphs;
  return (
    <div className="naming-screen" role="img" aria-label={t("Tela de nome de box do jogo, página de {page}, com \"{text}\" digitado", { page: t(PAGES[page]), text })}>
      <img className="naming-bg" src={SCREENS[page]} alt="" width={240} height={160} draggable={false} />
      <span className="naming-pc" style={{ ...at(layout.pc[0], layout.pc[1], 16, 24), ...frame(pcIcon, 0, 16, 24, 2) }} />
      <span className="naming-arrow" style={{ ...at(layout.arrow[0], layout.arrow[1], 8, 8), backgroundImage: `url(${inputArrow})` }} />
      {Array.from({ length: NAME_LENGTH }, (_, i) => (
        <span key={i} className={`naming-underscore${i === current ? " current" : ""}`}
          style={{ ...at(layout.underscore[0] + 8 * i, layout.underscore[1], 8, 8), backgroundImage: `url(${underscore})` }} />
      ))}
      {chars.map((char, i) => CHARS.includes(char) && (
        <span key={i} className="naming-glyph"
          style={{ ...at(layout.text[0] + 8 * i, layout.text[1], glyph.width, glyph.height), ...frame(glyphs, CHARS.indexOf(char), glyph.width, glyph.height, CHARS.length) }} />
      ))}
      {onButtons(cursor) ? (
        <span key={`lit${page}${cursor[2]}`} className="naming-lit" style={{ ...at(cx, cy, layout.buttons[cursor[2]][2], layout.buttons[cursor[2]][3]), backgroundImage: `url(${LIT[cursor[2]]})` }} />
      ) : (
        // The key changes on every move and A press, so the blink restarts from red, as in game.
        <span key={`c${cx},${cy},${pressed}`} className={`naming-cursor${squish ? " squish" : ""}`} style={at(cx, cy, 16, 16)}>
          <span className="naming-cursor-frame" style={frame(cursorStrip, 0, 16, 16, 4)} />
          <span className="naming-cursor-lit" style={frame(cursorStrip, 3, 16, 16, 4)} />
        </span>
      )}
    </div>
  );
}

export function PcBoxTitle({ number, name }: { number: number; name: string }) {
  const box = layout.box;
  const wallpaper = box.wallpapers[(number - 1) % box.wallpapers.length];
  const chars = [...name].filter((c) => CHARS.includes(c));
  const widths = chars.map((c) => box.widths[CHARS.indexOf(c)]);
  let x = box.center - Math.floor(widths.reduce((a, b) => a + b, 0) / 2);
  return (
    <span className="naming-box" style={{ backgroundImage: `url(${WALLPAPERS[wallpaper]})` }}>
      {chars.map((char, i) => {
        const style = { ...at(x, box.y, box.glyph, GLYPH_H), ...frame(titleGlyphs, CHARS.indexOf(char), box.glyph, GLYPH_H, CHARS.length) };
        x += widths[i];
        return <span key={i} className="naming-glyph" style={style} />;
      })}
    </span>
  );
}
interface Frame { cursor: Cursor; typed: number; pressed?: boolean }

/** Name typing guide. With 8 letters the game has already moved the cursor to OK, so the end is just A. */
export function TypingGuide({ box, name, steps, onDone }: { box: number; name: string; steps: TypingStep[]; onDone?: () => void }) {
  const chars = [...name];
  const n = steps.length;
  const cursors = useMemo(() => {
    const out: Cursor[] = [START];
    for (const step of steps) {
      let c = out[out.length - 1];
      for (const m of step.moves) for (let k = 0; k < m.count; k++) c = press(c, m.key);
      out.push(c);
    }
    return out;
  }, [steps]);
  const [typed, setTyped] = useState(0);
  const [done, setDone] = useState(false);
  const [anim, setAnim] = useState<Frame | null>(null);
  const [presses, setPresses] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const finished = typed === n;
  const full = n === NAME_LENGTH;
  const resting: Cursor = done || (finished && full) ? okCursor(cursors[n]) : finished ? cursors[n] : cursors[typed + 1];
  const cursor = anim?.cursor ?? resting;
  const step = finished ? null : steps[typed];

  /** Cursor path from the key of letter `k - 1` (or the start) to letter `k`, with `k` letters typed. */
  const walk = (k: number): Frame[] => {
    const frames: Frame[] = [];
    let c = cursors[k];
    for (const m of steps[k]?.moves ?? []) {
      for (let i = 0; i < m.count; i++) {
        c = press(c, m.key);
        frames.push({ cursor: c, typed: k });
      }
    }
    return frames;
  };

  const running = useRef<{ typed: number; done: boolean; end: () => void } | null>(null);
  const stop = () => {
    window.clearTimeout(timer.current);
    running.current = null;
    setAnim(null);
  };
  const play = (frames: Frame[], after: { typed: number; done: boolean }, end: () => void) => {
    window.clearTimeout(timer.current);
    if (!frames.length) {
      setAnim(null);
      end();
      return;
    }
    running.current = { ...after, end };
    let i = 0;
    const tick = () => {
      if (i === frames.length) {
        running.current = null;
        setAnim(null);
        end();
        return;
      }
      const f = frames[i++];
      if (f.pressed) setPresses((p) => p + 1);
      setAnim(f);
      timer.current = window.setTimeout(tick, f.pressed ? STEP_MS * 2 : STEP_MS);
    };
    tick();
  };

  // New box: the cursor starts on the first key, as in game.
  useEffect(() => {
    setTyped(0);
    setDone(false);
    play(walk(0), { typed: 0, done: false }, () => undefined);
    return () => window.clearTimeout(timer.current);
  }, [name, box]);   // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    let base = typed, isDone = done;
    const current = running.current;
    if (current) {
      stop();
      current.end();
      base = current.typed;
      isDone = current.done;
    }
    if (isDone) return;
    if (base < n) {
      const k = base + 1;
      const after = k < n ? walk(k) : full ? [{ cursor: okCursor(cursors[n]), typed: n }] : [];
      play([{ cursor: cursors[k], typed: k, pressed: true }, ...after], { typed: k, done: false }, () => setTyped(k));
      return;
    }
    const ok = okCursor(cursors[n]);
    const frames: Frame[] = full ? [{ cursor: ok, typed: n, pressed: true }]
      : [{ cursor: ok, typed: n }, { cursor: ok, typed: n, pressed: true }];
    play(frames, { typed: n, done: true }, () => { setDone(true); onDone?.(); });
  };
  const back = () => {
    stop();
    if (done) setDone(false);
    else if (typed > 0) setTyped(typed - 1);
  };
  const jump = (i: number) => {
    stop();
    setDone(false);
    setTyped(i);
  };
  const restart = () => jump(0);
  const onKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
  };

  const shown = anim ? chars.slice(0, anim.typed).join("") : chars.slice(0, typed).join("");
  return (
    <div className="naming-guide" tabIndex={0} onKeyDown={onKey} aria-label={t("Guia de digitação da Box {n}", { n: box })}>
      <div className="naming-stage">
        <NamingScreen cursor={cursor} text={shown} pressed={presses} squish={!!anim?.pressed} />
      </div>
      <div className="naming-side">
        <ol className="naming-letters" aria-label={t("Letras do nome")}>
          {chars.map((char, i) => (
            <li key={i}>
              <button type="button" className={i < typed ? "typed" : i === typed && !done ? "now" : ""} onClick={() => jump(i)}
                title={t("Ir para a letra {n}", { n: i + 1 })}>{char === " " ? "␣" : char}</button>
            </li>
          ))}
        </ol>
        {done ? (
          <p className="naming-now" aria-live="polite"><Tag tone="ok">{t("pronta")}</Tag> {t("Confira o nome no alto da Box {n}, no PC.", { n: box })}</p>
        ) : step ? (
          <p className="naming-now" aria-live="polite">
            {t("Letra {i} de {n}:", { i: typed + 1, n })} <b className="naming-char">{step.char === " " ? "␣" : step.char}</b>{" "}
            <span className="muted">({step.page})</span>
          </p>
        ) : (
          <p className="naming-now" aria-live="polite">{full ? t("Nome completo. O jogo já levou o cursor ao OK: aperte A.") : t("Nome completo. Start leva o cursor ao OK; depois aperte A.")}</p>
        )}
        <div className="naming-controls">
          <Button size="sm" onClick={back} disabled={typed === 0 && !done}>{t("Voltar")}</Button>
          <Button size="sm" variant="primary" onClick={next} disabled={done}>{finished ? t("Confirmar o nome") : t("Próxima letra")}</Button>
          <Button size="sm" onClick={restart} disabled={typed === 0 && !done}>{t("Recomeçar")}</Button>
        </div>
      </div>
    </div>
  );
}
