import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Inbox } from "lucide-react";
import { STATUS_LABELS, STATUS_TONE } from "../lib/format.js";

export function Spinner({ label = "Loading" }) {
  return (
    <div className="loading-block" role="status">
      <div className="spinner" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function StatusBadge({ status, label }) {
  return <span className={`badge tone-${STATUS_TONE[status] || "neutral"}`}>{label || STATUS_LABELS[status] || status}</span>;
}

export function Badge({ tone = "neutral", children, plain }) {
  return <span className={`badge tone-${tone}${plain ? " plain" : ""}`}>{children}</span>;
}

const ALERT_ICONS = { info: Info, warning: AlertTriangle, error: AlertCircle, success: CheckCircle2 };

export function Alert({ type = "info", children, title }) {
  const Icon = ALERT_ICONS[type];
  return (
    <div className={`alert alert-${type}`} role={type === "error" ? "alert" : undefined}>
      <Icon size={18} aria-hidden />
      <div>
        {title && <strong style={{ display: "block" }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, children, className = "" }) {
  return (
    <div className={`field ${className}`}>
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <span className="error-text">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title, children }) {
  return (
    <div className="empty">
      <Icon size={40} aria-hidden />
      <p style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{title}</p>
      {children}
    </div>
  );
}

/** Fades and lifts children into view as they scroll into the viewport. */
export function Reveal({ children, delay = 0, y = 28, className, as = "div" }) {
  const Comp = motion[as];
  return (
    <Comp className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </Comp>
  );
}

export function Modal({ open, onClose, title, children }) {
  const ref = useRef(null);
  // Parents usually pass a new onClose on every render; keep the latest in a ref so the
  // effects below only run when the modal opens (re-running them stole focus while typing).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus the first form field once, when the modal opens.
  useEffect(() => {
    if (open) ref.current?.querySelector(".modal-body input:not([type=hidden]), .modal-body textarea, .modal-body select")?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <div className="row-between" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body">{children}</div>
      </motion.div>
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted">Page {meta.page} of {meta.pages} · {meta.total} total</span>
      <button className="btn btn-secondary btn-sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</button>
      <button className="btn btn-secondary btn-sm" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next</button>
    </nav>
  );
}

export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.value} role="tab" className="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
