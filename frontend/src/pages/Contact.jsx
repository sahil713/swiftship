import { useState } from "react";
import { Mail, Phone, Clock, Send } from "lucide-react";
import { api } from "../lib/api.js";
import { useApi } from "../lib/hooks.js";
import { Alert, Field } from "../components/ui.jsx";

const EMPTY = { name: "", email: "", phone: "", booking_reference: "", subject: "", message: "" };

export default function Contact() {
  const site = useApi("/site").data;
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/enquiries", { method: "POST", body: { enquiry: form } });
      setStatus({ type: "success", text: "Thanks — we've received your message and will reply within one working day." });
      setForm(EMPTY);
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="container" style={{ paddingBottom: 72 }}>
      <div className="page-head" style={{ paddingInline: 0 }}>
        <div className="eyebrow">Contact</div>
        <h1>We're here to help</h1>
        <p className="lead">Questions about a quote, a booking or a delivery? Send us a message or give us a call.</p>
      </div>
      <div className="booking-layout">
        <form className="card stack" onSubmit={submit}>
          {status && <Alert type={status.type}>{status.text}</Alert>}
          <div className="form-grid">
            <Field label="Your name" htmlFor="c-name"><input id="c-name" className="input" value={form.name} onChange={set("name")} required autoComplete="name" /></Field>
            <Field label="Email" htmlFor="c-email"><input id="c-email" type="email" className="input" value={form.email} onChange={set("email")} required autoComplete="email" /></Field>
            <Field label="Phone (optional)" htmlFor="c-phone"><input id="c-phone" type="tel" className="input" value={form.phone} onChange={set("phone")} autoComplete="tel" /></Field>
            <Field label="Booking reference (optional)" htmlFor="c-ref"><input id="c-ref" className="input" value={form.booking_reference} onChange={set("booking_reference")} placeholder="SS-2609-ABC123" /></Field>
            <Field label="Subject" htmlFor="c-subject" className="span-all"><input id="c-subject" className="input" value={form.subject} onChange={set("subject")} required /></Field>
            <Field label="Message" htmlFor="c-msg" className="span-all"><textarea id="c-msg" className="textarea" rows={6} value={form.message} onChange={set("message")} required /></Field>
          </div>
          <button className="btn btn-primary" disabled={busy}><Send size={16} /> {busy ? "Sending…" : "Send message"}</button>
        </form>
        <aside className="card stack">
          <h3>Customer support</h3>
          <p className="row"><Phone size={18} color="var(--accent)" /> <a href={`tel:${site?.support_phone || ""}`}>{site?.support_phone || "…"}</a></p>
          <p className="row"><Mail size={18} color="var(--accent)" /> <a href={`mailto:${site?.support_email || ""}`}>{site?.support_email || "…"}</a></p>
          <p className="row"><Clock size={18} color="var(--accent)" /> Mon–Fri 8am–6pm, Sat 9am–1pm</p>
          <hr className="divider" />
          <p className="small muted">For damaged or lost items please see our claims procedure. Include your booking reference so we can help faster.</p>
        </aside>
      </div>
    </section>
  );
}
