import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, MapPin, PhoneCall, Send } from "lucide-react";
import { api } from "../lib/api.js";
import { useApi } from "../lib/hooks.js";
import { date } from "../lib/format.js";
import { serviceIcon } from "../lib/serviceIcons.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Alert, Field } from "../components/ui.jsx";
import { BRAND } from "../lib/brand.js";

const STEPS = ["Route & service", "Your item", "Addresses", "Review"];
const today = () => new Date().toISOString().slice(0, 10);

const INITIAL = {
  service_id: "", collection_postcode: "", delivery_postcode: "", collection_date: "",
  item_description: "", quantity: 1, weight_kg: "", length_cm: "", width_cm: "", height_cm: "", fragile: false,
  collection_contact_name: "", collection_phone: "", collection_email: "", collection_line1: "", collection_line2: "", collection_city: "",
  delivery_contact_name: "", delivery_phone: "", delivery_email: "", delivery_line1: "", delivery_line2: "", delivery_city: "",
  collection_instructions: "", delivery_instructions: "", special_requirements: "",
};

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Postcode input that checks the service area as the user types. */
function PostcodeField({ id, label, value, onChange, onResult }) {
  const debounced = useDebounced(value, 450);
  const [check, setCheck] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (debounced.replace(/\s/g, "").length < 5) {
      setCheck(null);
      onResult?.(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api("/postcodes/check", { params: { postcode: debounced } })
      .then((r) => !cancelled && (setCheck(r), onResult?.(r)))
      .catch(() => !cancelled && setCheck(null))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const state = check ? (!check.ok ? "invalid" : check.review ? "review" : "valid") : "";
  const msgClass = check ? (!check.ok ? "error-text" : check.review ? "warn-text" : "ok-text") : "hint";
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div style={{ position: "relative" }}>
        <input id={id} className={`input ${state}`} value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} placeholder="e.g. SW1A 1AA" autoComplete="postal-code" aria-invalid={check && !check.ok} aria-describedby={`${id}-msg`} required />
        {loading && <Loader2 size={18} className="spin-icon" style={{ position: "absolute", right: 12, top: 14, animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />}
      </div>
      <span id={`${id}-msg`} className={msgClass} aria-live="polite">
        {!check ? "UK postcodes only"
          : !check.ok ? check.message
          : check.review ? `⚠ ${check.message}`
          : `✓ ${check.region}${check.district ? ` · ${check.district}` : ""}`}
      </span>
    </div>
  );
}

function AddressBlock({ prefix, title, form, set, saved, onPick, checkResult }) {
  return (
    <fieldset className="card">
      <legend style={{ display: "contents" }}><h3>{title}</h3></legend>
      <div className="row" style={{ marginBottom: 12 }}>
        <MapPin size={16} color="var(--accent)" />
        <span className="small"><strong className="mono">{form[`${prefix}_postcode`]}</strong>{checkResult?.district ? ` · ${checkResult.district}` : ""}</span>
      </div>
      {saved?.length > 0 && (
        <Field label="Use a saved address" htmlFor={`${prefix}-saved`}>
          <select id={`${prefix}-saved`} className="select" defaultValue="" onChange={(e) => onPick(prefix, saved.find((a) => String(a.id) === e.target.value))}>
            <option value="">Choose…</option>
            {saved.map((a) => <option key={a.id} value={a.id}>{a.label || a.line1}, {a.postcode}</option>)}
          </select>
        </Field>
      )}
      <div className="form-grid" style={{ marginTop: 12 }}>
        <Field label="Contact name" htmlFor={`${prefix}-name`}><input id={`${prefix}-name`} className="input" value={form[`${prefix}_contact_name`]} onChange={set(`${prefix}_contact_name`)} required autoComplete="name" /></Field>
        <Field label="Phone" htmlFor={`${prefix}-phone`}><input id={`${prefix}-phone`} type="tel" className="input" value={form[`${prefix}_phone`]} onChange={set(`${prefix}_phone`)} required pattern="[+]?[0-9 \(\)\-]{10,20}" title="A UK phone number" autoComplete="tel" /></Field>
        <Field label="Email" htmlFor={`${prefix}-email`} className="span-all"><input id={`${prefix}-email`} type="email" className="input" value={form[`${prefix}_email`]} onChange={set(`${prefix}_email`)} required autoComplete="email" /></Field>
        <Field label="Address line 1" htmlFor={`${prefix}-l1`} className="span-all"><input id={`${prefix}-l1`} className="input" value={form[`${prefix}_line1`]} onChange={set(`${prefix}_line1`)} required autoComplete="address-line1" /></Field>
        <Field label="Address line 2 (optional)" htmlFor={`${prefix}-l2`}><input id={`${prefix}-l2`} className="input" value={form[`${prefix}_line2`]} onChange={set(`${prefix}_line2`)} autoComplete="address-line2" /></Field>
        <Field label="Town / city" htmlFor={`${prefix}-city`}><input id={`${prefix}-city`} className="input" value={form[`${prefix}_city`]} onChange={set(`${prefix}_city`)} required autoComplete="address-level2" /></Field>
        <Field label={`Access information at ${prefix === "collection" ? "collection" : "delivery"} (optional)`} htmlFor={`${prefix}-instr`} className="span-all" hint="Stairs or lifts, floor number, parking, gate codes, opening hours, safe place, etc.">
          <textarea id={`${prefix}-instr`} className="textarea" rows={2} value={form[`${prefix}_instructions`]} onChange={set(`${prefix}_instructions`)} />
        </Field>
      </div>
    </fieldset>
  );
}

export default function Quote() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const services = useApi("/services").data || [];
  const saved = useApi(user?.role === "customer" ? "/addresses" : null).data;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => {
    const f = { ...INITIAL };
    for (const k of ["service_id", "collection_postcode", "delivery_postcode", "weight_kg"]) if (params.get(k)) f[k] = params.get(k);
    return f;
  });
  const [checks, setChecks] = useState({ collection: null, delivery: null });
  const [submitted, setSubmitted] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const topRef = useRef(null);

  useEffect(() => {
    if (!form.service_id && services.length) setForm((f) => ({ ...f, service_id: String(services[0].id) }));
  }, [services, form.service_id]);

  // Prefill the sender's details for signed-in customers.
  useEffect(() => {
    if (user?.role === "customer") {
      setForm((f) => ({
        ...f,
        collection_contact_name: f.collection_contact_name || user.name,
        collection_email: f.collection_email || user.email,
        collection_phone: f.collection_phone || user.phone || "",
      }));
    }
  }, [user]);

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const selectedService = services.find((s) => String(s.id) === String(form.service_id));

  const pickAddress = (prefix, a) => {
    if (!a) return;
    setForm((f) => ({
      ...f,
      [`${prefix}_line1`]: a.line1, [`${prefix}_line2`]: a.line2 || "", [`${prefix}_city`]: a.city, [`${prefix}_postcode`]: a.postcode,
      [`${prefix}_contact_name`]: a.contact_name || f[`${prefix}_contact_name`], [`${prefix}_phone`]: a.phone || f[`${prefix}_phone`],
    }));
  };

  const canContinue = [
    checks.collection?.ok && checks.delivery?.ok && form.service_id,
    form.item_description.trim() && form.quantity >= 1,
    true,
    agreed,
  ][step];

  const go = (delta) => (e) => {
    e?.preventDefault();
    setStep((s) => Math.min(Math.max(s + delta, 0), STEPS.length - 1));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api("/bookings", { method: "POST", body: { booking: form } });
      setSubmitted(res.booking);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  };

  const onStepSubmit = step === STEPS.length - 1 ? submit : go(1);

  if (submitted) return <Submitted booking={submitted} signedIn={user?.role === "customer"} />;

  return (
    <section className="container" style={{ paddingBottom: 72 }} ref={topRef}>
      <div className="page-head" style={{ paddingInline: 0 }}>
        <div className="eyebrow">Get a quote</div>
        <h1>Request a quote</h1>
        <p className="lead">Tell us about your shipment and our team will call you to discuss your quotation. {user ? "" : <>Booking as a guest — <Link to="/login" state={{ from: "/quote" }}>sign in</Link> to use saved addresses.</>}</p>
      </div>

      <ol className="steps" aria-label="Booking progress">
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? "done" : i === step ? "current" : ""} aria-current={i === step ? "step" : undefined}>
            <div className="bar"><span style={{ width: i <= step ? "100%" : "0%" }} /></div>
            <span className="name">{i + 1}. {s}</span>
          </li>
        ))}
      </ol>

      <div style={{ maxWidth: 820 }}>
        <form onSubmit={onStepSubmit} noValidate={false}>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }} className="stack">
              {step === 0 && (
                <>
                  <div className="card">
                    <h3>Where is it going?</h3>
                    <div className="form-grid">
                      <PostcodeField id="collection_postcode" label="Collection postcode" value={form.collection_postcode} onChange={(v) => setForm((f) => ({ ...f, collection_postcode: v }))} onResult={(r) => setChecks((c) => ({ ...c, collection: r }))} />
                      <PostcodeField id="delivery_postcode" label="Delivery postcode" value={form.delivery_postcode} onChange={(v) => setForm((f) => ({ ...f, delivery_postcode: v }))} onResult={(r) => setChecks((c) => ({ ...c, delivery: r }))} />
                      <Field label="Preferred collection date" htmlFor="collection_date" hint="The date that suits you best – we'll confirm when we call">
                        <input id="collection_date" type="date" className="input" min={today()} value={form.collection_date} onChange={set("collection_date")} required />
                      </Field>
                    </div>
                  </div>
                  <fieldset className="card">
                    <legend style={{ display: "contents" }}><h3>Choose a service</h3></legend>
                    <div className="option-grid">
                      {services.map((s) => {
                        const Icon = serviceIcon(s.slug);
                        return (
                          <label key={s.id} className="option">
                            <input type="radio" name="service" value={s.id} checked={String(form.service_id) === String(s.id)} onChange={set("service_id")} />
                            <div className="opt-title"><span><Icon size={18} style={{ display: "inline", verticalAlign: -3, color: "var(--accent)" }} /> {s.name}</span></div>
                            <div className="small muted">{s.transit_time}</div>
                            <div className="small" style={{ marginTop: 6, color: "var(--text-2)" }}>{s.tagline}</div>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </>
              )}

              {step === 1 && (
                <div className="card">
                  <h3>Tell us about your item</h3>
                  <p className="small muted">The more detail you give, the more accurate our quotation will be. Weight and size are optional.</p>
                  <div className="form-grid">
                    <Field label="What are you sending?" htmlFor="item_description" className="span-all" hint="e.g. Box of books, 42-inch TV, wooden chair">
                      <input id="item_description" className="input" value={form.item_description} onChange={set("item_description")} required maxLength={200} />
                    </Field>
                    <Field label="Quantity" htmlFor="quantity"><input id="quantity" type="number" min={1} max={100} className="input" value={form.quantity} onChange={set("quantity")} required /></Field>
                    <Field label="Weight per item (kg)" htmlFor="weight_kg"><input id="weight_kg" type="number" min="0.1" step="0.1" inputMode="decimal" className="input" value={form.weight_kg} onChange={set("weight_kg")} /></Field>
                    <Field label="Length (cm)" htmlFor="length_cm"><input id="length_cm" type="number" min="1" className="input" value={form.length_cm} onChange={set("length_cm")} /></Field>
                    <Field label="Width (cm)" htmlFor="width_cm"><input id="width_cm" type="number" min="1" className="input" value={form.width_cm} onChange={set("width_cm")} /></Field>
                    <Field label="Height (cm)" htmlFor="height_cm"><input id="height_cm" type="number" min="1" className="input" value={form.height_cm} onChange={set("height_cm")} /></Field>
                    <label className="checkbox span-all">
                      <input type="checkbox" checked={form.fragile} onChange={set("fragile")} />
                      <span><strong>This item is fragile</strong><br /><span className="small muted">Extra handling care. Glass, ceramics, electronics, artwork.</span></span>
                    </label>
                    <Field label="Special requirements (optional)" htmlFor="special_requirements" className="span-all" hint="e.g. two-person lift, dismantling, packaging needed, time windows, insurance value">
                      <textarea id="special_requirements" className="textarea" rows={3} maxLength={2000} value={form.special_requirements} onChange={set("special_requirements")} />
                    </Field>
                  </div>
                  <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>Please check our <Link to="/legal/prohibited-items" target="_blank">prohibited items</Link> list before booking.</p>
                </div>
              )}

              {step === 2 && (
                <>
                  <AddressBlock prefix="collection" title="Collect from" form={form} set={set} saved={saved} onPick={pickAddress} checkResult={checks.collection} />
                  <AddressBlock prefix="delivery" title="Deliver to" form={form} set={set} saved={saved} onPick={pickAddress} checkResult={checks.delivery} />
                </>
              )}

              {step === 3 && (
                <div className="card">
                  <h3>Review your booking</h3>
                  <div className="grid-2" style={{ gap: 16 }}>
                    <div>
                      <div className="small muted">Collect from</div>
                      <p style={{ fontWeight: 600 }}>{form.collection_contact_name}<br />{form.collection_line1}{form.collection_line2 && `, ${form.collection_line2}`}<br />{form.collection_city} {form.collection_postcode}<br /><span className="small muted">{form.collection_phone} · {form.collection_email}</span></p>
                    </div>
                    <div>
                      <div className="small muted">Deliver to</div>
                      <p style={{ fontWeight: 600 }}>{form.delivery_contact_name}<br />{form.delivery_line1}{form.delivery_line2 && `, ${form.delivery_line2}`}<br />{form.delivery_city} {form.delivery_postcode}<br /><span className="small muted">{form.delivery_phone} · {form.delivery_email}</span></p>
                    </div>
                  </div>
                  <dl className="dl">
                    <dt>Service</dt><dd>{selectedService?.name}</dd>
                    <dt>Item</dt><dd>{form.quantity} × {form.item_description}{form.fragile ? " (fragile)" : ""}</dd>
                    <dt>Weight / size</dt><dd>{form.weight_kg ? `${form.weight_kg} kg` : "Not given"}{form.length_cm && form.width_cm && form.height_cm ? ` · ${form.length_cm}×${form.width_cm}×${form.height_cm} cm` : ""}</dd>
                    <dt>Collection</dt><dd>{date(form.collection_date, { weekday: "long", day: "numeric", month: "long" })}</dd>
                    {form.special_requirements && <><dt>Special requirements</dt><dd style={{ whiteSpace: "pre-wrap" }}>{form.special_requirements}</dd></>}
                  </dl>
                  <hr className="divider" />
                  {(checks.collection?.review || checks.delivery?.review) && (
                    <div style={{ marginBottom: 12 }}>
                      <Alert type="warning" title="Outside our normal service area">
                        {[checks.collection?.review && `Collection (${checks.collection.postcode})`, checks.delivery?.review && `Delivery (${checks.delivery.postcode})`].filter(Boolean).join(" and ")} {checks.collection?.review && checks.delivery?.review ? "are" : "is"} in an area we don't normally serve. You can still send your request – our team will check whether we can take the job and call you.
                      </Alert>
                    </div>
                  )}
                  <Alert type="info" title="What happens next">
                    Our team will review your request and call you on {form.collection_phone || "the number you gave"} to discuss your quotation. Nothing is booked or charged until you've agreed a price with us.
                  </Alert>
                  <label className="checkbox" style={{ marginTop: 16 }}>
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required />
                    <span>I confirm my item isn't on the <Link to="/legal/prohibited-items" target="_blank">prohibited list</Link> and I agree to the <Link to="/legal/terms" target="_blank">terms of service</Link>.</span>
                  </label>
                  {submitError && <div style={{ marginTop: 16 }}><Alert type="error">{submitError}</Alert></div>}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="row-between" style={{ marginTop: 20 }}>
            {step > 0 ? <button type="button" className="btn btn-ghost" onClick={go(-1)}><ArrowLeft size={16} /> Back</button> : <span />}
            {step < STEPS.length - 1 ? (
              <button className="btn btn-primary btn-lg" disabled={!canContinue}>Continue <ArrowRight size={18} /></button>
            ) : (
              <button className="btn btn-primary btn-lg" disabled={!canContinue || submitting}>
                {submitting ? "Sending…" : <>Submit request <Send size={18} /></>}
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

/** Shown after a request is submitted – deliberately no price (phase 1). */
function Submitted({ booking, signedIn }) {
  return (
    <section className="container" style={{ padding: "64px 16px 96px", maxWidth: 720 }}>
      <motion.div className="card center" initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }} role="status" aria-live="polite">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 16 }}
          style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--good-soft)", color: "var(--good)", display: "grid", placeItems: "center", margin: "8px auto 20px" }}>
          <CheckCircle2 size={38} />
        </motion.div>
        <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)" }}>Thank you, we have received your request</h1>
        <p className="lead" style={{ margin: "0 auto 8px" }}>Our team will contact you shortly to discuss your quotation.</p>
        <p className="small muted" style={{ margin: "0 auto 24px" }}>— The {BRAND.name} team · {BRAND.poweredBy}</p>
        <dl className="dl" style={{ maxWidth: 380, margin: "0 auto 24px", textAlign: "left" }}>
          <dt>Request reference</dt><dd className="mono">{booking.reference}</dd>
          <dt>Route</dt><dd>{booking.collection_postcode} → {booking.delivery_postcode}</dd>
          <dt>We'll call</dt><dd>{booking.collection_phone}</dd>
        </dl>
        <p className="small muted" style={{ marginBottom: 24 }}>
          <PhoneCall size={14} style={{ display: "inline", verticalAlign: -2 }} /> Please keep your reference handy. If anything changes, <Link to="/contact">contact us</Link> quoting {booking.reference}.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link to="/" className="btn btn-secondary">Back to home</Link>
          {signedIn && <Link to="/account" className="btn btn-primary">View my requests</Link>}
        </div>
      </motion.div>
    </section>
  );
}
