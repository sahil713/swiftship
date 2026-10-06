import { dateTime, duration } from "../lib/format.js";
import ProofView from "./ProofView.jsx";

/** How long each stage of a task took, plus the total from setting off to closing. */
export function TaskTimings({ timings }) {
  if (!timings) return null;
  const running = timings.running_since ? Math.round((Date.now() - new Date(timings.running_since)) / 1000) : null;
  return (
    <div className="timing-chips" aria-label="Time taken">
      {timings.stages.map((s) => (
        <span key={s.label} className="timing-chip">{s.label} <strong>{s.seconds !== null ? duration(s.seconds) : s.in_progress ? "in progress" : "—"}</strong></span>
      ))}
      <span className="timing-chip" style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}>
        Total <strong>{timings.total_seconds !== null ? duration(timings.total_seconds) : running !== null ? `${duration(running)} so far` : "—"}</strong>
      </span>
    </div>
  );
}

/** Every recorded action on the task, with the time since the previous one. */
export function TaskEvents({ events }) {
  if (!events?.length) return <p className="small muted" style={{ margin: 0 }}>No activity yet.</p>;
  return (
    <ol className="event-timeline">
      {events.map((e, i) => {
        const gap = i ? Math.round((new Date(e.occurred_at) - new Date(events[i - 1].occurred_at)) / 1000) : null;
        return (
          <li key={e.id}>
            <span className="muted">{dateTime(e.occurred_at)}{gap !== null && <div className="gap">+{duration(gap)}</div>}</span>
            <span><strong>{e.label}</strong>{e.by && <span className="muted"> · {e.by}</span>}{e.note && <div className="small muted">{e.note}</div>}</span>
          </li>
        );
      })}
    </ol>
  );
}

const PROOF_TITLES = { collection: "Proof of Collection (POC)", depot: "Depot check-in", delivery: "Proof of Delivery (POD)" };

export function TaskProofs({ proofs }) {
  const kinds = ["collection", "depot", "delivery"].filter((k) => proofs?.[k]);
  if (!kinds.length) return <p className="small muted" style={{ margin: 0 }}>No proofs submitted yet.</p>;
  return kinds.map((k) => (
    <div key={k} style={{ background: "var(--bg-subtle)", borderRadius: 12, padding: 14 }}>
      <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>{PROOF_TITLES[k]}</div>
      <ProofView proof={proofs[k]} kind={k} />
    </div>
  ));
}
