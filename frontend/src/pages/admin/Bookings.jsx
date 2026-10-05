import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useApi } from "../../lib/hooks.js";
import { date, money, STATUS_LABELS, humanize } from "../../lib/format.js";
import { Empty, Pagination, Spinner, StatusBadge, Badge } from "../../components/ui.jsx";

export default function Bookings() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(params.get("q") || "");
  const filters = {
    q: params.get("q") || "", status: params.get("status") || "", service_id: params.get("service_id") || "",
    payment_status: params.get("payment_status") || "", area_review: params.get("area_review") || "", page: params.get("page") || 1,
  };
  const { data, loading } = useApi("/admin/bookings", filters);
  const services = useApi("/services").data || [];

  const update = (k, v) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    if (k !== "page") next.delete("page");
    setParams(next);
  };

  useEffect(() => {
    const t = setTimeout(() => q !== filters.q && update("q", q), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Bookings</h1>
      <div className="toolbar" role="search">
        <div style={{ position: "relative", flex: "2 1 260px" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }} aria-hidden />
          <label htmlFor="bk-q" className="sr-only">Search bookings</label>
          <input id="bk-q" className="input" style={{ paddingLeft: 36, width: "100%" }} placeholder="Reference, tracking no., email, name, postcode, city…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="sr-only" htmlFor="bk-status">Status</label>
        <select id="bk-status" className="select" value={filters.status} onChange={(e) => update("status", e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="sr-only" htmlFor="bk-service">Service</label>
        <select id="bk-service" className="select" value={filters.service_id} onChange={(e) => update("service_id", e.target.value)}>
          <option value="">All services</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="bk-area">Service area</label>
        <select id="bk-area" className="select" value={filters.area_review} onChange={(e) => update("area_review", e.target.value)}>
          <option value="">All locations</option>
          <option value="1">Needs area review</option>
        </select>
        <label className="sr-only" htmlFor="bk-pay">Payment</label>
        <select id="bk-pay" className="select" value={filters.payment_status} onChange={(e) => update("payment_status", e.target.value)}>
          <option value="">Any payment</option>
          {["unpaid", "paid", "partially_refunded", "refunded"].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
      </div>
      {loading && !data ? <Spinner /> : data.bookings.length === 0 ? (
        <div className="card"><Empty title="No bookings match these filters" /></div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Reference</th><th>Customer</th><th>Route</th><th>Service</th><th>Collection</th><th>Driver</th><th>Status</th><th>Payment</th><th className="num">Price</th></tr></thead>
              <tbody>
                {data.bookings.map((b) => (
                  <tr key={b.reference} className="clickable" onClick={() => navigate(`/admin/bookings/${b.reference}`)}>
                    <td><Link to={`/admin/bookings/${b.reference}`} className="mono" onClick={(e) => e.stopPropagation()}>{b.reference}</Link><div className="small muted mono">{b.tracking_number}</div></td>
                    <td>{b.customer_email}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{b.collection_postcode} → {b.delivery_postcode}<div className="small muted">{b.collection_city} → {b.delivery_city}</div></td>
                    <td>{b.service.name}</td>
                    <td>{date(b.collection_date)}</td>
                    <td>{b.driver?.name || <span className="muted">—</span>}</td>
                    <td><StatusBadge status={b.status} />{b.area_review && <div style={{ marginTop: 4 }}><Badge tone="warning">Area review</Badge></div>}</td>
                    <td><Badge tone={b.payment_status === "paid" ? "good" : b.payment_status === "unpaid" ? "neutral" : "warning"} plain>{humanize(b.payment_status)}</Badge></td>
                    <td className="num">{money(b.price_pence)}{!b.confirmed_price_pence && <div className="small muted">est.</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} onPage={(p) => update("page", p)} />
        </>
      )}
    </div>
  );
}
