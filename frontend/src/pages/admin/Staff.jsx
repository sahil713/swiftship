import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { humanize } from "../../lib/format.js";
import { Alert, Badge, Field, Modal, Spinner } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const ROLE_INFO = {
  admin: "Full access, including pricing, refunds, staff and settings",
  operations: "Bookings, statuses, customers and enquiries",
  driver: "Assigned jobs only, via the operations view",
};

export default function Staff() {
  const { isAdmin } = useAuth();
  const { data, loading, reload } = useApi("/admin/staff");
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const toast = useToast();

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const { id, name, email, phone, role, password, active } = editing;
      await api(id ? `/admin/staff/${id}` : "/admin/staff", { method: id ? "PATCH" : "POST", body: { user: { name, email, phone, role, password, active } } });
      toast("Saved");
      setEditing(null);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };
  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>Staff & drivers</h1>
        {isAdmin && <button className="btn btn-primary" onClick={() => { setError(null); setEditing({ name: "", email: "", phone: "", role: "driver", password: "", active: true }); }}><Plus size={16} /> Add person</button>}
      </div>
      <div className="grid-3">
        {Object.entries(ROLE_INFO).map(([r, d]) => <div key={r} className="card card-tight"><strong>{humanize(r)}</strong><div className="small muted">{d}</div></div>)}
      </div>
      {loading ? <Spinner /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th>{isAdmin && <th><span className="sr-only">Actions</span></th>}</tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td><td>{u.email}</td><td>{u.phone || "—"}</td>
                  <td><Badge tone={u.role === "admin" ? "accent" : u.role === "operations" ? "info" : "neutral"} plain>{humanize(u.role)}</Badge></td>
                  <td><Badge tone={u.active ? "good" : "muted"}>{u.active ? "Active" : "Disabled"}</Badge></td>
                  {isAdmin && <td><button className="btn btn-ghost btn-sm" aria-label={`Edit ${u.name}`} onClick={() => { setError(null); setEditing({ ...u, password: "" }); }}><Pencil size={14} /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing.name}` : "Add staff member"}>
        {editing && (
          <form className="stack" onSubmit={save}>
            {error && <Alert type="error">{error}</Alert>}
            <div className="form-grid">
              <Field label="Name" htmlFor="s-name"><input id="s-name" className="input" value={editing.name} onChange={set("name")} required /></Field>
              <Field label="Email" htmlFor="s-email"><input id="s-email" type="email" className="input" value={editing.email} onChange={set("email")} required /></Field>
              <Field label="Phone" htmlFor="s-phone"><input id="s-phone" className="input" value={editing.phone || ""} onChange={set("phone")} /></Field>
              <Field label="Role" htmlFor="s-role"><select id="s-role" className="select" value={editing.role} onChange={set("role")}>{Object.keys(ROLE_INFO).map((r) => <option key={r} value={r}>{humanize(r)}</option>)}</select></Field>
              <Field label={editing.id ? "New password (leave blank to keep)" : "Password"} htmlFor="s-pass" className="span-all"><input id="s-pass" type="password" minLength={8} className="input" value={editing.password} onChange={set("password")} required={!editing.id} autoComplete="new-password" /></Field>
            </div>
            <label className="checkbox"><input type="checkbox" checked={!!editing.active} onChange={set("active")} /> Active (can sign in)</label>
            <button className="btn btn-primary">Save</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
