import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, Pencil, Plus, Power, Trash2, UserPlus } from "lucide-react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { dateTime, duration, TASK_KIND_LABELS } from "../../lib/format.js";
import { Alert, Badge, Empty, Field, Modal, Spinner, Tabs } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export const TASK_TONE = { unassigned: "critical", assigned: "warning", started: "accent", arrived: "accent", collected: "info", arrived_delivery: "accent", closed: "good", completed: "good", cancelled: "muted" };
const VISA_STATUSES = ["British or Irish citizen", "EU Settled Status", "EU Pre-settled Status", "Indefinite Leave to Remain", "Skilled Worker visa", "Graduate visa", "Student visa", "Family visa", "Other"];
const FIELDS = ["first_name", "last_name", "phone", "licence_number", "transmission", "email", "username", "password", "passport_number", "visa_status", "visa_expiry", "bank_account_name", "bank_sort_code", "bank_account_number"];

/** Create or edit a driver: personal details, driving, login, right to work and bank details. */
function DriverForm({ driver, onSaved, onClose }) {
  const editing = !!driver?.id;
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map((k) => [k, (k !== "password" && driver?.[k]) || ""])));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const input = (k, label, props = {}) => (
    <Field label={label} htmlFor={`d-${k}`} hint={props.hint} className={props.wide ? "span-all" : ""}>
      <input id={`d-${k}`} className={`input${props.mono ? " mono" : ""}`} value={form[k]} onChange={set(k)} required={props.required} type={props.type || "text"} autoComplete="off" {...(props.extra || {})} />
    </Field>
  );

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email && !form.username) return setError("Give the driver an email address or a username to sign in with.");
    setBusy(true);
    setError(null);
    try {
      const body = { driver: Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === "" ? (k === "password" ? undefined : null) : v])) };
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
        <h3 style={{ margin: 0 }}>Driver details</h3>
        <div className="form-grid">
          {input("first_name", "First name", { required: true })}
          {input("last_name", "Last name", { required: true })}
          {input("phone", "Phone", { required: !editing, type: "tel" })}
        </div>
        <h3 style={{ margin: "8px 0 0" }}>Driving</h3>
        <div className="form-grid">
          {input("licence_number", "Driving licence number", { required: !editing, mono: true })}
          <Field label="Gearbox" htmlFor="d-transmission">
            <select id="d-transmission" className="select" value={form.transmission} onChange={set("transmission")} required={!editing}>
              <option value="">Choose…</option><option value="manual">Manual</option><option value="automatic">Automatic</option>
            </select>
          </Field>
        </div>
        <h3 style={{ margin: "8px 0 0" }}>Login details</h3>
        <div className="form-grid">
          {input("username", "Username", { hint: "3–30 letters, numbers, dots or dashes", extra: { autoCapitalize: "none" } })}
          {input("email", "Email", { type: "email", hint: "Optional if a username is set" })}
          {input("password", editing ? "New password" : "Password", { wide: true, mono: true, required: !editing, hint: editing ? "Leave blank to keep the current password" : "At least 8 characters – share it with the driver securely", extra: { minLength: 8, autoComplete: "new-password" } })}
        </div>
        <h3 style={{ margin: "8px 0 0" }}>Right to work <span className="muted small">(optional)</span></h3>
        <div className="form-grid">
          {input("passport_number", "Passport number", { mono: true })}
          <Field label="Visa status" htmlFor="d-visa_status">
            <select id="d-visa_status" className="select" value={form.visa_status} onChange={set("visa_status")}>
              <option value="">Not recorded</option>{VISA_STATUSES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          {input("visa_expiry", "Visa expiry date", { type: "date" })}
        </div>
        <h3 style={{ margin: "8px 0 0" }}>Bank details <span className="muted small">(optional)</span></h3>
        <div className="form-grid">
          {input("bank_account_name", "Account holder name")}
          {input("bank_sort_code", "Sort code", { mono: true, extra: { placeholder: "12-34-56", inputMode: "numeric" } })}
          {input("bank_account_number", "Account number", { mono: true, extra: { placeholder: "8 digits", inputMode: "numeric", maxLength: 8 } })}
        </div>
        <p className="small muted" style={{ margin: 0 }}>Licence, passport and bank details are encrypted and only visible to admins.</p>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create driver account"}</button>
      </form>
    </Modal>
  );
}

const mask = (v, keep = 4) => (v ? `••••${String(v).slice(-keep)}` : "—");

/** Driver profile summary; sensitive values are masked (full values are in Edit, admins only). */
function DriverProfile({ d }) {
  const row = (label, value) => <div><dt>{label}</dt><dd>{value || "—"}</dd></div>;
  return (
    <div className="grid-2">
      <div className="card">
        <h3>Driver details</h3>
        <dl className="detail-list">
          {row("Name", `${d.first_name || ""} ${d.last_name || ""}`.trim() || d.name)}
          {row("Phone", d.phone)}
          {row("Licence", "licence_number" in d ? mask(d.licence_number) : "Admins only")}
          {row("Gearbox", d.transmission ? d.transmission[0].toUpperCase() + d.transmission.slice(1) : null)}
          {row("Signs in with", d.username || d.email)}
        </dl>
      </div>
      {"bank_account_number" in d && (
        <div className="card">
          <h3>Right to work & bank</h3>
          <dl className="detail-list">
            {row("Passport", mask(d.passport_number))}
            {row("Visa status", d.visa_status)}
            {row("Visa expiry", d.visa_expiry ? dateTime(d.visa_expiry).split(",")[0] : null)}
            {row("Bank account", d.bank_account_number ? `${d.bank_account_name || ""} · ${d.bank_sort_code || ""} · ${mask(d.bank_account_number)}` : null)}
          </dl>
        </div>
      )}
    </div>
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
  const tasks = data.tasks.filter((t) => (tab === "open" ? ["assigned", "started", "arrived", "collected", "arrived_delivery"].includes(t.status) : tab === "done" ? ["closed", "completed"].includes(t.status) : true));

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
      <DriverProfile d={d} />
      <div className="row-between">
        <h3 style={{ margin: 0 }}>Tasks</h3>
        <Tabs label="Task filter" value={tab} onChange={setTab} tabs={[{ value: "open", label: "Open" }, { value: "done", label: "Finished" }, { value: "all", label: "All" }]} />
      </div>
      {tasks.length === 0 ? <div className="card"><Empty title="No tasks here" /></div> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Job</th><th>Task</th><th>Contact</th><th>Route</th><th>Status</th><th>Proofs</th><th>Time taken</th></tr></thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => navigate(`/admin/bookings/${t.reference}`)}>
                  <td className="mono">{t.reference}</td>
                  <td>{TASK_KIND_LABELS[t.kind]}</td>
                  <td>{t.contact_name}<div className="small muted">{t.item}</div></td>
                  <td>{t.route}</td>
                  <td><Badge tone={TASK_TONE[t.status]}>{t.status_label}</Badge></td>
                  <td>{t.proof_kinds?.length ? t.proof_kinds.map((k) => <Badge key={k} tone="good" plain>{{ collection: "POC", depot: "Depot", delivery: "POD" }[k]} ✓</Badge>) : <span className="muted small">—</span>}</td>
                  <td className="small">{t.timings?.total_seconds != null ? duration(t.timings.total_seconds) : <span className="muted">—</span>}</td>
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
