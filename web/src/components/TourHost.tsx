// Runs the open tour (tours/store.ts), including ?tour=<id> links from the guides. Mounted once in Layout.

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { getLang } from "../i18n";
import { tour } from "../content";
import { ACTIONS, CONDITIONS, TOUR_PAGES } from "../tours/registry";
import { useTour } from "../tours/store";
import { Tour } from "../ui";

const POLL_MS = 200;
const AUTO_NEXT_MS = 450;

export function TourHost() {
  const { active, index, go, stop, finish, start } = useTour();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const data = active ? tour(getLang(), active) : null;
  const step = data?.steps[index] ?? null;
  const [met, setMet] = useState(true);
  const before = useRef(true);

  useEffect(() => {
    const asked = new URLSearchParams(search).get("tour");
    if (!asked || TOUR_PAGES[asked] !== pathname || !tour(getLang(), asked)) return;
    // Steps highlight parts of the tool: wait until it replaces its placeholder.
    const id = window.setInterval(() => {
      if (document.querySelector("[data-client-pending]")) return;
      window.clearInterval(id);
      navigate(pathname, { replace: true });
      start(asked);
    }, 50);
    return () => window.clearInterval(id);
  }, [pathname, search]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (active && TOUR_PAGES[active] && pathname !== TOUR_PAGES[active]) stop();
  }, [active, pathname, stop]);

  useEffect(() => {
    if (step?.go) ACTIONS[step.go]?.();
  }, [active, index]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const condition = step?.wait ? CONDITIONS[step.wait] : undefined;
    if (!condition) { setMet(true); return; }
    before.current = condition();
    setMet(before.current);
    let timer = 0;
    const id = window.setInterval(() => {
      const now = condition();
      setMet(now);
      if (now && !before.current) timer = window.setTimeout(() => go(index + 1), AUTO_NEXT_MS);
      before.current = now;
    }, POLL_MS);
    return () => { window.clearInterval(id); window.clearTimeout(timer); };
  }, [active, index]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !step) return null;
  const last = index === data.steps.length - 1;
  return (
    <Tour step={step} index={index} total={data.steps.length} title={data.title} waiting={!met}
      onNext={() => (last ? finish() : go(index + 1))} onBack={() => go(Math.max(0, index - 1))} onExit={stop} />
  );
}
