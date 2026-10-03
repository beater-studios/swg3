// Jargon term with a tooltip. TermTips, mounted once in the layout, serves every .term, including guide Markdown.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { t } from "../i18n";
import { ITEM_WORDS, isItemWord, wordsPattern } from "../i18n/gameWords";
import { InGame } from "./feedback";
import { Item } from "./ItemIcon";

export interface TermInfo {
  title: string;
  text: string;
  href?: string;
}

export function Term({ k, children }: { k: string; children: ReactNode }) {
  return <button type="button" className="term" data-term={k}>{children}</button>;
}

interface Open {
  key: string;
  anchor: HTMLElement;
  pinned: boolean;
}

export function TermTips({ lookup }: { lookup: (key: string) => TermInfo | undefined }) {
  const id = useId();
  const tip = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const hideTimer = useRef<number>(0);
  const current = useRef<Open | null>(null);
  current.current = open;

  const close = useCallback(() => setOpen(null), []);
  const cancelHide = () => window.clearTimeout(hideTimer.current);
  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => { if (!current.current?.pinned) setOpen(null); }, 150);
  }, []);

  useEffect(() => {
    if (!open) return;
    open.anchor.setAttribute("aria-describedby", id);
    open.anchor.setAttribute("aria-expanded", "true");
    return () => {
      open.anchor.removeAttribute("aria-describedby");
      open.anchor.setAttribute("aria-expanded", "false");
    };
  }, [open, id]);

  const place = useCallback(() => {
    const state = current.current;
    const box = tip.current;
    if (!state || !box) return;
    const rect = state.anchor.getBoundingClientRect();
    const gap = 8;
    const margin = 12;
    let top = rect.bottom + gap;
    if (top + box.offsetHeight > window.innerHeight - margin && rect.top - gap - box.offsetHeight > margin) top = rect.top - gap - box.offsetHeight;
    const left = Math.min(Math.max(rect.left + rect.width / 2 - box.offsetWidth / 2, margin), window.innerWidth - box.offsetWidth - margin);
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place]);

  useEffect(() => {
    const termOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>(".term[data-term]") : null);
    const inTip = (target: EventTarget | null) => target instanceof Node && Boolean(tip.current?.contains(target));

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const term = termOf(e.target);
      if (!term) return;
      cancelHide();
      if (current.current?.anchor !== term) setOpen({ key: term.dataset.term!, anchor: term, pinned: false });
    };
    const onOut = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      // Moving from the term to the tip (or within the tip) does not close it.
      if (inTip(e.relatedTarget) || (termOf(e.relatedTarget) && termOf(e.relatedTarget) === current.current?.anchor)) return;
      if (termOf(e.target) || inTip(e.target)) scheduleHide();
    };
    const onClick = (e: MouseEvent) => {
      const term = termOf(e.target);
      if (term) {
        e.preventDefault();
        const state = current.current;
        if (state?.anchor === term && state.pinned) setOpen(null);
        else setOpen({ key: term.dataset.term!, anchor: term, pinned: true });
        return;
      }
      if (!inTip(e.target)) setOpen(null);
    };
    const onFocusIn = (e: FocusEvent) => {
      const term = termOf(e.target);
      if (term && current.current?.anchor !== term) setOpen({ key: term.dataset.term!, anchor: term, pinned: false });
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!termOf(e.target) || inTip(e.relatedTarget) || current.current?.pinned) return;
      setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !current.current) return;
      const anchor = current.current.anchor;
      setOpen(null);
      anchor.focus();
    };
    const onMove = () => { if (current.current) place(); };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("click", onClick);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    window.addEventListener("popstate", close);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("click", onClick);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("popstate", close);
      window.clearTimeout(hideTimer.current);
    };
  }, [close, place, scheduleHide]);

  const info = open ? lookup(open.key) : undefined;
  if (!open || !info) return null;
  const showLink = info.href && window.location.pathname !== info.href;
  return (
    <div ref={tip} id={id} role="tooltip" className="term-tip"
      style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden", top: 0, left: 0 }}
      onPointerEnter={cancelHide}>
      <b>{info.title}</b>
      <p>{info.text.split(wordsPattern()).map((part, i) => (i % 2 === 0 ? part
        : isItemWord(part) ? <Item key={i} id={ITEM_WORDS[part]} text>{part}</Item> : <InGame key={i}>{part}</InGame>))}</p>
      {showLink && <a href={info.href} onClick={() => setOpen(null)}>{t("Ver o guia")}</a>}
    </div>
  );
}
