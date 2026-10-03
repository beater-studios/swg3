// Capture Poké Ball wobbling as in game (src/pokeball.c, SpriteCB_BallThrow_Shake). Image: tools/gen_ball.py.

import ball from "../assets/ball-poke.png";
import { Progress } from "./feedback";

export function SearchProgress({ value, label, running }: { value: number; label?: string; running: boolean }) {
  return (
    <div className="search-progress">
      <img className={running ? "search-ball shaking" : "search-ball"} src={ball} alt="" aria-hidden="true" width={16} height={16} draggable={false} />
      <Progress value={value} label={label} />
    </div>
  );
}
