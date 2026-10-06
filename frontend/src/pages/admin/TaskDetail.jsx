import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, PenLine, History } from "lucide-react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { date, dateTime, duration, humanize, TASK_KIND_LABELS } from "../../lib/format.js";
import { Alert, Badge, Field, Modal, Spinner } from "../../components/ui.jsx";
import ProofView from "../../components/ProofView.jsx";
import { TaskEvents } from "../../components/TaskRecord.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { TASK_TONE } from "./Drivers.jsx";

const toLocalInput = (d) => {
  if (!d) return "";
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

/** Admin correction of a recorded proof. A reason is required and the original values are kept. */
function CorrectProof({ task, kind, onClose, onSaved }) {
  const proof = task.proofs[kind];
  const [form, setForm] = useState({ person_name: proof.person_name, occurred_at: toLocalInput(proof.occurred_at), notes: proof.notes || "", location: proof.location || "", reason: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...form, occurred_at: form.occurred_at ? new Date(form.occurred_at).toISOString() : undefined };
      onSaved(await api(`/admin/tasks/${task.id}/proofs/${kind}/correct`, { method: "POST", body }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Correct ${kind} record`}>
      <form className="stack" onSubmit={submit}>
        <Alert type="info">The original values are kept in the change history, with your name, the time and your reason. Photos and signatures can't be changed.</Alert>
        {error && <Alert type="error">{error}</Alert>}
        <Field label={kind === "depot" ? "Received by (depot)" : kind === "collection" ? "Handed over by" : "Received by"} htmlFor="cp-name"><input id="cp-name" className="input" value={form.person_name} onChange={set("person_name")} required /></Field>
        <Field label="Date & time" htmlFor="cp-time"><input id="cp-time" type="datetime-local" className="input" value={form.occurred_at} onChange={set("occurred_at")} required /></Field>
        {kind === "depot" && <Field label="Depot location" htmlFor="cp-loc"><input id="cp-loc" className="input" value={form.location} onChange={set("location")} required /></Field>}
        <Field label="Notes" htmlFor="cp-notes"><textarea id="cp-notes" className="textarea" rows={3} value={form.notes} onChange={set("notes")} /></Field>
        <Field label="Reason for the correction" htmlFor="cp-reason" hint="Required – e.g. 'Driver misspelt the recipient's name'"><textarea id="cp-reason" className="textarea" rows={2} value={form.reason} onChange={set("reason")} required /></Field>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save correction"}</button>
      </form>
    </Modal>
  );
}

function Section({ title, children, action }) {
  return (
    <section className="card stack">
      <div className="row-between"><h3 style={{ margin: 0 }}>{title}</h3>{action}</div>
      {children}
    </section>
  );
}

function Times({ rows }) {
  return <dl className="detail-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl>;
}

export default function TaskDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { data: t, loading, error, setData } = useApi(`/admin/tasks/${id}`);
  const [correcting, setCorrecting] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading && !t) return <Spinner />;
  if (error) return <Alert type="error">{error.message}</Alert>;
  const b = t.booking;
  const p = t.proofs || {};
  const editable = ["unassigned", "assigned", "started", "arrived", "collected", "at_depot", "arrived_delivery", "delivered"].includes(t.status);

  const act = async (path, body, message) => {
    setBusy(true);
    try {
      await api(`/admin/tasks/${t.id}/${path}`, { method: "POST", body });
      setData(await api(`/admin/tasks/${t.id}`));
      toast(message);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const correctButton = (kind) => isAdmin && p[kind] && <button className="btn btn-ghost btn-sm" onClick={() => setCorrecting(kind)}><PenLine size={14} /> Correct</button>;
  const proofOrEmpty = (kind, text) => (p[kind] ? <ProofView proof={p[kind]} kind={kind} /> : <p className="small muted" style={{ margin: 0 }}>{text}</p>);

  return (
    <div className="stack">
      <Link to="/admin/tasks" className="small row" style={{ gap: 4 }}><ArrowLeft size={14} /> Driver tasks</Link>
      <div className="row-between">
        <div>
          <div className="small muted">{TASK_KIND_LABELS[t.kind]} task #{t.id} · job <Link to={`/admin/bookings/${b.reference}`} className="mono">{b.reference}</Link></div>
          <h1 style={{ margin: "4px 0 0" }}>{t.status_label}</h1>
        </div>
        <Badge tone={TASK_TONE[t.status]}>{t.status_label}</Badge>
      </div>

      {t.missing_for_close?.length > 0 && t.started_at && <Alert type="info" title="Still to record before the task can be closed">{t.missing_for_close.join(", ")}</Alert>}

      <div className="grid-2">
        <Section title="Task information">
          <Times rows={[
            ["Task", `#${t.id} · ${TASK_KIND_LABELS[t.kind]}`],
            ["Job", b.reference],
            ["Customer", <>{b.customer.name}<div className="small muted">{b.customer.email} · {b.customer.phone}</div></>],
            ["Service", b.service],
            ["Item", b.item],
            ["Status", t.status_label],
            ["Created", dateTime(t.created_at)],
          ]} />
          {b.special_requirements && <Alert type="info" title="Special requirements">{b.special_requirements}</Alert>}
          <div className="row" style={{ gap: 8 }}>
            <label className="small muted" htmlFor="td-driver">Driver</label>
            <select id="td-driver" className="select" style={{ maxWidth: 240, minHeight: 38 }} value={t.driver?.id || ""} disabled={busy || !editable}
              onChange={(e) => e.target.value && act("assign", { driver_id: e.target.value }, t.driver ? "Task reassigned" : "Task assigned")}>
              {!t.driver && <option value="">Choose driver…</option>}
              {t.driver && !t.drivers.some((d) => d.id === t.driver.id) && <option value={t.driver.id}>{t.driver.name}</option>}
              {t.drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {["assigned", "started", "arrived"].includes(t.status) && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => window.confirm(`Remove ${t.driver?.name} from this task?`) && act("unassign", undefined, "Task unassigned")}>Unassign</button>}
          </div>
        </Section>

        <Section title="Time tracking">
          <Times rows={[
            ["Task started", dateTime(t.started_at)],
            ...t.timings.stages.map((s) => [s.label, s.seconds !== null ? duration(s.seconds) : s.in_progress ? "in progress" : null]),
            ["Task closed", dateTime(t.closed_at || t.completed_at)],
          ]} />
          <div className="row-between" style={{ background: "var(--accent-soft)", color: "var(--accent-text)", borderRadius: 12, padding: "12px 14px" }}>
            <strong>Total task duration</strong>
            <strong>{t.timings.total_seconds !== null ? duration(t.timings.total_seconds) : t.timings.running_since ? `${duration(Math.round((Date.now() - new Date(t.timings.running_since)) / 1000))} so far` : "Not started"}</strong>
          </div>
        </Section>
      </div>

      <div className="grid-2">
        {t.kind !== "delivery" && (
          <Section title="Collection" action={correctButton("collection")}>
            <Times rows={[
              ["Address", <>{b.collection.address}<div className="small muted">{b.collection.contact_name} · {b.collection.phone}</div></>],
              ["Scheduled", b.collection_date ? date(b.collection_date) : null],
              ["Arrived", dateTime(t.arrived_at)],
              ["Completed", dateTime(t.collected_at)],
            ]} />
            {proofOrEmpty("collection", "No collection proof yet.")}
          </Section>
        )}
        {t.kind === "collection" && (
          <Section title="Depot" action={correctButton("depot")}>
            <Times rows={[["Arrived at depot", dateTime(t.at_depot_at)], ["Location", p.depot?.location || t.warehouse_note]]} />
            {proofOrEmpty("depot", "Not at the depot yet.")}
          </Section>
        )}
        {t.kind !== "collection" && (
          <Section title="Delivery" action={correctButton("delivery")}>
            <Times rows={[
              ["Address", <>{b.delivery.address}<div className="small muted">{b.delivery.contact_name} · {b.delivery.phone}</div></>],
              ["Arrived", dateTime(t.arrived_delivery_at || (t.kind === "delivery" ? t.arrived_at : null))],
              ["Completed", dateTime(t.delivered_at || t.completed_at)],
            ]} />
            {proofOrEmpty("delivery", "No proof of delivery yet.")}
          </Section>
        )}
      </div>

      <Section title="Activity timeline">
        <TaskEvents events={t.events} />
      </Section>

      <Section title={<><History size={18} style={{ display: "inline", verticalAlign: -3 }} /> Corrections & changes</>}>
        {t.corrections.length === 0 ? <p className="small muted" style={{ margin: 0 }}>Nothing recorded has been changed.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Record</th><th>Change</th><th>By</th><th>Reason</th></tr></thead>
              <tbody>
                {t.corrections.map((c) => (
                  <tr key={c.id}>
                    <td className="small">{dateTime(c.at)}</td>
                    <td className="small">{humanize(c.record)} · {c.action}</td>
                    <td className="small">{Object.entries(c.changes).map(([f, [o, n]]) => <div key={f}><strong>{humanize(f)}</strong>: <span className="muted">{String(o ?? "—")}</span> → {String(n ?? "—")}</div>)}</td>
                    <td className="small">{c.by || "—"}</td>
                    <td className="small">{c.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {correcting && <CorrectProof task={t} kind={correcting} onClose={() => setCorrecting(null)} onSaved={(d) => { setData(d); setCorrecting(null); toast("Correction saved – original kept in the history"); }} />}
    </div>
  );
}
