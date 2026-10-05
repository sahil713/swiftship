import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogIn, UserPlus } from "lucide-react";
import { homeFor, useAuth } from "../context/AuthContext.jsx";
import { Alert, Field } from "../components/ui.jsx";

function AuthCard({ title, subtitle, children }) {
  return (
    <section className="container" style={{ padding: "56px 16px 80px", maxWidth: 480 }}>
      <div className="card">
        <h1 style={{ fontSize: "1.8rem" }}>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </div>
    </section>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = useLocation().state?.from;
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(form.email, form.password);
      navigate(from || homeFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Sign in" subtitle="Customers, staff and drivers all sign in here.">
      <form className="stack" onSubmit={submit}>
        {error && <Alert type="error">{error}</Alert>}
        <Field label="Email or username" htmlFor="l-email"><input id="l-email" type="text" className="input" autoComplete="username" autoCapitalize="none" spellCheck={false} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
        <Field label="Password" htmlFor="l-pass"><input id="l-pass" type="password" className="input" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></Field>
        <button className="btn btn-primary btn-block" disabled={busy}><LogIn size={16} /> {busy ? "Signing in…" : "Sign in"}</button>
        <p className="small muted center">New here? <Link to="/register">Create an account</Link> or <Link to="/quote">book as a guest</Link>.</p>
      </form>
      {import.meta.env.DEV && (
        <details className="small muted" style={{ marginTop: 16 }}>
          <summary>Demo accounts</summary>
          <p style={{ marginTop: 8 }}>Password <code>password123</code> for: admin@swiftship.example · ops@swiftship.example · driver@swiftship.example · customer@example.com</p>
        </details>
      )}
    </AuthCard>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate("/account", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Create an account" subtitle="Save addresses, see all your orders and track them in one place. Earlier guest bookings with the same email are added automatically.">
      <form className="stack" onSubmit={submit}>
        {error && <Alert type="error">{error}</Alert>}
        <Field label="Full name" htmlFor="r-name"><input id="r-name" className="input" autoComplete="name" value={form.name} onChange={set("name")} required /></Field>
        <Field label="Email" htmlFor="r-email"><input id="r-email" type="email" className="input" autoComplete="email" value={form.email} onChange={set("email")} required /></Field>
        <Field label="Mobile (for SMS updates)" htmlFor="r-phone"><input id="r-phone" type="tel" className="input" autoComplete="tel" value={form.phone} onChange={set("phone")} /></Field>
        <Field label="Password" htmlFor="r-pass" hint="At least 8 characters"><input id="r-pass" type="password" minLength={8} className="input" autoComplete="new-password" value={form.password} onChange={set("password")} required /></Field>
        <button className="btn btn-primary btn-block" disabled={busy}><UserPlus size={16} /> {busy ? "Creating account…" : "Create account"}</button>
        <p className="small muted center">By creating an account you agree to our <Link to="/legal/terms">terms</Link> and <Link to="/legal/privacy">privacy notice</Link>.</p>
      </form>
    </AuthCard>
  );
}
