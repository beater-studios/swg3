
import type { FormEventHandler, ReactNode } from "react";
import { Link } from "react-router";

export function PageHeader({ title, lead, eyebrow }: { title: ReactNode; lead?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="page-head">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}

// heading replaces the h1 text; header={false} hides the header. <head> comes from app/routes.ts and app/head.ts.
export function Page({ title, heading, lead, header = true, className = "", children }: {
  title: string; heading?: ReactNode; lead?: ReactNode; header?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <section className={`view ${className}`.trim()}>
      {header && title && <PageHeader title={heading ?? title} lead={lead} />}
      {children}
    </section>
  );
}

type PanelProps = {
  children: ReactNode;
  className?: string;
  // plain: frameless, for blocks inside another panel. prose: running text (Markdown).
  variant?: "framed" | "plain" | "prose";
  id?: string;
  tour?: string;
};

export function Panel({ children, className = "", variant = "framed", id, tour, as: Tag = "div" }: PanelProps & { as?: "div" | "article" }) {
  return <Tag id={id} data-tour={tour} className={panelClass(variant, className)}>{children}</Tag>;
}

export function PanelSection({ children, className = "", variant = "framed", tour }: PanelProps) {
  return <section data-tour={tour} className={panelClass(variant, className)}>{children}</section>;
}

export function PanelForm({ children, className = "", variant = "framed", tour, onSubmit }: PanelProps & { onSubmit: FormEventHandler<HTMLFormElement> }) {
  return (
    <form data-tour={tour} className={panelClass(variant, className)} autoComplete="off" onSubmit={(e) => { e.preventDefault(); onSubmit(e); }}>
      {children}
    </form>
  );
}

function panelClass(variant: PanelProps["variant"], className: string) {
  return ["panel", variant === "plain" ? "panel-plain" : variant === "prose" ? "panel-prose" : "", className].filter(Boolean).join(" ");
}

export function Details({ summary, children, className = "" }: { summary: ReactNode; children: ReactNode; className?: string }) {
  return (
    <details className={`panel details ${className}`.trim()}>
      <summary>{summary}</summary>
      {children}
    </details>
  );
}

export function Stack({ children, gap = "md", className = "", id, tour }: { children: ReactNode; gap?: "sm" | "md"; className?: string; id?: string; tour?: string }) {
  return <div id={id} data-tour={tour} className={`stack ${gap === "sm" ? "stack-sm" : ""} ${className}`.trim()}>{children}</div>;
}

export function Group({ title, children, collapsible = false, className = "", tour }: {
  title: ReactNode; children: ReactNode; collapsible?: boolean; className?: string;
  tour?: string;
}) {
  if (collapsible) {
    return (
      <details data-tour={tour} className={`group ${className}`.trim()}>
        <summary>{title}</summary>
        <div className="group-body">{children}</div>
      </details>
    );
  }
  return (
    <fieldset data-tour={tour} className={`group ${className}`.trim()}>
      <legend>{title}</legend>
      <div className="group-body">{children}</div>
    </fieldset>
  );
}

export function Actions({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`actions ${className}`.trim()}>{children}</div>;
}

export function CardGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`cards ${className}`.trim()}>{children}</div>;
}

export function LinkCard({ to, children, className = "" }: { to: string; children: ReactNode; className?: string }) {
  return <Link className={`card ${className}`.trim()} to={to}>{children}</Link>;
}
