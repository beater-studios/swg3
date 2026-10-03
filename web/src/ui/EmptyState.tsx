// Empty state with the theme's character walking as in game (sAnim_GoWest). Images: tools/gen_player.py.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import red from "../assets/player-red.png";
import leaf from "../assets/player-leaf.png";
import brendan from "../assets/player-brendan.png";
import mayRs from "../assets/player-may-rs.png";
import brendanE from "../assets/player-brendan-e.png";

const SCALE = 3;
const SPEED = 60 * SCALE;   // pixels per second: 1 game pixel per frame at 60 frames per second

export function EmptyState({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [seconds, setSeconds] = useState(6);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setSeconds(Math.max(1, (el.clientWidth - 16 * SCALE) / SPEED));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const style = {
    "--walker-red": `url(${red})`, "--walker-leaf": `url(${leaf})`, "--walker-brendan": `url(${brendan})`,
    "--walker-may-rs": `url(${mayRs})`, "--walker-brendan-e": `url(${brendanE})`, "--walk-time": `${seconds * 2}s`,
  } as CSSProperties;
  return (
    <div className="empty-state">
      <div className="empty-track" ref={track} style={style} aria-hidden="true">
        <span className="walker"><span className="walker-sprite" /></span>
      </div>
      <div className="empty-text">{children}</div>
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
}
