import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { PAYMENT_STATUS_LABELS } from "../../lib/format.js";
import { Alert, Field } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";

const today = () => new Date().toISOString().slice(0, 10);
const BLANK = {
  customer_name: "", customer_email: "", customer_phone: "", service_id: "",
  collection_contact_name: "", collection_phone: "", collection_email: "", collection_line1: "", collection_line2: "", collection_city: "", collection_postcode: "",
  delivery_contact_name: "", delivery_phone: "", delivery_email: "", delivery_line1: "", delivery_line2: "", delivery_city: "", delivery_postcode: "",
  collection_date: "", collection_time: "", item_description: "", quantity: 1, weight_kg: "", length_cm: "", width_cm: "", height_cm: "", fragile: false,
  collection_instructions: "", delivery_instructions: "", special_requirements: "", agreed_price: "", status: "quote_requested", payment_status: "",
};

/** Office creates a booking, e.g. one taken over the phone. Uses the same booking record and rules as the website. */
export default function NewBooking() {
  const navigate = useNavigate();
  const toast = useToast();
  const services = useApi("/services").data || [];
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const input = (k, label, props = {}) => (
    <Field label={label} htmlFor={`nb-${k}`} hint={props.hint} className={props.wide ? "span-all" : ""}>
      {props.textarea
        ? <textarea id={`nb-${k}`} className="textarea" rows={2} value={form[k]} onChange={set(k)} />
        : <input id={`nb-${k}`} className="input" type={props.type || "text"} value={form[k]} onChange={set(k)} required={props.required} {...(props.extra || {})} />}
    </Field>
  );

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { booking: { ...form, service_id: form.service_id || services[0]?.id, payment_status: form.payment_status || undefined } };
      const res = await api("/admin/bookings", { method: "POST", body });
      toast(`Booking ${res.booking.reference} created`);
      navigate(`/admin/bookings/${res.booking.reference}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="stack" style={{ maxWidth: 980 }} onSubmit={submit}>
      <Link to="/admin/bookings" className="small row" style={{ gap: 4 }}><ArrowLeft size={14} /> Bookings</Link>
      <div>
        <h1 style={{ marginBottom: 4 }}>New booking</h1>
        <p className="muted" style={{ margin: 0 }}>For bookings taken by phone or email. Postcodes follow the normal service-area rules.</p>
      </div>
      {error && <Alert type="error">{error}</Alert>}

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Customer</h3>
        <div className="form-grid">
          {input("customer_name", "Customer name", { required: true })}
          {input("customer_email", "Email", { type: "email", required: true })}
          {input("customer_phone", "Phone", { type: "tel", required: true })}
        </div>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Service & date</h3>
        <div className="form-grid">
          <Field label="Service" htmlFor="nb-service_id">
            <select id="nb-service_id" className="select" value={form.service_id || services[0]?.id || ""} onChange={set("service_id")}>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          {input("collection_date", "Collection date", { type: "date", extra: { min: today() } })}
          {input("collection_time", "Collection time", { type: "time" })}
        </div>
      </section>

      <div className="grid-2">
        <section className="card stack">
          <h3 style={{ margin: 0 }}>Collection address</h3>
          <div className="form-grid">
            {input("collection_line1", "Address line 1", { required: true, wide: true })}
            {input("collection_line2", "Address line 2", { wide: true })}
            {input("collection_city", "Town / city", { required: true })}
            {input("collection_postcode", "Postcode", { required: true, extra: { autoCapitalize: "characters" } })}
            {input("collection_contact_name", "Contact name", { hint: "Leave blank to use the customer" })}
            {input("collection_phone", "Contact phone", { type: "tel", hint: "Leave blank to use the customer's" })}
            {input("collection_instructions", "Access information", { textarea: true, wide: true })}
          </div>
        </section>
        <section className="card stack">
          <h3 style={{ margin: 0 }}>Delivery address</h3>
          <div className="form-grid">
            {input("delivery_line1", "Address line 1", { required: true, wide: true })}
            {input("delivery_line2", "Address line 2", { wide: true })}
            {input("delivery_city", "Town / city", { required: true })}
            {input("delivery_postcode", "Postcode", { required: true, extra: { autoCapitalize: "characters" } })}
            {input("delivery_contact_name", "Recipient name", { required: true })}
            {input("delivery_phone", "Recipient phone", { type: "tel", required: true })}
            {input("delivery_email", "Recipient email", { type: "email", required: true, wide: true })}
            {input("delivery_instructions", "Access information", { textarea: true, wide: true })}
          </div>
        </section>
      </div>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Items</h3>
        <div className="form-grid">
          {input("item_description", "What's being moved", { required: true, wide: true })}
          {input("quantity", "Quantity", { type: "number", required: true, extra: { min: 1 } })}
          {input("weight_kg", "Weight per item (kg)", { type: "number", extra: { step: "0.1", min: "0" } })}
          {input("length_cm", "Length (cm)", { type: "number" })}
          {input("width_cm", "Width (cm)", { type: "number" })}
          {input("height_cm", "Height (cm)", { type: "number" })}
          <label className="checkbox span-all"><input type="checkbox" checked={form.fragile} onChange={set("fragile")} /> Fragile</label>
          {input("special_requirements", "Special requirements / notes", { textarea: true, wide: true })}
        </div>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Status & payment</h3>
        <div className="form-grid">
          {input("agreed_price", "Agreed price (£, optional)", { type: "number", extra: { step: "0.01", min: "0" } })}
          <Field label="Booking status" htmlFor="nb-status">
            <select id="nb-status" className="select" value={form.status} onChange={set("status")}>
              <option value="quote_requested">Quote requested (price not agreed yet)</option>
              <option value="booked">Booked (confirmed)</option>
            </select>
          </Field>
          <Field label="Payment status" htmlFor="nb-payment_status" hint={form.status === "booked" ? "Booked bookings are Paid unless you choose otherwise" : "Pending until paid"}>
            <select id="nb-payment_status" className="select" value={form.payment_status} onChange={set("payment_status")}>
              <option value="">Automatic</option>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <div><button className="btn btn-primary btn-lg" disabled={busy}><Save size={18} /> {busy ? "Saving…" : "Create booking"}</button></div>
    </form>
  );
}
