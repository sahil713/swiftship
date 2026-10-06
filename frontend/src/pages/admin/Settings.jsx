import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { Alert, Field, Spinner } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

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
    <form className="stack" style={{ maxWidth: 680 }} onSubmit={save}>
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
    </form>
  );
}
