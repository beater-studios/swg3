
import type { ReactNode } from "react";
import { N_, t } from "../i18n";

export type NoticeTone = "note" | "tip" | "warn" | "error";

// Markdown uses the same classes (:::note, :::tip, :::warn).
export function Notice({ tone = "note", title, children, className = "", tour }: {
  tone?: NoticeTone; title?: ReactNode; children?: ReactNode; className?: string;
  tour?: string;
}) {
  return (
    <div data-tour={tour} className={["notice", tone === "note" ? "" : `notice-${tone}`, className].filter(Boolean).join(" ")}
      role={tone === "error" ? "alert" : undefined}>
      {title && <b className="notice-title">{title}</b>}
      {children}
    </div>
  );
}

export function Hint({ children, role }: { children: ReactNode; role?: "status" }) {
  return <p className="hint" role={role}>{children}</p>;
}

export function Note({ children, items, inline = false }: { children?: ReactNode; items?: ReactNode[]; inline?: boolean }) {
  if (items) return <ul className="note">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
  if (inline) return <span className="note">{children}</span>;
  return <p className="note">{children}</p>;
}

export function Prereq({ items }: { items: { text: ReactNode; action?: ReactNode }[] }) {
  if (!items.length) return null;
  return (
    <Notice tone="warn" className="prereq" title={items.length > 1 ? t("Antes desta etapa, faltam {n} coisas", { n: items.length }) : t("Antes desta etapa, falta uma coisa")}>
      <ul className="prereq-list">
        {items.map((item, i) => <li key={i}><span>{item.text}</span>{item.action}</li>)}
      </ul>
    </Notice>
  );
}

// decorative: the name is already next to it, so the symbol is hidden from screen readers.
export function Gender({ value, trainer = false, decorative = false }: { value: string | null | undefined; trainer?: boolean; decorative?: boolean }) {
  if (decorative && value) {
    return <span className={`gender ${value === "M" ? "gender-m" : value === "F" ? "gender-f" : ""}`.trim()} aria-hidden="true">{value === "M" ? "♂" : value === "F" ? "♀" : "-"}</span>;
  }
  const male = trainer ? t("menino") : t("macho"), female = trainer ? t("menina") : t("fêmea");
  if (value === "M") return <span className="gender gender-m" role="img" aria-label={male} title={male}>♂</span>;
  if (value === "F") return <span className="gender gender-f" role="img" aria-label={female} title={female}>♀</span>;
  if (value === "-") return <span className="gender" role="img" aria-label={t("sem gênero")} title={t("sem gênero")}>-</span>;
  return null;
}

// Type colors from the classic community table. Keys are game names (FR/LG abbreviates FIGHT, ELECTR, PSYCHC).
export const TYPE_COLORS: Record<string, string> = {
  NORMAL: "#A8A878", FIGHT: "#C03028", FIGHTING: "#C03028", FLYING: "#A890F0", POISON: "#A040A0", GROUND: "#E0C068",
  ROCK: "#B8A038", BUG: "#A8B820", GHOST: "#705898", STEEL: "#B8B8D0", FIRE: "#F08030", WATER: "#6890F0", GRASS: "#78C850",
  ELECTR: "#F8D030", ELECTRIC: "#F8D030", PSYCHC: "#F85888", PSYCHIC: "#F85888", ICE: "#98D8D8", DRAGON: "#7038F8",
  DARK: "#705848", "???": "#68A090",
};

export function TypeBadge({ type }: { type: string }) {
  const name = type.toUpperCase();
  return <span className="type-badge" style={{ ["--type" as string]: TYPE_COLORS[name] ?? "#888" }}>{name}</span>;
}

function Chevrons({ down }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" style={down ? { transform: "rotate(180deg)" } : undefined}>
      <path d="M2.5 6.5 6 3l3.5 3.5M2.5 10 6 6.5 9.5 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatChange({ up, down }: { up: string | null; down: string | null }) {
  if (!up || !down || up === down) return <span className="stat-change neutral">{t("neutra")}</span>;
  return (
    <span className="stat-change" aria-label={t("+{up}, -{down}", { up, down })}>
      <span className="up"><Chevrons />{up}</span><span className="down"><Chevrons down />{down}</span>
    </span>
  );
}

export function Key({ children }: { children: ReactNode }) {
  return <kbd className="pad-key">{children}</kbd>;
}

export function InGame({ children }: { children: ReactNode }) {
  return <span className="game-text">{children}</span>;
}

export type TagTone = "ok" | "warn" | "bad" | "shiny" | "info";

export function Tag({ tone = "ok", children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="chip">{children}</span>;
}

export function Chips({ children }: { children: ReactNode }) {
  return <div className="chips">{children}</div>;
}

// 0 to 1.
export function Progress({ value, label }: { value: number; label?: string }) {
  const percent = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
      <div style={{ width: `${percent}%` }} />
    </div>
  );
}

export interface Issue {
  level: string;
  field?: string;
  message: string;
}

// error and warning come from the services; note is informational; choice is what the site decided while building.
const ISSUE_TAGS: Record<string, [TagTone, string]> = {
  error: ["bad", N_("erro")], warning: ["warn", N_("aviso")], note: ["info", N_("nota")], choice: ["info", N_("escolha")],
};

const ISSUE_MEANINGS: Record<string, string> = {
  error: N_("o jogo recusa ou o arquivo está quebrado"),
  warning: N_("o jogo aceita, mas não daria um Pokémon assim; verificadores como o PKHeX podem apontar"),
  note: N_("só explica algo do Pokémon, não é problema"),
  choice: N_("o site decidiu sozinho ao criar"),
};

export function IssueLegend({ levels }: { levels: readonly string[] }) {
  const shown = Object.keys(ISSUE_TAGS).filter((level) => levels.includes(level));
  if (!shown.length) return null;
  return (
    <dl className="issue-legend">
      {shown.map((level) => {
        const [tone, label] = ISSUE_TAGS[level];
        return [<dt key={`t-${level}`}><Tag tone={tone}>{t(label)}</Tag></dt>, <dd key={`d-${level}`}>{t(ISSUE_MEANINGS[level])}</dd>];
      })}
    </dl>
  );
}

export function IssueList({ issues }: { issues: Issue[] }) {
  return (
    <ul className="issues">
      {issues.map((issue, i) => {
        const [tone, label] = ISSUE_TAGS[issue.level] ?? ISSUE_TAGS.aviso;
        return (
          <li key={i}>
            <Tag tone={tone}>{t(label)}</Tag>
            <span>{issue.field ? <><b>{issue.field}</b>: </> : null}{issue.message}</span>
          </li>
        );
      })}
    </ul>
  );
}
