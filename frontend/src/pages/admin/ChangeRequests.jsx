import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/hooks.js";
import { dateTime, humanize } from "../../lib/format.js";
import { Badge, Empty, Pagination, Spinner, StatusBadge, Tabs } from "../../components/ui.jsx";

export default function ChangeRequests() {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const { data, loading } = useApi("/admin/change_requests", { status, page });
  const navigate = useNavigate();
  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>Cancellations & change requests</h1>
        <p className="muted" style={{ margin: 0 }}>Open a booking to approve or reject its request and issue any refund.</p>
      </div>
      <Tabs label="Request status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[{ value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "all", label: "All" }]} />
      {loading && !data ? <Spinner /> : data.change_requests.length === 0 ? <div className="card"><Empty title="Nothing to review" /></div> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Booking</th><th>Type</th><th>Details</th><th>Booking status</th><th>Payment</th><th>Requested</th><th>Decision</th></tr></thead>
              <tbody>
                {data.change_requests.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => navigate(`/admin/bookings/${r.booking.reference}`)}>
                    <td className="mono">{r.booking.reference}<div className="small muted">{r.booking.customer_email}</div></td>
                    <td><Badge tone={r.kind === "cancellation" ? "critical" : "info"} plain>{humanize(r.kind)}</Badge></td>
                    <td className="small" style={{ maxWidth: 320 }}>{r.details || <span className="muted">—</span>}</td>
                    <td><StatusBadge status={r.booking.status} /></td>
                    <td>{humanize(r.booking.payment_status)}</td>
                    <td className="small">{dateTime(r.created_at)}</td>
                    <td><Badge tone={r.status === "pending" ? "warning" : r.status === "approved" ? "good" : "muted"}>{humanize(r.status)}</Badge></td>
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
