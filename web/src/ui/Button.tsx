
import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { Link } from "react-router";

export type ButtonVariant = "default" | "primary";
export type ButtonSize = "sm" | "md" | "lg";

function buttonClass(variant: ButtonVariant, size: ButtonSize, className = "") {
  return ["btn", variant === "primary" ? "btn-primary" : "", size === "sm" ? "btn-small" : size === "lg" ? "btn-big" : "", className]
    .filter(Boolean).join(" ");
}

// type="button" by default: a submit button must ask for type="submit".
export function Button({ variant = "default", size = "md", className, type = "button", ...rest }: {
  variant?: ButtonVariant; size?: ButtonSize;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

// `to` is a site page in the current language; `href` is a ready URL.
export function ButtonLink({ to, href, hrefLang, onClick, variant = "default", size = "md", children }: {
  variant?: ButtonVariant; size?: ButtonSize; children: ReactNode;
} & ({ to: string; href?: never; hrefLang?: never; onClick?: never }
  | { to?: never; href: string; hrefLang?: string; onClick?: MouseEventHandler<HTMLAnchorElement> })) {
  if (href !== undefined) return <a className={buttonClass(variant, size)} href={href} hrefLang={hrefLang} onClick={onClick}>{children}</a>;
  return <Link className={buttonClass(variant, size)} to={to!}>{children}</Link>;
}
