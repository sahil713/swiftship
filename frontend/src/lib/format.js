export const money = (pence) =>
  pence === null || pence === undefined ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

export const date = (value, opts = { day: "numeric", month: "short", year: "numeric" }) =>
  value ? new Intl.DateTimeFormat("en-GB", opts).format(new Date(value)) : "—";

export const dateTime = (value) =>
  value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";

export const STATUS_LABELS = {
  quote_requested: "Quote requested",
  awaiting_payment: "Awaiting payment",
  booked: "Booked",
  collected: "Collected",
  in_warehouse: "At our warehouse",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed_delivery: "Delivery attempted",
  exception: "Exception",
  cancelled: "Cancelled",
};

// Tone drives the badge colour; every badge also shows its label so colour is never the only signal.
export const STATUS_TONE = {
  quote_requested: "neutral",
  awaiting_payment: "warning",
  booked: "info",
  collected: "info",
  in_warehouse: "info",
  in_transit: "info",
  out_for_delivery: "accent",
  delivered: "good",
  failed_delivery: "serious",
  exception: "critical",
  cancelled: "muted",
};

export const TRACKING_STEPS = ["booked", "collected", "in_transit", "out_for_delivery", "delivered"];

export const humanize = (s) => (s ? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "");

export const penceFromPounds = (v) => Math.round(parseFloat(v || 0) * 100);
export const poundsFromPence = (p) => (p === null || p === undefined ? "" : (p / 100).toFixed(2));

/** Human-friendly duration, e.g. 8100 → "2 hours 15 minutes". */
export const duration = (seconds) => {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return "less than a minute";
  const mins = Math.round(seconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const part = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  return [h && part(h, "hour"), m && part(m, "minute")].filter(Boolean).join(" ");
};

export const exactDateTime = (value) =>
  value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value)) : "—";

export const timeOnly = (value) => (value ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—");

export const TASK_KIND_LABELS = { collection: "Collection", delivery: "Delivery", direct: "Collection + Delivery" };
