import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardList, PoundSterling, Truck, AlertTriangle, Timer, RefreshCcw, MessageSquare, FileQuestion } from "lucide-react";
import { useApi } from "../../lib/hooks.js";
import { date, money, STATUS_LABELS } from "../../lib/format.js";
import BarChart from "../../components/BarChart.jsx";
import { Spinner, StatusBadge, Tabs } from "../../components/ui.jsx";

function Kpi({ icon: Icon, label, value, to }) {
  const body = (
    <div className="card kpi card-hover" style={{ height: "100%" }}>
      <div className="kpi-label"><Icon size={16} aria-hidden /> {label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
  return to ? <Link to={to} style={{ color: "inherit", textDecoration: "none" }}>{body}</Link> : body;
}

export default function Dashboard() {
  const [days, setDays] = useState("30");
  const { data, loading } = useApi("/admin/dashboard", { days });
  const navigate = useNavigate();
  if (loading && !data) return <Spinner />;
  const t = data.totals;
  const fmtDay = (d) => date(d, { day: "numeric", month: "short" });
  const statusMax = Math.max(...Object.values(data.by_status), 1);
  const serviceMax = Math.max(...Object.values(data.by_service), 1);

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>Overview</h1>
        <Tabs label="Report period" value={days} onChange={setDays} tabs={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />
      </div>

      <div className="grid-4">
        <Kpi icon={ClipboardList} label="Bookings" value={t.bookings} to="/admin/bookings" />
        <Kpi icon={PoundSterling} label="Revenue (net of refunds)" value={money(t.revenue_pence)} />
        <Kpi icon={Truck} label="Delivered" value={t.delivered} />
        <Kpi icon={Timer} label="On-time rate" value={t.on_time_rate === null ? "—" : `${t.on_time_rate}%`} />
        <Kpi icon={FileQuestion} label="Quotes to price" value={t.quotes_pending} to="/admin/bookings?status=quote_requested" />
        <Kpi icon={AlertTriangle} label="Open exceptions" value={t.exceptions_open} to="/admin/bookings?status=exception" />
        <Kpi icon={RefreshCcw} label="Change requests" value={t.change_requests_pending} to="/admin/change-requests" />
        <Kpi icon={MessageSquare} label="Open enquiries" value={t.enquiries_open} to="/admin/enquiries" />
      </div>

      <div className="grid-2">
        <div className="card">
          <BarChart title="Bookings per day" data={data.series.map((s) => ({ label: fmtDay(s.date), tooltip: date(s.date), value: s.bookings }))} labelEvery={Math.ceil(data.series.length / 6)} />
        </div>
        <div className="card">
          <BarChart title="Revenue per day" format={(v) => money(v)} data={data.series.map((s) => ({ label: fmtDay(s.date), tooltip: date(s.date), value: s.revenue_pence }))} labelEvery={Math.ceil(data.series.length / 6)} />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Delivery status (all bookings)</h3>
          {Object.keys(STATUS_LABELS).filter((s) => data.by_status[s]).map((s) => (
            <div className="hbar" key={s}>
              <span>{STATUS_LABELS[s]}</span>
              <div className="track"><div className="fill" style={{ width: `${(data.by_status[s] / statusMax) * 100}%` }} /></div>
              <span className="n">{data.by_status[s]}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Bookings by service ({days} days)</h3>
          {Object.entries(data.by_service).sort((a, b) => b[1] - a[1]).map(([name, n]) => (
            <div className="hbar" key={name}>
              <span>{name}</span>
              <div className="track"><div className="fill" style={{ width: `${(n / serviceMax) * 100}%` }} /></div>
              <span className="n">{n}</span>
            </div>
          ))}
          {Object.keys(data.by_service).length === 0 && <p className="muted small">No bookings in this period.</p>}
        </div>
      </div>

      <div>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Latest bookings</h3>
          <Link to="/admin/bookings" className="small">View all</Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Reference</th><th>Customer</th><th>Route</th><th>Service</th><th>Status</th><th className="num">Price</th></tr></thead>
            <tbody>
              {data.recent.map((b) => (
                <tr key={b.reference} className="clickable" onClick={() => navigate(`/admin/bookings/${b.reference}`)}>
                  <td className="mono">{b.reference}</td>
                  <td>{b.customer_email}</td>
                  <td>{b.collection_postcode} → {b.delivery_postcode}</td>
                  <td>{b.service.name}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td className="num">{money(b.price_pence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
