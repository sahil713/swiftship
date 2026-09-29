import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { date, money } from "../../lib/format.js";
import { Badge, Empty, Pagination, Spinner, StatusBadge } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";

export default function Customers() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading } = useApi("/admin/customers", { q, page });
  const navigate = useNavigate();
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Customers</h1>
      <div className="toolbar" role="search">
        <div style={{ position: "relative", flex: "1 1 260px" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }} aria-hidden />
          <input className="input" aria-label="Search customers" style={{ paddingLeft: 36, width: "100%" }} placeholder="Name, email or phone" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>
      {loading && !data ? <Spinner /> : data.customers.length === 0 ? <div className="card"><Empty title="No customers found" /></div> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th className="num">Bookings</th><th>Joined</th><th>Status</th></tr></thead>
              <tbody>
                {data.customers.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                    <td><Link to={`/admin/customers/${c.id}`} onClick={(e) => e.stopPropagation()}>{c.name}</Link></td>
                    <td>{c.email}</td><td>{c.phone || "—"}</td><td className="num">{c.bookings_count}</td><td>{date(c.created_at)}</td>
                    <td><Badge tone={c.active ? "good" : "muted"}>{c.active ? "Active" : "Disabled"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} onPage={setPage} />
        </>
      )}
    </div>
  );
}

export function AdminCustomer() {
  const { id } = useParams();
  const { data, loading, setData } = useApi(`/admin/customers/${id}`);
  const navigate = useNavigate();
  const toast = useToast();
  if (loading && !data) return <Spinner />;
  const c = data.customer;
  const toggle = async () => {
    const res = await api(`/admin/customers/${id}`, { method: "PATCH", body: { customer: { active: !c.active } } });
    setData({ ...data, customer: res.customer });
    toast(res.customer.active ? "Account enabled" : "Account disabled");
  };
  const spent = data.bookings.filter((b) => b.payment_status !== "unpaid").reduce((s, b) => s + (b.confirmed_price_pence || 0), 0);
  return (
    <div className="stack">
      <Link to="/admin/customers" className="small row" style={{ gap: 4 }}><ArrowLeft size={14} /> All customers</Link>
      <div className="row-between">
        <div><h1 style={{ margin: 0 }}>{c.name}</h1><div className="muted">{c.email} · {c.phone || "no phone"} · joined {date(c.created_at)}</div></div>
        <button className={`btn btn-sm ${c.active ? "btn-danger" : "btn-secondary"}`} onClick={toggle}>{c.active ? "Disable account" : "Enable account"}</button>
      </div>
      <div className="grid-4">
        <div className="card kpi"><div className="kpi-label">Bookings</div><div className="kpi-value">{data.bookings.length}</div></div>
        <div className="card kpi"><div className="kpi-label">Total paid</div><div className="kpi-value">{money(spent)}</div></div>
        <div className="card kpi"><div className="kpi-label">Saved addresses</div><div className="kpi-value">{data.addresses.length}</div></div>
      </div>
      <h3>Bookings</h3>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Reference</th><th>Route</th><th>Service</th><th>Date</th><th>Status</th><th className="num">Price</th></tr></thead>
          <tbody>
            {data.bookings.map((b) => (
              <tr key={b.reference} className="clickable" onClick={() => navigate(`/admin/bookings/${b.reference}`)}>
                <td className="mono">{b.reference}</td><td>{b.collection_city} → {b.delivery_city}</td><td>{b.service.name}</td><td>{date(b.created_at)}</td>
                <td><StatusBadge status={b.status} /></td><td className="num">{money(b.price_pence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
