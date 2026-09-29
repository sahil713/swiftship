import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { money, penceFromPounds, poundsFromPence, humanize } from "../../lib/format.js";
import { Alert, Badge, Field, Modal, Spinner, Tabs } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

// Field specs: [key, label, type, options]. "money" fields are edited in pounds, stored in pence.
const RESOURCES = {
  services: {
    label: "Services", singular: "service", path: "/admin/services",
    blank: { name: "", slug: "", tagline: "", description: "", transit_time: "", base_price_pence: 0, price_per_kg_pence: 0, included_kg: 0, max_weight_kg: "", cutoff_hour: "", restrictions: "", position: 0, active: true },
    fields: [["name", "Name"], ["slug", "Slug (URL id)"], ["tagline", "Tagline"], ["transit_time", "Transit time label"], ["base_price_pence", "Base price (£)", "money"], ["price_per_kg_pence", "Price per extra kg (£)", "money"], ["included_kg", "Included kg", "number"], ["max_weight_kg", "Max kg per item", "number"], ["cutoff_hour", "Booking cut-off hour (0–23)", "number"], ["position", "Display order", "number"], ["description", "Description", "textarea"], ["restrictions", "Restrictions", "textarea"], ["active", "Active", "checkbox"]],
    columns: (s) => [<strong key="n">{s.name}</strong>, s.transit_time, money(s.base_price_pence), `${s.included_kg} kg + ${money(s.price_per_kg_pence)}/kg`, s.max_weight_kg ? `${Number(s.max_weight_kg)} kg` : "—", <Badge key="a" tone={s.active ? "good" : "muted"}>{s.active ? "Active" : "Hidden"}</Badge>],
    headers: ["Service", "Transit", "Base", "Weight pricing", "Max", "Status"],
  },
  delivery_areas: {
    label: "Delivery areas", singular: "delivery_area", path: "/admin/delivery_areas",
    blank: { name: "", zone: "mainland", postcode_areas: [], surcharge_pence: 0, extra_transit_days: 0, serviced: true, notes: "" },
    fields: [["name", "Region name"], ["zone", "Zone", "select", ["mainland", "remote", "northern_ireland", "excluded"]], ["postcode_areas", "Postcode areas (comma separated, e.g. IV, HS, KW)", "list"], ["surcharge_pence", "Area surcharge (£)", "money"], ["extra_transit_days", "Extra transit days", "number"], ["notes", "Notes shown to customers", "textarea"], ["serviced", "We serve this area", "checkbox"]],
    columns: (a) => [<strong key="n">{a.name}</strong>, humanize(a.zone), <span key="p" className="mono small">{a.postcode_areas.join(" ")}</span>, a.surcharge_pence ? money(a.surcharge_pence) : "—", a.extra_transit_days || "—", <Badge key="s" tone={a.serviced ? "good" : "muted"}>{a.serviced ? "Served" : "Not served"}</Badge>],
    headers: ["Region", "Zone", "Postcode areas", "Surcharge", "+Days", "Status"],
  },
  surcharges: {
    label: "Surcharges", singular: "surcharge", path: "/admin/surcharges",
    blank: { name: "", code: "fragile", kind: "fixed", amount: 0, description: "", active: true },
    fields: [["name", "Name"], ["code", "Applies when", "select", ["inter_region", "fragile", "bulky", "weekend_collection"]], ["kind", "Type", "select", ["fixed", "percent"]], ["amount", "Amount (pence if fixed, % if percent)", "number"], ["description", "Description", "textarea"], ["active", "Active", "checkbox"]],
    columns: (s) => [<strong key="n">{s.name}</strong>, humanize(s.code), s.kind === "percent" ? `${s.amount}%` : money(s.amount), <span key="d" className="small muted">{s.description}</span>, <Badge key="a" tone={s.active ? "good" : "muted"}>{s.active ? "Active" : "Off"}</Badge>],
    headers: ["Surcharge", "Trigger", "Amount", "Description", "Status"],
  },
};

function toForm(spec, record) {
  const f = { ...spec.blank, ...record };
  spec.fields.forEach(([k, , type]) => {
    if (type === "money") f[k] = poundsFromPence(f[k]);
    if (type === "list") f[k] = (f[k] || []).join(", ");
    if (f[k] === null) f[k] = "";
  });
  return f;
}

function fromForm(spec, form) {
  const out = {};
  spec.fields.forEach(([k, , type]) => {
    let v = form[k];
    if (type === "money") v = penceFromPounds(v);
    if (type === "list") v = String(v).split(/[\s,]+/).filter(Boolean);
    if (type === "number") v = v === "" ? null : Number(v);
    out[k] = v;
  });
  return out;
}

function ResourceTable({ kind }) {
  const spec = RESOURCES[kind];
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useApi(spec.path);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const body = { [spec.singular]: fromForm(spec, editing) };
      await api(editing.id ? `${spec.path}/${editing.id}` : spec.path, { method: editing.id ? "PATCH" : "POST", body });
      toast("Saved");
      setEditing(null);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete ${r.name}?`)) return;
    try {
      await api(`${spec.path}/${r.id}`, { method: "DELETE" });
      toast("Deleted");
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  if (loading && !data) return <Spinner />;
  return (
    <div className="stack">
      {!isAdmin && <Alert type="info">Only administrators can change pricing configuration.</Alert>}
      {isAdmin && <div><button className="btn btn-primary btn-sm" onClick={() => { setError(null); setEditing(toForm(spec, {})); }}><Plus size={14} /> Add {spec.label.toLowerCase().replace(/s$/, "")}</button></div>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr>{spec.headers.map((h) => <th key={h}>{h}</th>)}{isAdmin && <th><span className="sr-only">Actions</span></th>}</tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                {spec.columns(r).map((c, i) => <td key={i}>{c}</td>)}
                {isAdmin && (
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setError(null); setEditing(toForm(spec, r)); }} aria-label={`Edit ${r.name}`}><Pencil size={14} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(r)} aria-label={`Delete ${r.name}`}><Trash2 size={14} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing.name}` : `New ${spec.label.toLowerCase().replace(/s$/, "")}`}>
        {editing && (
          <form className="stack" onSubmit={save}>
            {error && <Alert type="error">{error}</Alert>}
            <div className="form-grid">
              {spec.fields.map(([k, label, type, options]) => {
                const id = `f-${k}`;
                const onChange = (e) => setEditing({ ...editing, [k]: type === "checkbox" ? e.target.checked : e.target.value });
                if (type === "checkbox") return <label key={k} className="checkbox span-all"><input type="checkbox" checked={!!editing[k]} onChange={onChange} /> {label}</label>;
                return (
                  <Field key={k} label={label} htmlFor={id} className={type === "textarea" || type === "list" ? "span-all" : ""}>
                    {type === "textarea" ? <textarea id={id} className="textarea" rows={3} value={editing[k]} onChange={onChange} />
                      : type === "select" ? <select id={id} className="select" value={editing[k]} onChange={onChange}>{options.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}</select>
                      : <input id={id} className="input" type={type === "money" || type === "number" ? "number" : "text"} step={type === "money" ? "0.01" : "any"} value={editing[k]} onChange={onChange} required={k === "name"} />}
                  </Field>
                );
              })}
            </div>
            <button className="btn btn-primary">Save</button>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default function Pricing() {
  const [tab, setTab] = useState("services");
  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>Services & pricing</h1>
        <p className="muted" style={{ margin: 0 }}>Changes apply to new quotes immediately. Existing confirmed prices aren't affected.</p>
      </div>
      <Tabs label="Pricing configuration" value={tab} onChange={setTab} tabs={Object.entries(RESOURCES).map(([v, r]) => ({ value: v, label: r.label }))} />
      <ResourceTable key={tab} kind={tab} />
    </div>
  );
}
