import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Badge, Field, Modal, Spinner } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const BLANK_METHOD = { name: "", bank_name: "", account_name: "", account_number: "", sort_code: "", iban: "", swift_bic: "", instructions: "", active: true };

function PaymentMethodForm({ method, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...BLANK_METHOD, ...Object.fromEntries(Object.entries(method || {}).map(([k, v]) => [k, v ?? ""])) }));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const field = (k, label, extra = {}) => (
    <Field label={label} htmlFor={`pm-${k}`} hint={extra.hint} className={extra.wide ? "span-all" : ""}>
      <input id={`pm-${k}`} className="input" value={form[k]} onChange={set(k)} required={extra.required} placeholder={extra.placeholder} inputMode={extra.inputMode} />
    </Field>
  );
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path = method?.id ? `/admin/payment_methods/${method.id}` : "/admin/payment_methods";
      await api(path, { method: method?.id ? "PATCH" : "POST", body: { payment_method: form } });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={method?.id ? "Edit payment details" : "Add payment details"}>
      <form className="stack" onSubmit={submit}>
        {error && <Alert type="error">{error}</Alert>}
        <div className="form-grid">
          {field("name", "Payment method name", { required: true, wide: true, placeholder: "e.g. Main business account" })}
          {field("bank_name", "Bank name")}
          {field("account_name", "Account name")}
          {field("account_number", "Account number", { inputMode: "numeric", placeholder: "8 digits" })}
          {field("sort_code", "Sort code", { inputMode: "numeric", placeholder: "12-34-56" })}
          {field("iban", "IBAN (optional)")}
          {field("swift_bic", "SWIFT / BIC (optional)")}
          <Field label="Payment instructions" htmlFor="pm-instructions" className="span-all" hint="Shown to the customer, e.g. 'Use your booking reference as the payment reference.'">
            <textarea id="pm-instructions" className="textarea" rows={3} value={form.instructions} onChange={set("instructions")} />
          </Field>
          <label className="checkbox span-all"><input type="checkbox" checked={!!form.active} onChange={set("active")} /> Active – can be sent to customers</label>
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save payment details"}</button>
      </form>
    </Modal>
  );
}

/** Saved bank / payment details the office can send to customers from a booking. */
function PaymentMethods({ isAdmin }) {
  const toast = useToast();
  const { data, loading, reload } = useApi("/admin/payment_methods");
  const [editing, setEditing] = useState(null);
  const remove = async (m) => {
    if (!window.confirm(`Delete "${m.name}"?`)) return;
    try {
      await api(`/admin/payment_methods/${m.id}`, { method: "DELETE" });
      toast("Payment details deleted");
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  };
  return (
    <div className="card stack">
      <div className="row-between">
        <h3 style={{ margin: 0 }}>Bank / payment details</h3>
        {isAdmin && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({})}><Plus size={14} /> Add</button>}
      </div>
      <p className="small muted" style={{ margin: 0 }}>Choose one of these on a booking to email or text the customer how to pay.</p>
      {loading && !data ? <Spinner /> : data.length === 0 ? <p className="small muted" style={{ margin: 0 }}>No payment details saved yet.</p> : data.map((m) => (
        <div key={m.id} className="row-between" style={{ borderTop: "1px solid var(--border)", paddingTop: 10, alignItems: "flex-start" }}>
          <div className="small">
            <strong>{m.name}</strong> {m.active ? <Badge tone="good" plain>Active</Badge> : <Badge tone="muted" plain>Inactive</Badge>}
            <div className="muted">{[m.bank_name, m.account_name, m.sort_code && `Sort code ${m.sort_code}`, m.account_number && `Account ${m.account_number}`, m.iban && `IBAN ${m.iban}`].filter(Boolean).join(" · ")}</div>
          </div>
          {isAdmin && (
            <div className="row" style={{ gap: 4 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(m)} aria-label={`Edit ${m.name}`}><Pencil size={14} /></button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(m)} aria-label={`Delete ${m.name}`}><Trash2 size={14} /></button>
            </div>
          )}
        </div>
      ))}
      {editing && <PaymentMethodForm method={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast("Payment details saved"); reload(); }} />}
    </div>
  );
}

export default function Settings() {
  const { isAdmin } = useAuth();
  const { data, loading } = useApi("/admin/settings");
  const [form, setForm] = useState(null);
  const toast = useToast();
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  if (loading || !form) return <Spinner />;

  const save = async (e) => {
    e.preventDefault();
    try {
      setForm(await api("/admin/settings", { method: "PATCH", body: { settings: form } }));
      toast("Settings saved");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="stack" style={{ maxWidth: 680 }}>
    <form className="stack" onSubmit={save}>
      <h1>Settings</h1>
      {!isAdmin && <Alert type="info">Only administrators can change settings.</Alert>}
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Service area</h3>
        <p className="small muted" style={{ margin: 0 }}>Ireland – the Republic of Ireland and Northern Ireland – is never served. Areas we don't normally serve are managed under <a href="/admin/pricing">Services &amp; pricing → Service area rules</a>.</p>
      </div>
      <fieldset className="card stack" disabled={!isAdmin}>
        <h3 style={{ margin: 0 }}>Driver proof</h3>
        <label className="checkbox">
          <input type="checkbox" checked={form.require_collection_signature !== false} onChange={(e) => setForm({ ...form, require_collection_signature: e.target.checked })} />
          <span><strong>Require a signature at collection</strong><br /><span className="small muted">Drivers must capture the customer's signature with the proof of collection. Delivery and depot records always need a signature, and deliveries always need at least 2 photos.</span></span>
        </label>
        <Field label="Depot address" htmlFor="st-depot" hint="Shown to drivers on collection tasks, with Copy and Maps buttons, and used as the default depot location.">
          <textarea id="st-depot" className="textarea" rows={2} value={form.depot_address || ""} onChange={(e) => setForm({ ...form, depot_address: e.target.value })} />
        </Field>
      </fieldset>
      <fieldset className="card stack" disabled={!isAdmin}>
        <h3 style={{ margin: 0 }}>Quote requests</h3>
        <Field label="Email new requests to" htmlFor="st-enq" hint="Every new customer request is emailed here with all its details. Separate several addresses with commas. Leave blank to email all admin users.">
          <input id="st-enq" className="input" placeholder="e.g. bookings@yourcompany.co.uk" value={form.enquiry_notification_email || ""} onChange={(e) => setForm({ ...form, enquiry_notification_email: e.target.value })} />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={!!form.pricing_enabled} onChange={(e) => setForm({ ...form, pricing_enabled: e.target.checked })} />
          <span><strong>Online pricing</strong><br /><span className="small muted">Off: customers never see prices – they submit a request and your team calls them with a quote. On: instant estimates, online price confirmation and card payment.</span></span>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={!!form.auto_confirm_quotes} onChange={(e) => setForm({ ...form, auto_confirm_quotes: e.target.checked })} />
          <span><strong>Automatically confirm complete quotes</strong><br /><span className="small muted">Only applies when online pricing is on. Quotes with a weight and no review flags go straight to payment.</span></span>
        </label>
      </fieldset>
      <fieldset className="card stack" disabled={!isAdmin}>
        <h3 style={{ margin: 0 }}>Contact details</h3>
        <div className="form-grid">
          <Field label="Support email" htmlFor="st-email"><input id="st-email" type="email" className="input" value={form.support_email} onChange={(e) => setForm({ ...form, support_email: e.target.value })} /></Field>
          <Field label="Support phone" htmlFor="st-phone"><input id="st-phone" className="input" value={form.support_phone} onChange={(e) => setForm({ ...form, support_phone: e.target.value })} /></Field>
        </div>
      </fieldset>
      {isAdmin && <button className="btn btn-primary" style={{ alignSelf: "flex-start" }}>Save settings</button>}
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Customer messages</h3>
        <div className="small">Email: {form.messaging?.email ? <Badge tone="good" plain>Working</Badge> : <Badge tone="warning" plain>Not set up</Badge>}</div>
        <div className="small">Text (SMS): {form.messaging?.sms ? <Badge tone="good" plain>Working</Badge> : <Badge tone="warning" plain>Not set up</Badge>}</div>
        {!form.messaging?.sms && <p className="small muted" style={{ margin: 0 }}>Text messages need SMS credits on the Brevo account. Until then, payment details and driver messages go by email only.</p>}
      </div>
    </form>
    <PaymentMethods isAdmin={isAdmin} />
    </div>
  );
}
