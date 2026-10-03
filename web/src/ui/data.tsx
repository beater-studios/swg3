
import type { ReactNode } from "react";

// null or false rows are skipped.
export function KV({ rows }: { rows: Array<[ReactNode, ReactNode] | null | false> }) {
  return (
    <dl className="kv">
      {rows.filter(Boolean).map((row, i) => {
        const [k, v] = row as [ReactNode, ReactNode];
        return [<dt key={`k${i}`}>{k}</dt>, <dd key={`v${i}`}>{v}</dd>];
      })}
    </dl>
  );
}

export function Table({ children, variant = "grid", className = "", wrapClassName = "" }: {
  children: ReactNode; variant?: "grid" | "stat"; className?: string; wrapClassName?: string;
}) {
  return (
    <div className={`table-wrap ${wrapClassName}`.trim()}>
      <table className={`${variant === "stat" ? "stat-table" : "grid-table"} ${className}`.trim()}>{children}</table>
    </div>
  );
}

export function TableWrap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`table-wrap ${className}`.trim()}>{children}</div>;
}

export function Steps({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <ol className={`steps ${className}`.trim()}>{children}</ol>;
}
