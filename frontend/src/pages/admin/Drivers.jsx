import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Eye, FileUp, History, KeyRound, Pencil, Plus, Power, Trash2, UserPlus } from "lucide-react";
import { api, openPrivateFile } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { dateTime, duration, TASK_KIND_LABELS } from "../../lib/format.js";
import { Alert, Badge, Empty, Field, Modal, Spinner, Tabs } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export const TASK_TONE = { unassigned: "critical", assigned: "warning", started: "accent", arrived: "accent", collected: "info", at_depot: "info", arrived_delivery: "accent", delivered: "good", closed: "good", completed: "good", cancelled: "muted" };
const VISA_STATUSES = ["British or Irish citizen", "EU Settled Status", "EU Pre-settled Status", "Indefinite Leave to Remain", "Skilled Worker visa", "Graduate visa", "Student visa", "Family visa", "Other"];
const FIELDS = ["first_name", "last_name", "phone", "licence_number", "transmission", "email", "username", "password", "passport_number", "visa_status", "visa_expiry", "bank_account_name", "bank_sort_code", "bank_account_number"];

/** Create or edit a driver: personal details, driving, login, right to work and bank details. */
function DriverForm({ driver, onSaved, onClose }) {
  const editing = !!driver?.id;
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map((k) => [k, (k !== "password" && driver?.[k]) || ""])));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const input = (k, label, props = {}) => (
    <Field label={label} htmlFor={`d-${k}`} hint={props.hint} className={props.wide ? "span-all" : ""}>
      <input id={`d-${k}`} className={`input${props.mono ? " mono" : ""}`} value={form[k]} onChange={set(k)} required={props.required} type={props.type || "text"} autoComplete="off" {...(props.extra || {})} />
    </Field>
  );

  const submit = async (e) => {
    e.preventDefault();
    const tooBig = Object.values(files).find((f) => f && f.size > MAX_DOC_BYTES);
    if (tooBig) return setError(`${tooBig.name} is larger than 4 MB.`);
    setBusy(true);
    setError(null);
    let saved;
    try {
      const body = { driver: Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === "" ? (k === "password" ? undefined : null) : v])) };
      saved = await api(editing ? `/admin/drivers/${driver.id}` : "/admin/drivers", { method: editing ? "PATCH" : "POST", body });
    } catch (err) {
      setError(err.message);
      return setBusy(false);
    }
    // Upload any documents chosen in the form, now the driver exists.
    for (const [docType, file] of Object.entries(files)) {
      if (!file) continue;
      try {
        await uploadDocument(saved.id, docType, file);
      } catch (err) {
        setBusy(false);
        return setError(`The driver was saved, but the ${DOC_TYPES[docType].toLowerCase()} didn't upload: ${err.message}`);
      }
    }
    onSaved(saved, editing ? "Driver updated" : `Driver account created for ${saved.name}`);
  };

  return (
    <Modal open onClose={onClose} title={editing ? `Edit ${driver.name}` : "Add a driver"}>
      <form className="stack" onSubmit={submit}>
        {error && <Alert type="error">{error}</Alert>}
        <h3 style={{ margin: 0 }}>Driver details</h3>
        <div className="form-grid">
          {input("first_name", "First name", { required: true })}
          {input("last_name", "Last name", { required: true })}
          {input("phone", "Phone number", { required: true, type: "tel" })}
          {input("email", "Email address", { required: true, type: "email" })}
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
          {input("username", "Username", { required: true, hint: "3–30 letters, numbers, dots or dashes. The driver signs in with this or their email.", extra: { autoCapitalize: "none" } })}
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
        <h3 style={{ margin: "8px 0 0" }}>Documents <span className="muted small">(optional)</span></h3>
        <div className="form-grid">
          {["licence", "passport", "visa"].map((type) => (
            <Field key={type} label={DOC_TYPES[type]} htmlFor={`d-file-${type}`} hint="PDF or photo, up to 4 MB">
              <input id={`d-file-${type}`} type="file" className="input" accept={DOC_ACCEPT} onChange={(e) => setFiles({ ...files, [type]: e.target.files?.[0] || null })} />
            </Field>
          ))}
        </div>
        <p className="small muted" style={{ margin: 0 }}>Licence, passport and bank details are encrypted and only visible to admins. Documents are private and only admins can open them.</p>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create driver account"}</button>
      </form>
    </Modal>
  );
}

const mask = (v, keep = 4) => (v ? `••••${String(v).slice(-keep)}` : "—");

const DOC_TYPES = { licence: "Driving licence", passport: "Passport", visa: "Visa / right to work", other: "Other document" };
const DOC_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic";
const MAX_DOC_BYTES = 4 * 1024 * 1024;

function uploadDocument(driverId, docType, file, extra = {}) {
  const fd = new FormData();
  fd.append("doc_type", docType);
  fd.append("file", file);
  Object.entries(extra).forEach(([k, v]) => v && fd.append(k, v));
  return api(`/admin/drivers/${driverId}/documents`, { method: "POST", body: fd });
}

const sizeLabel = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Private driver documents (admin only): view, download, replace, remove – old versions kept as history. */
function DriverDocuments({ driverId }) {
  const toast = useToast();
  const { data, loading, reload } = useApi(`/admin/drivers/${driverId}/documents`);
  const [upload, setUpload] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const current = (data || []).filter((d) => !d.replaced_at);
  const history = (data || []).filter((d) => d.replaced_at);
  const open = (d, download = false) => openPrivateFile(`/admin/drivers/${driverId}/documents/${d.id}/file`, { download, filename: d.filename }).catch((e) => toast(e.message, "error"));
  const remove = async (d) => {
    if (!window.confirm(`Remove ${d.filename}? It stays in the document history.`)) return;
    try { await api(`/admin/drivers/${driverId}/documents/${d.id}`, { method: "DELETE" }); toast("Document removed"); reload(); } catch (e) { toast(e.message, "error"); }
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!upload.file) return setError("Choose a file.");
    if (upload.file.size > MAX_DOC_BYTES) return setError("Files must be 4 MB or smaller.");
    setBusy(true); setError(null);
    try {
      await uploadDocument(driverId, upload.doc_type, upload.file, { expires_on: upload.expires_on, notes: upload.notes });
      toast("Document uploaded"); setUpload(null); reload();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const row = (d) => (
    <tr key={d.id}>
      <td><strong>{d.type_label}</strong><div className="small muted">{d.filename} · {sizeLabel(d.byte_size)}</div></td>
      <td className="small">{dateTime(d.uploaded_at)}<div className="muted">{d.uploaded_by}</div></td>
      <td className="small">{d.expires_on ? new Date(d.expires_on).toLocaleDateString("en-GB") : "—"}{d.replaced_at && <div className="muted">Replaced {dateTime(d.replaced_at)}{d.replaced_by ? ` by ${d.replaced_by}` : ""}</div>}</td>
      <td style={{ whiteSpace: "nowrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => open(d)} aria-label={`View ${d.filename}`}><Eye size={14} /> View</button>
        <button className="btn btn-ghost btn-sm" onClick={() => open(d, true)} aria-label={`Download ${d.filename}`}><Download size={14} /></button>
        {!d.replaced_at && <button className="btn btn-ghost btn-sm" onClick={() => setUpload({ doc_type: d.doc_type, file: null, expires_on: "", notes: "" })}><FileUp size={14} /> Replace</button>}
        {!d.replaced_at && <button className="btn btn-ghost btn-sm" onClick={() => remove(d)} aria-label={`Remove ${d.filename}`}><Trash2 size={14} /></button>}
      </td>
    </tr>
  );
  return (
    <div className="card stack">
      <div className="row-between">
        <h3 style={{ margin: 0 }}>Documents</h3>
        <button className="btn btn-secondary btn-sm" onClick={() => setUpload({ doc_type: "licence", file: null, expires_on: "", notes: "" })}><FileUp size={14} /> Upload document</button>
      </div>
      {loading && !data ? <Spinner /> : current.length === 0 ? <p className="small muted" style={{ margin: 0 }}>No documents uploaded yet.</p> : (
        <div className="table-wrap"><table className="table"><thead><tr><th>Document</th><th>Uploaded</th><th>Expires</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{current.map(row)}</tbody></table></div>
      )}
      {history.length > 0 && (
        <>
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setShowHistory(!showHistory)}><History size={14} /> {showHistory ? "Hide" : "Show"} earlier versions ({history.length})</button>
          {showHistory && <div className="table-wrap"><table className="table"><tbody>{history.map(row)}</tbody></table></div>}
        </>
      )}
      <Modal open={!!upload} onClose={() => { setUpload(null); setError(null); }} title="Upload document">
        {upload && (
          <form className="stack" onSubmit={submit}>
            {error && <Alert type="error">{error}</Alert>}
            <Field label="Document type" htmlFor="doc-type">
              <select id="doc-type" className="select" value={upload.doc_type} onChange={(e) => setUpload({ ...upload, doc_type: e.target.value })}>
                {Object.entries(DOC_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="File" htmlFor="doc-file" hint="PDF, JPEG, PNG, WebP or HEIC, up to 4 MB. A new upload replaces the current document of this type (the old one is kept in the history).">
              <input id="doc-file" type="file" className="input" accept={DOC_ACCEPT} onChange={(e) => setUpload({ ...upload, file: e.target.files?.[0] || null })} required />
            </Field>
            <Field label="Expiry date (optional)" htmlFor="doc-expiry"><input id="doc-expiry" type="date" className="input" value={upload.expires_on} onChange={(e) => setUpload({ ...upload, expires_on: e.target.value })} /></Field>
            <Field label="Notes (optional)" htmlFor="doc-notes"><input id="doc-notes" className="input" value={upload.notes} onChange={(e) => setUpload({ ...upload, notes: e.target.value })} /></Field>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
          </form>
        )}
      </Modal>
    </div>
  );
}

function ChangeHistory({ history }) {
  if (!history?.length) return null;
  return (
    <div className="card">
      <h3>Change history</h3>
      {history.map((c) => (
        <div key={c.id} className="small" style={{ borderTop: "1px dashed var(--border)", padding: "8px 0" }}>
          <div className="muted">{dateTime(c.at)} · {c.by || "System"} · {c.action.replace(/_/g, " ")}{c.reason ? ` · ${c.reason}` : ""}</div>
          {Object.entries(c.changes).map(([f, [o, n]]) => <div key={f}><strong>{f.replace(/_/g, " ")}</strong>: <span className="muted">{o ?? "—"}</span> → {n ?? "—"}</div>)}
        </div>
      ))}
    </div>
  );
}

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
      {isAdmin && <DriverDocuments driverId={d.id} />}
      {isAdmin && <ChangeHistory history={data.history} />}
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
                <tr key={t.id} className="clickable" onClick={() => navigate(`/admin/tasks/${t.id}`)}>
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
