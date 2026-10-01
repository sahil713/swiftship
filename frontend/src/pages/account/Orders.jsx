import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Package, Plus } from "lucide-react";
import { useApi } from "../../lib/hooks.js";
import { date, money } from "../../lib/format.js";
import { Empty, Pagination, Spinner, StatusBadge, Tabs } from "../../components/ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { usePricingEnabled } from "../../lib/site.js";

export default function Orders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("current");
  const pricing = usePricingEnabled();
  const [page, setPage] = useState(1);
  const { data, loading } = useApi("/bookings", { filter, page });

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h1 style={{ marginBottom: 4 }}>Hi {user.name.split(" ")[0]}</h1>
          <p className="muted" style={{ margin: 0 }}>Your current and past orders.</p>
        </div>
        <Link to="/quote" className="btn btn-primary"><Plus size={16} /> New booking</Link>
      </div>
      <Tabs label="Order filter" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} tabs={[{ value: "current", label: "Current" }, { value: "past", label: "Past" }, { value: "", label: "All" }]} />
      {loading && !data ? <Spinner /> : data.bookings.length === 0 ? (
        <div className="card"><Empty icon={Package} title="No orders here yet"><Link to="/quote">Get a quote</Link> to book your first delivery.</Empty></div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Reference</th><th>Route</th><th>Service</th><th>Collection</th><th>Status</th>{pricing && <th className="num">Price</th>}</tr></thead>
              <tbody>
                {data.bookings.map((b) => (
                  <tr key={b.reference} className="clickable" onClick={() => navigate(`/account/orders/${b.reference}`)}>
                    <td><Link to={`/account/orders/${b.reference}`} className="mono" onClick={(e) => e.stopPropagation()}>{b.reference}</Link><div className="small muted">{b.item_description}</div></td>
                    <td>{b.collection_city} → {b.delivery_city}</td>
                    <td>{b.service.name}</td>
                    <td>{date(b.collection_date)}</td>
                    <td><StatusBadge status={b.status} /></td>
                    {pricing && <td className="num">{money(b.price_pence)}</td>}
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
