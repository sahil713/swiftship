import { useState } from "react";
import { api } from "../../lib/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { Alert, Field } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";

export default function Profile() {
  const { user, setUser } = useAuth();
  const { preference, setPreference } = useTheme();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || "", current_password: "", password: "" });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api("/auth/me", { method: "PATCH", body: form });
      setUser(res.user);
      setForm((f) => ({ ...f, current_password: "", password: "" }));
      toast("Profile updated");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1>Profile</h1>
      <form className="card stack" onSubmit={submit}>
        {error && <Alert type="error">{error}</Alert>}
        <Field label="Email"><input className="input" value={user.email} disabled /></Field>
        <Field label="Full name" htmlFor="p-name"><input id="p-name" className="input" value={form.name} onChange={set("name")} required /></Field>
        <Field label="Mobile" htmlFor="p-phone" hint="Used for SMS delivery updates"><input id="p-phone" type="tel" className="input" value={form.phone} onChange={set("phone")} /></Field>
        <hr className="divider" />
        <h3>Change password</h3>
        <div className="form-grid">
          <Field label="Current password" htmlFor="p-cur"><input id="p-cur" type="password" className="input" autoComplete="current-password" value={form.current_password} onChange={set("current_password")} /></Field>
          <Field label="New password" htmlFor="p-new" hint="At least 8 characters"><input id="p-new" type="password" minLength={8} className="input" autoComplete="new-password" value={form.password} onChange={set("password")} /></Field>
        </div>
        <button className="btn btn-primary">Save changes</button>
      </form>
      <div className="card">
        <h3>Appearance</h3>
        <fieldset className="option-grid">
          <legend className="sr-only">Theme</legend>
          {[["light", "Light"], ["dark", "Dark"], ["system", "Match my device"]].map(([v, l]) => (
            <label key={v} className="option">
              <input type="radio" name="theme" value={v} checked={preference === v} onChange={() => setPreference(v)} />
              <span className="opt-title">{l}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
