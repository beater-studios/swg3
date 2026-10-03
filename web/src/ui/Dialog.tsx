// Modal on native <dialog>. bare: no frame, title or close button, for content that brings its own.

import { useEffect, useRef, type ReactNode, useId } from "react";
import { t } from "../i18n";

export function Dialog({ open, onClose, title, children, className = "", bare = false }: {
  open: boolean;
  onClose: () => void;
  /** Visible title; with bare, only the accessible name for screen readers. */
  title: string;
  children: ReactNode;
  className?: string;
  bare?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className={["dialog", bare ? "dialog-bare" : "", className].filter(Boolean).join(" ")} onClose={onClose}
      aria-label={bare ? title : undefined} aria-labelledby={bare ? undefined : titleId} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="dialog-body">
        {!bare && (
          <div className="dialog-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="dialog-close" aria-label={t("Fechar")} title={t("Fechar")} onClick={onClose}>×</button>
          </div>
        )}
        {open && children}
      </div>
    </dialog>
  );
}
