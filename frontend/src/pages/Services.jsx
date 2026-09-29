import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { Reveal, Spinner } from "../components/ui.jsx";
import { useApi } from "../lib/hooks.js";
import { money } from "../lib/format.js";
import { serviceIcon } from "../lib/serviceIcons.js";

export default function Services() {
  const services = useApi("/services");
  const surcharges = useApi("/surcharges");
  return (
    <>
      <section className="page-head container">
        <div className="eyebrow">Services</div>
        <h1>Delivery services & pricing</h1>
        <p className="lead">Every price starts with a service, then adds weight above the included allowance and any applicable surcharges. You'll always see the confirmed price before you pay.</p>
      </section>
      <section className="container" style={{ paddingBottom: 64 }}>
        {services.loading ? <Spinner /> : (
          <div className="grid-2">
            {(services.data || []).map((s, i) => {
              const Icon = serviceIcon(s.slug);
              return (
                <Reveal key={s.id} delay={(i % 2) * 0.08}>
                  <article className="card service-card" id={s.slug}>
                    <div className="row-between">
                      <div className="ico"><Icon size={24} /></div>
                      <span className="badge tone-accent plain">{s.transit_time}</span>
                    </div>
                    <h2 style={{ fontSize: "1.5rem" }}>{s.name}</h2>
                    <p className="muted">{s.description}</p>
                    <ul className="check-list">
                      <li><CheckCircle2 size={18} /> {s.included_kg} kg included, then {money(s.price_per_kg_pence)}/kg</li>
                      {s.max_weight_kg && <li><CheckCircle2 size={18} /> Up to {Number(s.max_weight_kg)} kg per item</li>}
                      {s.cutoff_hour && <li><CheckCircle2 size={18} /> Book by {s.cutoff_hour}:00 {s.slug === "same-day" ? "for collection today" : "for next-day dispatch"}</li>}
                      <li><CheckCircle2 size={18} /> Live tracking & email/SMS updates</li>
                    </ul>
                    {s.restrictions && <p className="small muted"><AlertTriangle size={14} style={{ display: "inline", verticalAlign: -2 }} /> {s.restrictions}</p>}
                    <div className="price-from">
                      <span><span className="small muted">from </span><strong>{money(s.base_price_pence)}</strong></span>
                      <Link to={`/quote?service_id=${s.id}`} className="btn btn-primary btn-sm">Get a quote <ArrowRight size={16} /></Link>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        )}

        <Reveal>
          <h2 style={{ marginTop: 64 }}>Additional charges</h2>
          <p className="muted">These are added automatically when they apply, and shown line by line in your quote.</p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Charge</th><th>When it applies</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {(surcharges.data || []).map((s) => (
                  <tr key={s.id}><td><strong>{s.name}</strong></td><td className="muted">{s.description}</td><td className="num">{s.kind === "percent" ? `${s.amount}%` : money(s.amount)}</td></tr>
                ))}
                <tr><td><strong>Remote area</strong></td><td className="muted">Scottish Highlands & Islands (per end of the journey)</td><td className="num">See <Link to="/areas">areas</Link></td></tr>
                <tr><td><strong>Northern Ireland</strong></td><td className="muted">Collections or deliveries in BT postcodes (ferry crossing)</td><td className="num">See <Link to="/areas">areas</Link></td></tr>
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>Chargeable weight is the greater of the actual weight and the volumetric weight (L × W × H in cm ÷ 5000). Quotes based on incomplete or inaccurate item details may change.</p>
        </Reveal>
      </section>
    </>
  );
}
