import { useState } from "react";
import { Link } from "react-router-dom";
import { UserMinus } from "lucide-react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { dateTime, duration, TASK_KIND_LABELS } from "../../lib/format.js";
import { Badge, Empty, Pagination, Spinner } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";
import { TASK_TONE } from "./Drivers.jsx";

const STATUS_OPTIONS = [
  ["open", "All open tasks"], ["unassigned", "Unassigned"], ["assigned", "Assigned"], ["started", "In progress / out for delivery"],
  ["arrived", "Arrived at collection / delivery"], ["collected", "Collected"], ["arrived_delivery", "Arrived at delivery (direct)"],
  ["closed", "At depot"], ["completed", "Completed"], ["all", "Everything"],
];

/** Every collection and delivery task, with assign / reassign / unassign controls. */
export default function Tasks() {
  const toast = useToast();
  const [filters, setFilters] = useState({ status: "open", kind: "", driver_id: "", page: 1 });
  const { data, loading, reload } = useApi("/admin/tasks", filters);
  const [busy, setBusy] = useState(null);
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
      <div>
        <h1 style={{ marginBottom: 4 }}>Driver tasks</h1>
        <p className="muted" style={{ margin: 0 }}>Assign, change or remove the driver for any collection or delivery. Open a job to see its proof of collection and proof of delivery.</p>
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
              <thead><tr><th>Job</th><th>Task</th><th>Where</th><th>Driver</th><th>Status</th><th>Proof</th><th>Time taken</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.tasks.map((t) => {
                  const editable = ["unassigned", "assigned", "started", "arrived", "collected", "arrived_delivery"].includes(t.status);
                  const proofKinds = Object.keys(t.proofs || {});
                  return (
                    <tr key={t.id}>
                      <td><Link to={`/admin/bookings/${t.reference}`} className="mono">{t.reference}</Link></td>
                      <td>{TASK_KIND_LABELS[t.kind]}<div className="small muted">{t.item}</div></td>
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
    </div>
  );
}
