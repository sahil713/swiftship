import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, UserMinus } from "lucide-react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { date, dateTime, duration, PAYMENT_STATUS_LABELS, PAYMENT_TONE, STATUS_LABELS, TASK_KIND_LABELS } from "../../lib/format.js";
import { Alert, Badge, Empty, Field, Modal, Pagination, Spinner } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";
import { TASK_TONE } from "./Drivers.jsx";

const STATUS_OPTIONS = [
  ["open", "All open tasks"], ["unassigned", "Unassigned"], ["assigned", "Assigned"], ["started", "In progress / out for delivery"],
  ["arrived", "Arrived at collection"], ["collected", "In transit"], ["at_depot", "At depot"], ["arrived_delivery", "Arrived at delivery"],
  ["delivered", "Delivery completed"], ["closed", "Task closed"], ["all", "Everything"],
];

/** Admin creates a task for an existing booking and (optionally) assigns a driver straight away. */
function CreateTask({ drivers, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [booking, setBooking] = useState(null);
  const [form, setForm] = useState({ kind: "collection", driver_id: "", scheduled_for: "", instructions: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const results = useApi("/admin/bookings", { q: search, page: 1 });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  useEffect(() => {
    const t = setTimeout(() => setSearch(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (b) => {
    setBooking(b);
    const kind = ["in_warehouse", "in_transit", "failed_delivery"].includes(b.status) ? "delivery" : "collection";
    setForm((f) => ({ ...f, kind, scheduled_for: f.scheduled_for || (b.collection_date && kind === "collection" ? `${b.collection_date}T${b.collection_time || "09:00"}` : "") }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!booking) return setError("Choose a booking first");
    setBusy(true);
    setError(null);
    try {
      const body = { task: { ...form, booking_reference: booking.reference, scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : "" } };
      const task = await api("/admin/tasks", { method: "POST", body });
      toast(`Task #${task.id} created${form.driver_id ? " – the driver can see it in My Tasks" : ""}`);
      navigate(`/admin/tasks/${task.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Create driver task">
      <form className="stack" onSubmit={submit}>
        {error && <Alert type="error">{error}</Alert>}
        {booking ? (
          <div className="card stack" style={{ padding: 14, gap: 4 }}>
            <div className="row-between"><strong className="mono">{booking.reference}</strong><button type="button" className="btn btn-ghost btn-sm" onClick={() => setBooking(null)}>Change</button></div>
            <div className="small">{booking.customer_name || booking.customer_email} · {booking.collection_postcode} → {booking.delivery_postcode}</div>
            <div className="small muted">{STATUS_LABELS[booking.status] || booking.status} · Payment: {PAYMENT_STATUS_LABELS[booking.payment_status]}{booking.collection_date ? ` · collection ${date(booking.collection_date)}` : ""}</div>
          </div>
        ) : (
          <Field label="Booking" htmlFor="ct-q" hint="Search by reference, customer name, email or postcode">
            <input id="ct-q" className="input" placeholder="e.g. SL-1234 or Smith" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="stack" style={{ gap: 4, marginTop: 6, maxHeight: 220, overflowY: "auto" }}>
              {results.loading && !results.data ? <span className="small muted">Searching…</span> : (results.data?.bookings || []).length === 0 ? <span className="small muted">No bookings found</span> :
                results.data.bookings.slice(0, 8).map((b) => (
                  <button type="button" key={b.reference} className="btn btn-ghost" style={{ justifyContent: "flex-start", textAlign: "left", height: "auto", padding: "8px 10px" }} onClick={() => pick(b)}>
                    <span><strong className="mono">{b.reference}</strong> <span className="small muted">{STATUS_LABELS[b.status] || b.status}</span><br /><span className="small">{b.customer_name || b.customer_email} · {b.collection_postcode} → {b.delivery_postcode}</span></span>
                  </button>
                ))}
            </div>
          </Field>
        )}
        <div className="form-grid">
          <Field label="Task type" htmlFor="ct-kind">
            <select id="ct-kind" className="select" value={form.kind} onChange={set("kind")}>
              <option value="collection">Collection (to depot)</option>
              <option value="delivery">Delivery (from depot)</option>
              <option value="direct">Collection + Delivery (direct)</option>
            </select>
          </Field>
          <Field label="Driver" htmlFor="ct-driver" hint="Leave unassigned to choose later">
            <select id="ct-driver" className="select" value={form.driver_id} onChange={set("driver_id")}>
              <option value="">Unassigned</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Date & time" htmlFor="ct-when" className="span-all"><input id="ct-when" type="datetime-local" className="input" value={form.scheduled_for} onChange={set("scheduled_for")} /></Field>
          <Field label="Notes / instructions for the driver" htmlFor="ct-notes" className="span-all"><textarea id="ct-notes" className="textarea" rows={3} value={form.instructions} onChange={set("instructions")} /></Field>
        </div>
        <button className="btn btn-primary" disabled={busy || !booking}>{busy ? "Saving…" : "Save task"}</button>
      </form>
    </Modal>
  );
}

/** Every collection and delivery task, with assign / reassign / unassign controls. */
export default function Tasks() {
  const toast = useToast();
  const [filters, setFilters] = useState({ status: "open", kind: "", driver_id: "", page: 1 });
  const { data, loading, reload } = useApi("/admin/tasks", filters);
  const [busy, setBusy] = useState(null);
  const [creating, setCreating] = useState(false);
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value, page: 1 });

  const act = async (task, path, body, message) => {
    setBusy(task.id);
    try {
      await api(`/admin/tasks/${task.id}/${path}`, { method: "POST", body });
      toast(message);
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack">
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Driver tasks</h1>
          <p className="muted" style={{ margin: 0 }}>Assign, change or remove the driver for any collection or delivery. Open a job to see its proof of collection and proof of delivery.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Create task</button>
      </div>
      <div className="toolbar">
        <select className="select" aria-label="Status" value={filters.status} onChange={set("status")}>{STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select className="select" aria-label="Task type" value={filters.kind} onChange={set("kind")}>
          <option value="">All task types</option><option value="collection">Collections</option><option value="delivery">Deliveries</option><option value="direct">Collect & deliver (direct)</option>
        </select>
        <select className="select" aria-label="Driver" value={filters.driver_id} onChange={set("driver_id")}>
          <option value="">All drivers</option><option value="none">No driver</option>
          {(data?.drivers || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      {loading && !data ? <Spinner /> : data.tasks.length === 0 ? <div className="card"><Empty title="No tasks match" /></div> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Job</th><th>Task</th><th>When</th><th>Where</th><th>Driver</th><th>Status</th><th>Proof</th><th>Time taken</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.tasks.map((t) => {
                  const editable = ["unassigned", "assigned", "started", "arrived", "collected", "at_depot", "arrived_delivery", "delivered"].includes(t.status);
                  const proofKinds = Object.keys(t.proofs || {});
                  return (
                    <tr key={t.id}>
                      <td><Link to={`/admin/bookings/${t.reference}`} className="mono">{t.reference}</Link><div className="small muted">{t.customer}</div><Badge tone={PAYMENT_TONE[t.payment_status]} plain>{t.payment_status_label}</Badge></td>
                      <td><Link to={`/admin/tasks/${t.id}`}><strong>{TASK_KIND_LABELS[t.kind]}</strong> #{t.id}</Link><div className="small muted">{t.item}</div></td>
                      <td className="small">{t.scheduled_for ? dateTime(t.scheduled_for) : <span className="muted">—</span>}</td>
                      <td>{t.contact_name}<div className="small muted">{t.city} <span className="mono">{t.postcode}</span></div></td>
                      <td>
                        {editable ? (
                          <select className="select" style={{ minHeight: 36, minWidth: 150 }} aria-label={`Driver for ${t.reference} ${t.kind}`} value={t.driver?.id || ""} disabled={busy === t.id}
                            onChange={(e) => e.target.value && act(t, "assign", { driver_id: e.target.value }, "Driver updated")}>
                            {!t.driver && <option value="">Choose driver…</option>}
                            {t.driver && !data.drivers.some((d) => d.id === t.driver.id) && <option value={t.driver.id}>{t.driver.name}</option>}
                            {data.drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        ) : (t.driver?.name || "—")}
                      </td>
                      <td><Badge tone={TASK_TONE[t.status]}>{t.status_label}</Badge></td>
                      <td className="small">{proofKinds.length ? proofKinds.map((k) => <div key={k}>{{ collection: "POC", depot: "Depot", delivery: "POD" }[k]} ✓ <span className="muted">{t.proofs[k].photo_count} photo{t.proofs[k].photo_count === 1 ? "" : "s"}{t.proofs[k].signed ? " · signed" : ""}</span></div>) : <span className="muted">—</span>}</td>
                      <td className="small">{t.timings?.total_seconds != null ? <strong>{duration(t.timings.total_seconds)}</strong> : t.timings?.running_since ? <span className="muted">running since {dateTime(t.timings.running_since)}</span> : <span className="muted">not started</span>}</td>
                      <td>{["assigned", "started", "arrived"].includes(t.status) && <button className="btn btn-ghost btn-sm" title="Remove from driver" disabled={busy === t.id} onClick={() => window.confirm(`Remove ${t.driver?.name} from this ${t.kind}?`) && act(t, "unassign", undefined, "Task unassigned")}><UserMinus size={14} /> Unassign</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} onPage={(page) => setFilters({ ...filters, page })} />
        </>
      )}
      {creating && <CreateTask drivers={data?.drivers || []} onClose={() => setCreating(false)} />}
    </div>
  );
}
