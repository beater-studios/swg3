// Language flag keyed by the pk3 language id (include/constants/global.h, LANGUAGE_*). English uses the US flag.

import type { ReactNode } from "react";

const W = 30, H = 20;

const bands = (colors: string[], vertical: boolean) => colors.map((c, i) => vertical
  ? <rect key={c} x={(W / colors.length) * i} y="0" width={W / colors.length} height={H} fill={c} />
  : <rect key={c} x="0" y={(H / colors.length) * i} width={W} height={H / colors.length} fill={c} />);

const FLAGS: Record<number, ReactNode> = {
  1: <><rect width={W} height={H} fill="#fff" /><circle cx={W / 2} cy={H / 2} r="6" fill="#bc002d" /></>,
  2: (
    <>
      {Array.from({ length: 7 }, (_, i) => <rect key={i} x="0" y={(H / 7) * i} width={W} height={H / 7} fill={i % 2 ? "#fff" : "#b22234"} />)}
      <rect x="0" y="0" width="13" height={(H / 7) * 4} fill="#3c3b6e" />
    </>
  ),
  3: bands(["#0055a4", "#fff", "#ef4135"], true),
  4: bands(["#009246", "#fff", "#ce2b37"], true),
  5: bands(["#000", "#dd0000", "#ffce00"], false),
  7: <><rect width={W} height={H} fill="#aa151b" /><rect x="0" y={H / 4} width={W} height={H / 2} fill="#f1bf00" /></>,
};

export const hasFlag = (language: number) => language in FLAGS;

export function Flag({ language, children }: { language: number; children?: ReactNode }) {
  const flag = FLAGS[language];
  const svg = flag ? (
    <svg className="flag" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {flag}
      <rect width={W} height={H} fill="none" stroke="rgba(0, 0, 0, .25)" strokeWidth="1" />
    </svg>
  ) : null;
  if (children === undefined) return svg;
  return <span className="item-name">{svg}{children}</span>;
}
