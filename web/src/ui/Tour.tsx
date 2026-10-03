// Professor Oak tour overlay in an FR/LG dialog box. Art: tools/gen_oak.py (FR/LG decomp).
// The text animates even with reduced motion, like the game screens.

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { t } from "../i18n";
import { Button } from "./Button";
import oak from "../assets/oak/oak.png";
import dialog from "../assets/oak/dialog.png";
import arrow from "../assets/oak/arrow.png";

export interface TourViewStep {
  /** data-tour marker of the highlighted element; null for a centered step. */
  target: string | null;
  html: string;
}

const PAD = 8;            // highlight padding around the element
const GAP = 14;           // distance between the highlight and the box
const CHAR_MS = 22;
const MOBILE = 640;
interface Rect { top: number; left: number; width: number; height: number }

const isField = (el: EventTarget | null) => el instanceof HTMLElement && (el.closest("input, select, textarea, [contenteditable]") !== null);

/** Letter-by-letter text: empties the HTML text nodes and refills them gradually. */
function useTypewriter(container: React.RefObject<HTMLDivElement | null>, html: string) {
  const [done, setDone] = useState(false);
  const finish = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    setDone(false);
    // Always restart from the original HTML: the effect may rerun on already emptied nodes (StrictMode in dev), and the
    // text would vanish.
    root.innerHTML = html;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: { node: Text; text: string }[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push({ node: n as Text, text: n.textContent ?? "" });
    for (const n of nodes) n.node.textContent = "";
    let i = 0, pos = 0;
    const total = () => { for (const n of nodes) n.node.textContent = n.text; setDone(true); };
    const id = window.setInterval(() => {
      while (i < nodes.length && pos >= nodes[i].text.length) { i++; pos = 0; }
      if (i >= nodes.length) { window.clearInterval(id); setDone(true); return; }
      pos++;
      nodes[i].node.textContent = nodes[i].text.slice(0, pos);
    }, CHAR_MS);
    finish.current = () => { window.clearInterval(id); total(); };
    return () => window.clearInterval(id);
  }, [html, container]);
  return { done, finish: () => finish.current() };
}

export function Tour({ step, index, total, title, waiting = false, onNext, onBack, onExit }: {
  step: TourViewStep;
  index: number;
  total: number;
  title: string;
  /** The step waits for an action on the page: Next is disabled. */
  waiting?: boolean;
  onNext: () => void;
  onBack: () => void;
  onExit: () => void;
}) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [hole, setHole] = useState<Rect | null>(null);
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight, boxH: 0 });
  const { done, finish } = useTypewriter(text, step.html);
  const last = index === total - 1;

  useEffect(() => {
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
    // Taller than the screen: top just below the fixed header, where the step's subject usually is.
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.height <= window.innerHeight * 0.75) el.scrollIntoView({ block: "center", behavior: "smooth" });
      else {
        const header = document.querySelector("body > #root header, header")?.getBoundingClientRect().height ?? 0;
        window.scrollTo({ top: r.top + window.scrollY - header - 16, behavior: "smooth" });
      }
    }
    box.current?.focus({ preventScroll: true });
    let frame = 0;
    const measure = () => {
      const r = el?.getBoundingClientRect();
      setHole((cur) => {
        if (!r) return null;
        const next = { top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD };
        return cur && Math.abs(cur.top - next.top) < 0.5 && Math.abs(cur.left - next.left) < 0.5 && cur.width === next.width && cur.height === next.height ? cur : next;
      });
      setView((cur) => {
        const next = { w: window.innerWidth, h: window.innerHeight, boxH: box.current?.offsetHeight ?? 0 };
        return cur.w === next.w && cur.h === next.h && cur.boxH === next.boxH ? cur : next;
      });
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [step.target, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onExit(); return; }
      if (isField(e.target)) return;
      if (e.key === "ArrowRight" || (e.key === "Enter" && box.current?.contains(e.target as Node) && !(e.target instanceof HTMLButtonElement))) {
        e.preventDefault();
        if (!done) finish();
        else if (!waiting) onNext();
      } else if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, waiting, index, onNext, onBack, onExit, finish]);

  // The hole stays clickable.
  const h = hole && { top: Math.max(0, hole.top), left: Math.max(0, hole.left), right: Math.min(view.w, hole.left + hole.width), bottom: Math.min(view.h, hole.top + hole.height) };
  const shades: CSSProperties[] = h
    ? [
      { top: 0, left: 0, right: 0, height: h.top },
      { top: h.bottom, left: 0, right: 0, bottom: 0 },
      { top: h.top, left: 0, width: h.left, height: h.bottom - h.top },
      { top: h.top, left: h.right, right: 0, height: h.bottom - h.top },
    ]
    : [{ inset: 0 }];

  const mobile = view.w < MOBILE;
  let place: CSSProperties;
  if (mobile || !h) place = mobile ? { left: 8, right: 8, bottom: 8 } : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  else {
    const width = Math.min(640, view.w - 32);
    const left = Math.max(16, Math.min(h.left, view.w - width - 16));
    if (view.h - h.bottom >= view.boxH + GAP + 8) place = { left, top: h.bottom + GAP, width };
    else if (h.top >= view.boxH + GAP + 8) place = { left, top: h.top - GAP - view.boxH, width };
    else place = { left, bottom: 16, width };
  }

  return (
    <div className="tour-layer">
      {shades.map((style, i) => <div key={i} className="tour-shade" style={style} />)}
      {h && <div className="tour-ring" style={{ top: h.top, left: h.left, width: h.right - h.left, height: h.bottom - h.top }} />}
      <div className={mobile ? "tour mobile" : "tour"} style={place} ref={box} tabIndex={-1} role="dialog" aria-labelledby={titleId}>
        <span id={titleId} className="sr-only">{t("{title}, passo {n} de {total}", { title, n: index + 1, total })}</span>
        <img className="tour-oak" src={oak} alt="" width={64} height={96} draggable={false} />
        <div className="tour-main">
          <div className="tour-box" style={{ borderImageSource: `url(${dialog})` }} onClick={() => { if (!done) finish(); }}>
            <div className="sr-only" aria-live="polite" dangerouslySetInnerHTML={{ __html: step.html }} />
            <div key={index} ref={text} className="tour-text" aria-hidden="true" dangerouslySetInnerHTML={{ __html: step.html }} />
            {done && !waiting && <span className="tour-arrow" style={{ backgroundImage: `url(${arrow})` }} aria-hidden="true" />}
          </div>
          <div className="tour-actions">
            <span className="tour-count">{index + 1}/{total}</span>
            {waiting && <span className="tour-wait">{t("Faça isso na página para seguir")}</span>}
            <span className="tour-buttons">
              <Button size="sm" onClick={onExit}>{t("Sair")}</Button>
              <Button size="sm" disabled={index === 0} onClick={onBack}>{t("Voltar")}</Button>
              <Button size="sm" variant="primary" disabled={waiting} onClick={onNext}>{last ? t("Concluir") : t("Próximo")}</Button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
