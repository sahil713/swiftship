import { useState } from "react";
import { MapPin, CheckCircle2, XCircle, Search } from "lucide-react";
import { Alert, Badge, Reveal, Spinner } from "../components/ui.jsx";
import { useApi } from "../lib/hooks.js";
import { api } from "../lib/api.js";
import { money } from "../lib/format.js";
import { usePricingEnabled } from "../lib/site.js";

const ZONE_TONE = { mainland: "good", remote: "warning", northern_ireland: "info", excluded: "muted" };
const ZONE_LABEL = { mainland: "UK mainland", remote: "Remote area", northern_ireland: "Northern Ireland", excluded: "Not served" };

export default function Areas() {
  const { data, loading } = useApi("/areas");
  const [pc, setPc] = useState("");
  const [check, setCheck] = useState(null);
  const pricing = usePricingEnabled();

  const submit = async (e) => {
    e.preventDefault();
    try {
      setCheck(await api("/postcodes/check", { params: { postcode: pc } }));
    } catch (err) {
      setCheck({ ok: false, message: err.message });
    }
  };

  return (
    <>
      <section className="page-head container">
        <div className="eyebrow">Delivery areas</div>
        <h1>Where we deliver</h1>
        <p className="lead">We collect from and deliver to addresses across England, Wales and southern Scotland. We don't provide services to or from Ireland – including Northern Ireland – the Channel Islands or the Isle of Man.</p>
        <form className="track-form" onSubmit={submit} style={{ marginTop: 24 }}>
          <label htmlFor="area-pc" className="sr-only">Postcode</label>
          <input id="area-pc" className="input" placeholder="Check a postcode, e.g. IV1 1SY" value={pc} onChange={(e) => { setPc(e.target.value); setCheck(null); }} required />
          <button className="btn btn-primary"><Search size={16} /> Check</button>
        </form>
        {check && (
          <div style={{ marginTop: 16, maxWidth: 560 }}>
            <Alert type={!check.ok ? "error" : check.review ? "warning" : "success"}>
              {check.message}
              {pricing && check.ok && check.surcharge_pence > 0 && ` An area surcharge of ${money(check.surcharge_pence)} applies.`}
              {check.ok && !check.review && check.extra_transit_days > 0 && ` Allow ${check.extra_transit_days} extra working day(s).`}
            </Alert>
          </div>
        )}
      </section>
      <section className="container" style={{ paddingBottom: 64 }}>
        {loading ? <Spinner /> : (
          <div className="grid-3">
            {data.areas.map((a, i) => {
              const niOff = a.zone === "northern_ireland" && !data.northern_ireland_enabled;
              const served = a.serviced && !niOff;
              return (
                <Reveal key={a.id} delay={(i % 3) * 0.06}>
                  <article className="card" style={{ height: "100%", opacity: served ? 1 : 0.75 }}>
                    <div className="row-between" style={{ marginBottom: 10 }}>
                      <h3 style={{ margin: 0 }}><MapPin size={18} style={{ display: "inline", verticalAlign: -3, color: "var(--accent)" }} /> {a.name}</h3>
                      {served ? <CheckCircle2 size={20} color="var(--good)" aria-label="Served" /> : <XCircle size={20} color="var(--text-muted)" aria-label="Not served" />}
                    </div>
                    <div className="row" style={{ marginBottom: 12 }}>
                      <Badge tone={ZONE_TONE[a.zone]}>{niOff ? "Not served" : ZONE_LABEL[a.zone]}</Badge>
                      {pricing && a.surcharge_pence > 0 && <Badge tone="neutral" plain>+{money(a.surcharge_pence)}</Badge>}
                      {a.extra_transit_days > 0 && <Badge tone="neutral" plain>+{a.extra_transit_days} day{a.extra_transit_days > 1 ? "s" : ""}</Badge>}
                    </div>
                    <p className="small mono muted" style={{ marginBottom: 8 }}>{a.postcode_areas.join(" · ")}</p>
                    {a.notes && <p className="small muted" style={{ margin: 0 }}>{a.notes}</p>}
                  </article>
                </Reveal>
              );
            })}
          </div>
        )}
        {data?.rules?.length > 0 && (
          <Reveal>
            <h2 style={{ marginTop: 56 }}>Areas we don't normally serve</h2>
            <p className="muted">You can still send us a request for these areas – our team will review it and let you know whether we can help.</p>
            <div className="grid-2">
              {[["outside", "Not normally served", "serious"], ["restricted", "Served only occasionally", "warning"]].map(([level, title, tone]) => {
                const rules = data.rules.filter((r) => r.level === level);
                if (!rules.length) return null;
                return (
                  <div key={level} className="card">
                    <h3><Badge tone={tone}>{title}</Badge></h3>
                    <ul className="check-list" style={{ margin: 0 }}>
                      {rules.map((r) => <li key={r.id}><strong className="mono" style={{ minWidth: 28 }}>{r.postcode_area}</strong> <span>{r.note}</span></li>)}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>In Scotland we don't normally serve locations further north than Glasgow. Every other UK postcode is part of our normal service area.</p>
          </Reveal>
        )}
      </section>
    </>
  );
}
