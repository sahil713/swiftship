import { useState } from "react";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { Alert, Empty, Field, Modal, Spinner } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";

const BLANK = { label: "", contact_name: "", phone: "", line1: "", line2: "", city: "", postcode: "" };

export default function Addresses() {
  const { data, loading, reload } = useApi("/addresses");
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const toast = useToast();

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const { id, ...address } = editing;
      await api(id ? `/addresses/${id}` : "/addresses", { method: id ? "PATCH" : "POST", body: { address } });
      setEditing(null);
      toast("Address saved");
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete ${a.label || a.line1}?`)) return;
    await api(`/addresses/${a.id}`, { method: "DELETE" });
    toast("Address deleted");
    reload();
  };

  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.value });

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>Saved addresses</h1>
        <button className="btn btn-primary" onClick={() => { setError(null); setEditing(BLANK); }}><Plus size={16} /> Add address</button>
      </div>
      {loading ? <Spinner /> : data.length === 0 ? (
        <div className="card"><Empty icon={MapPin} title="No saved addresses">Save addresses you use often to book faster.</Empty></div>
      ) : (
        <div className="grid-3">
          {data.map((a) => (
            <div key={a.id} className="card">
              <h3>{a.label || "Address"}</h3>
              <p style={{ marginBottom: 12 }}>{a.contact_name && <>{a.contact_name}<br /></>}{a.line1}{a.line2 && <>, {a.line2}</>}<br />{a.city} <span className="mono">{a.postcode}</span>{a.phone && <><br /><span className="small muted">{a.phone}</span></>}</p>
              <div className="row">
                <button className="btn btn-secondary btn-sm" onClick={() => { setError(null); setEditing(a); }}><Pencil size={14} /> Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(a)}><Trash2 size={14} /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit address" : "Add address"}>
        {editing && (
          <form className="stack" onSubmit={save}>
            {error && <Alert type="error">{error}</Alert>}
            <div className="form-grid">
              <Field label="Label" htmlFor="a-label" hint="e.g. Home, Office"><input id="a-label" className="input" value={editing.label || ""} onChange={set("label")} /></Field>
              <Field label="Contact name" htmlFor="a-name"><input id="a-name" className="input" value={editing.contact_name || ""} onChange={set("contact_name")} /></Field>
              <Field label="Phone" htmlFor="a-phone"><input id="a-phone" type="tel" className="input" value={editing.phone || ""} onChange={set("phone")} /></Field>
              <Field label="Address line 1" htmlFor="a-l1" className="span-all"><input id="a-l1" className="input" value={editing.line1} onChange={set("line1")} required /></Field>
              <Field label="Address line 2" htmlFor="a-l2" className="span-all"><input id="a-l2" className="input" value={editing.line2 || ""} onChange={set("line2")} /></Field>
              <Field label="Town / city" htmlFor="a-city"><input id="a-city" className="input" value={editing.city} onChange={set("city")} required /></Field>
              <Field label="Postcode" htmlFor="a-pc"><input id="a-pc" className="input" value={editing.postcode} onChange={set("postcode")} required /></Field>
            </div>
            <button className="btn btn-primary">Save address</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
