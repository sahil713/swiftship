import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, Pencil, Plus, Power, Trash2, UserPlus } from "lucide-react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { dateTime } from "../../lib/format.js";
import { Alert, Badge, Empty, Field, Modal, Spinner, Tabs } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export const TASK_TONE = { unassigned: "critical", assigned: "warning", started: "accent", collected: "info", closed: "good", completed: "good", cancelled: "muted" };
const BLANK = { name: "", phone: "", email: "", username: "", password: "" };

/** Create or edit a driver's details and login. */
function DriverForm({ driver, onSaved, onClose }) {
  const editing = !!driver?.id;
  const [form, setForm] = useState(editing ? { name: driver.name, phone: driver.phone || "", email: driver.email || "", username: driver.username || "", password: "" } : BLANK);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email && !form.username) return setError("Give the driver an email address or a username to sign in with.");
    setBusy(true);
    setError(null);
    try {
      const body = { driver: { ...form, email: form.email || null, username: form.username || null } };
      const saved = await api(editing ? `/admin/drivers/${driver.id}` : "/admin/drivers", { method: editing ? "PATCH" : "POST", body });
      onSaved(saved, editing ? "Driver updated" : `Driver account created for ${saved.name}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={editing ? `Edit ${driver.name}` : "Add a driver"}>
      <form className="stack" onSubmit={submit}>
        {error && <Alert type="error">{error}</Alert>}
        <div className="form-grid">
          <Field label="Full name" htmlFor="d-name"><input id="d-name" className="input" value={form.name} onChange={set("name")} required /></Field>
          <Field label="Phone" htmlFor="d-phone"><input id="d-phone" type="tel" className="input" value={form.phone} onChange={set("phone")} /></Field>
        </div>
        <h3 style={{ margin: "8px 0 0" }}>Login details</h3>
        <div className="form-grid">
          <Field label="Username" htmlFor="d-user" hint="3–30 letters, numbers, dots or dashes"><input id="d-user" className="input" value={form.username} onChange={set("username")} autoComplete="off" autoCapitalize="none" /></Field>
          <Field label="Email" htmlFor="d-email" hint="Optional if a username is set"><input id="d-email" type="email" className="input" value={form.email} onChange={set("email")} autoComplete="off" /></Field>
          <Field label={editing ? "New password" : "Password"} htmlFor="d-pass" className="span-all" hint={editing ? "Leave blank to keep the current password" : "At least 8 characters – share it with the driver securely"}>
            <input id="d-pass" type="text" className="input mono" minLength={8} value={form.password} onChange={set("password")} required={!editing} autoComplete="new-password" />
          </Field>
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create driver account"}</button>
      </form>
    </Modal>
  );
}

function ResetPassword({ driver, onClose, onSaved }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    try {
      onSaved(await api(`/admin/drivers/${driver.id}`, { method: "PATCH", body: { driver: { password } } }), "Password reset");
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Reset password – ${driver.name}`}>
      <form className="stack" onSubmit={submit}>
        {error && <Alert type="error">{error}</Alert>}
        <p className="muted small" style={{ margin: 0 }}>The driver signs in with <strong>{driver.username || driver.email}</strong>. Their old password stops working straight away.</p>
        <Field label="New password" htmlFor="rp-pass" hint="At least 8 characters"><input id="rp-pass" type="text" className="input mono" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" /></Field>
        <button className="btn btn-primary">Reset password</button>
      </form>
    </Modal>
  );
}

/** Shared account actions (edit, reset password, activate/deactivate, remove). */
function useDriverActions(onChanged) {
  const toast = useToast();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const saved = (driver, message) => { setModal(null); toast(message); onChanged(driver); };

  const toggleActive = async (d) => {
    const deactivating = d.active;
    if (deactivating && !window.confirm(`Deactivate ${d.name}? They won't be able to sign in${d.open_tasks ? `, and their ${d.open_tasks} open task(s) that haven't been collected yet will be unassigned` : ""}.`)) return;
    try {
      const res = await api(`/admin/drivers/${d.id}`, { method: "PATCH", body: { driver: { active: !deactivating } } });
      toast(deactivating ? `${d.name} deactivated${res.unassigned_tasks ? ` – ${res.unassigned_tasks} task(s) unassigned` : ""}` : `${d.name} reactivated`);
      onChanged(res);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const remove = async (d) => {
    if (!window.confirm(`Permanently remove ${d.name}'s account? This can't be undone.`)) return;
    try {
      await api(`/admin/drivers/${d.id}`, { method: "DELETE" });
      toast(`${d.name} removed`);
      navigate("/admin/drivers");
      onChanged(null);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const modals = modal && (modal.type === "password"
    ? <ResetPassword driver={modal.driver} onClose={() => setModal(null)} onSaved={saved} />
    : <DriverForm driver={modal.driver} onClose={() => setModal(null)} onSaved={saved} />);

  return { edit: (d) => setModal({ type: "edit", driver: d }), create: () => setModal({ type: "edit", driver: null }), password: (d) => setModal({ type: "password", driver: d }), toggleActive, remove, modals };
}

export default function Drivers() {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState("active");
  const { data, loading, reload } = useApi("/admin/drivers", { status });
  const navigate = useNavigate();
  const actions = useDriverActions(() => reload());

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h1 style={{ marginBottom: 4 }}>Drivers</h1>
          <p className="muted" style={{ margin: 0 }}>Driver accounts and logins. Drivers only ever see tasks assigned to them.</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={actions.create}><UserPlus size={16} /> Add driver</button>}
      </div>
      <Tabs label="Driver status" value={status} onChange={setStatus} tabs={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "all", label: "All" }]} />
      {loading && !data ? <Spinner /> : data.length === 0 ? (
        <div className="card"><Empty title={status === "inactive" ? "No inactive drivers" : "No drivers yet"}>{isAdmin && status !== "inactive" && <button className="btn btn-secondary btn-sm" onClick={actions.create}><Plus size={14} /> Add your first driver</button>}</Empty></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Driver</th><th>Login</th><th>Phone</th><th className="num">Open tasks</th><th className="num">Completed</th><th>Status</th>{isAdmin && <th><span className="sr-only">Actions</span></th>}</tr></thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className="clickable" onClick={() => navigate(`/admin/drivers/${d.id}`)}>
                  <td><Link to={`/admin/drivers/${d.id}`} onClick={(e) => e.stopPropagation()}><strong>{d.name}</strong></Link></td>
                  <td className="small">{d.username && <div className="mono">{d.username}</div>}{d.email && <div className="muted">{d.email}</div>}</td>
                  <td>{d.phone || "—"}</td>
                  <td className="num">{d.open_tasks}</td>
                  <td className="num">{d.completed_tasks}</td>
                  <td><Badge tone={d.active ? "good" : "muted"}>{d.active ? "Active" : "Inactive"}</Badge></td>
                  {isAdmin && (
                    <td style={{ whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-sm" aria-label={`Edit ${d.name}`} title="Edit" onClick={() => actions.edit(d)}><Pencil size={14} /></button>
                      <button className="btn btn-ghost btn-sm" aria-label={`Reset password for ${d.name}`} title="Reset password" onClick={() => actions.password(d)}><KeyRound size={14} /></button>
                      <button className="btn btn-ghost btn-sm" aria-label={d.active ? `Deactivate ${d.name}` : `Reactivate ${d.name}`} title={d.active ? "Deactivate" : "Reactivate"} onClick={() => actions.toggleActive(d)}><Power size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {actions.modals}
    </div>
  );
}

export function DriverDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const { data, loading, error, reload } = useApi(`/admin/drivers/${id}`);
  const navigate = useNavigate();
  const actions = useDriverActions((d) => (d ? reload() : null));
  const [tab, setTab] = useState("open");
  if (loading && !data) return <Spinner />;
  if (error) return <Alert type="error">{error.message}</Alert>;
  const d = data.driver;
  const tasks = data.tasks.filter((t) => (tab === "open" ? ["assigned", "started", "collected"].includes(t.status) : tab === "done" ? ["closed", "completed"].includes(t.status) : true));

  return (
    <div className="stack">
      <Link to="/admin/drivers" className="small row" style={{ gap: 4 }}><ArrowLeft size={14} /> All drivers</Link>
      <div className="row-between">
        <div>
          <h1 style={{ margin: 0 }}>{d.name} <Badge tone={d.active ? "good" : "muted"}>{d.active ? "Active" : "Inactive"}</Badge></h1>
          <div className="muted">Signs in with <strong className="mono">{d.username || d.email}</strong>{d.phone && <> · <a href={`tel:${d.phone}`}>{d.phone}</a></>}{d.email && d.username && <> · {d.email}</>}</div>
        </div>
        {isAdmin && (
          <div className="row">
            <button className="btn btn-secondary btn-sm" onClick={() => actions.edit(d)}><Pencil size={14} /> Edit</button>
            <button className="btn btn-secondary btn-sm" onClick={() => actions.password(d)}><KeyRound size={14} /> Reset password</button>
            <button className="btn btn-secondary btn-sm" onClick={() => actions.toggleActive(d)}><Power size={14} /> {d.active ? "Deactivate" : "Reactivate"}</button>
            <button className="btn btn-danger btn-sm" onClick={() => actions.remove(d)}><Trash2 size={14} /> Remove</button>
          </div>
        )}
      </div>
      <div className="grid-4">
        <div className="card kpi"><div className="kpi-label">Open tasks</div><div className="kpi-value">{d.open_tasks}</div></div>
        <div className="card kpi"><div className="kpi-label">Completed tasks</div><div className="kpi-value">{d.completed_tasks}</div></div>
        <div className="card kpi"><div className="kpi-label">Driver since</div><div className="kpi-value" style={{ fontSize: "1.2rem" }}>{dateTime(d.created_at)}</div></div>
      </div>
      <div className="row-between">
        <h3 style={{ margin: 0 }}>Tasks</h3>
        <Tabs label="Task filter" value={tab} onChange={setTab} tabs={[{ value: "open", label: "Open" }, { value: "done", label: "Finished" }, { value: "all", label: "All" }]} />
      </div>
      {tasks.length === 0 ? <div className="card"><Empty title="No tasks here" /></div> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Job</th><th>Task</th><th>Contact</th><th>Route</th><th>Status</th><th>Proof</th></tr></thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => navigate(`/admin/bookings/${t.reference}`)}>
                  <td className="mono">{t.reference}</td>
                  <td style={{ textTransform: "capitalize" }}>{t.kind}</td>
                  <td>{t.contact_name}<div className="small muted">{t.item}</div></td>
                  <td>{t.route}</td>
                  <td><Badge tone={TASK_TONE[t.status]}>{t.status_label}</Badge></td>
                  <td>{t.has_proof ? <Badge tone="good" plain>{t.kind === "collection" ? "POC" : "POD"} ✓</Badge> : <span className="muted small">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {actions.modals}
    </div>
  );
}
