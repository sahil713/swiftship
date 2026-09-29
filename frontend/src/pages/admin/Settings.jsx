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
      <fieldset className="card stack" disabled={!isAdmin}>
        <h3 style={{ margin: 0 }}>Service area</h3>
        <label className="checkbox">
          <input type="checkbox" checked={!!form.northern_ireland_enabled} onChange={(e) => setForm({ ...form, northern_ireland_enabled: e.target.checked })} />
          <span><strong>Serve Northern Ireland (BT postcodes)</strong><br /><span className="small muted">When off, quotes to or from Northern Ireland are refused with a clear message. The Republic of Ireland is never served.</span></span>
        </label>
      </fieldset>
      <fieldset className="card stack" disabled={!isAdmin}>
        <h3 style={{ margin: 0 }}>Quotes</h3>
        <label className="checkbox">
          <input type="checkbox" checked={!!form.auto_confirm_quotes} onChange={(e) => setForm({ ...form, auto_confirm_quotes: e.target.checked })} />
          <span><strong>Automatically confirm complete quotes</strong><br /><span className="small muted">Quotes with a weight and no review flags go straight to payment. Turn off to review every quote manually.</span></span>
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
