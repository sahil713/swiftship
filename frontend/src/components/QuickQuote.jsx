import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Calculator, ClipboardList } from "lucide-react";
import { api } from "../lib/api.js";
import { money, date } from "../lib/format.js";
import { Alert } from "./ui.jsx";
import { usePricingEnabled } from "../lib/site.js";

export default function QuickQuote({ services }) {
  const [form, setForm] = useState({ service_id: "", collection_postcode: "", delivery_postcode: "", weight_kg: "" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const pricing = usePricingEnabled();
  const navigate = useNavigate();

  useEffect(() => {
    if (!form.service_id && services.length) setForm((f) => ({ ...f, service_id: String(services[0].id) }));
  }, [services, form.service_id]);

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    setResult(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    // Phase 1: no online prices – hand the details to the full request form instead.
    if (!pricing) return navigate(`/quote?${new URLSearchParams(form)}`);
    setLoading(true);
    try {
      setResult(await api("/quotes", { method: "POST", body: form }));
    } catch (err) {
      setResult({ ok: false, errors: [err.message] });
    } finally {
      setLoading(false);
    }
  };

  const continueUrl = `/quote?${new URLSearchParams(form)}`;

  return (
    <motion.div className="quote-card" initial={{ opacity: 0, y: 40, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.9, delay: 0.5, ease: [0.2, 0.8, 0.2, 1] }}>
      <div className="row" style={{ gap: 10, marginBottom: 14 }}>
        <span className="brand-mark" style={{ width: 38, height: 38 }}>{pricing ? <Calculator size={18} /> : <ClipboardList size={18} />}</span>
        <div>
          <h2>{pricing ? "Instant price estimate" : "Request a quote"}</h2>
          <p className="small muted" style={{ margin: 0 }}>{pricing ? "UK-wide. No sign-up needed." : "UK-wide. We'll call you to discuss your quotation."}</p>
        </div>
      </div>
      <form onSubmit={submit} className="stack" style={{ "--gap": "12px" }}>
        <div className="field">
          <label htmlFor="qq-service">Service</label>
          <select id="qq-service" className="select" value={form.service_id} onChange={set("service_id")}>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.transit_time}</option>)}
          </select>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))", gap: 12 }}>
          <div className="field">
            <label htmlFor="qq-from">From postcode</label>
            <input id="qq-from" className="input" placeholder="SW1A 1AA" value={form.collection_postcode} onChange={set("collection_postcode")} autoComplete="postal-code" required />
          </div>
          <div className="field">
            <label htmlFor="qq-to">To postcode</label>
            <input id="qq-to" className="input" placeholder="M1 1AE" value={form.delivery_postcode} onChange={set("delivery_postcode")} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="qq-weight">Weight (kg) <span className="muted small">optional</span></label>
          <input id="qq-weight" className="input" type="number" min="0.1" step="0.1" inputMode="decimal" placeholder="e.g. 5" value={form.weight_kg} onChange={set("weight_kg")} />
        </div>
        <button className="btn btn-primary btn-block btn-lg" disabled={loading}>
          {loading ? "Calculating…" : pricing ? "Get my price" : "Continue"} <ArrowRight size={18} />
        </button>
      </form>
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
            {result.ok ? (
              <div className="quote-result" aria-live="polite">
                <div className="row-between">
                  <div>
                    <div className="small muted">Estimated price</div>
                    <div className="price">{money(result.total_pence)}</div>
                  </div>
                  <div className="small" style={{ textAlign: "right" }}>
                    <div className="muted">Est. delivery</div>
                    <strong>{date(result.estimated_delivery_date, { weekday: "short", day: "numeric", month: "short" })}</strong>
                  </div>
                </div>
                {result.warnings?.length > 0 && <p className="small muted" style={{ margin: "8px 0 0" }}>{result.warnings[0]}</p>}
                <Link to={continueUrl} className="btn btn-secondary btn-block" style={{ marginTop: 12 }}>Continue to booking <ArrowRight size={16} /></Link>
              </div>
            ) : (
              <div style={{ marginTop: 16 }}><Alert type="error">{result.errors.join(" ")}</Alert></div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
