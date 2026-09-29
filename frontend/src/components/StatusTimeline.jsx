import { Check, Package, Truck, MapPin, Home, Warehouse } from "lucide-react";
import { dateTime, TRACKING_STEPS } from "../lib/format.js";

const STEP_META = {
  booked: { label: "Booked", icon: Package },
  collected: { label: "Collected", icon: Warehouse },
  in_transit: { label: "In transit", icon: Truck },
  out_for_delivery: { label: "Out for delivery", icon: MapPin },
  delivered: { label: "Delivered", icon: Home },
};

/** Five-step progress bar. Exceptions keep the last good step highlighted. */
export function ProgressTrack({ status, events = [] }) {
  const reached = new Set(events.map((e) => e.status));
  if (status === "delivered") TRACKING_STEPS.forEach((s) => reached.add(s));
  const lastIdx = TRACKING_STEPS.reduce((acc, s, i) => (reached.has(s) ? i : acc), -1);
  const pct = lastIdx <= 0 ? 0 : (lastIdx / (TRACKING_STEPS.length - 1)) * 100;
  return (
    <div aria-label="Shipment progress">
      <div className="progress-track">
        {TRACKING_STEPS.map((s, i) => {
          const Icon = i <= lastIdx ? Check : STEP_META[s].icon;
          return (
            <div key={s} className={`progress-step ${i <= lastIdx ? "done" : ""} ${i === lastIdx ? "current" : ""}`}>
              <div className="dot"><Icon size={16} aria-hidden /></div>
              <span className="lbl">{STEP_META[s].label}</span>
              <span className="sr-only">{i <= lastIdx ? "(complete)" : "(pending)"}</span>
            </div>
          );
        })}
      </div>
      <div className="progress-line" aria-hidden><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function EventTimeline({ events = [], showBy = false }) {
  const list = [...events].reverse();
  return (
    <ol className="timeline">
      {list.map((e) => (
        <li key={e.id}>
          <span className="tl-dot" aria-hidden />
          <div className="tl-title">{e.label}</div>
          <div className="tl-meta">
            {dateTime(e.created_at)}
            {e.location ? ` · ${e.location}` : ""}
            {showBy && e.by ? ` · by ${e.by}` : ""}
            {showBy && e.customer_visible === false ? " · internal" : ""}
          </div>
          {e.note && <div className="tl-note">{e.note}</div>}
        </li>
      ))}
    </ol>
  );
}
