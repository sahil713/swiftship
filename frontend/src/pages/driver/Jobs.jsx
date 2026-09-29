import { Link } from "react-router-dom";
import { MapPin, Phone, Truck, PackageOpen, AlertTriangle } from "lucide-react";
import { useApi } from "../../lib/hooks.js";
import { date } from "../../lib/format.js";
import { Empty, Spinner, StatusBadge, Badge } from "../../components/ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function Jobs({ completed = false }) {
  const { user } = useAuth();
  const { data, loading } = useApi("/driver/jobs", { scope: completed ? "completed" : "active" });
  if (loading && !data) return <Spinner />;
  const collections = data.filter((j) => j.stage === "collection");
  const deliveries = data.filter((j) => j.stage === "delivery");

  const renderJob = (j) => {
    const collecting = j.stage === "collection";
    const p = collecting ? "collection" : "delivery";
    return (
      <Link key={j.reference} to={`/driver/jobs/${j.reference}`} className="card card-hover job-card">
        <div className="row-between">
          <span className="mono small">{j.reference}</span>
          <StatusBadge status={j.status} />
        </div>
        <h3 style={{ margin: "10px 0 4px" }}>{j[`${p}_contact_name`]}</h3>
        <div className="addr"><MapPin size={14} style={{ display: "inline", verticalAlign: -2 }} /> {j[`${p}_line1`]}, {j[`${p}_city`]} <strong className="mono">{j[`${p}_postcode`]}</strong></div>
        <div className="small muted" style={{ marginTop: 6 }}><Phone size={13} style={{ display: "inline", verticalAlign: -2 }} /> {j[`${p}_phone`]}</div>
        <div className="row small" style={{ marginTop: 10 }}>
          <Badge tone="neutral" plain>{j.service.name}</Badge>
          <span className="muted">{j.quantity} × {j.item_description}</span>
          {j.fragile && <Badge tone="warning">Fragile</Badge>}
          {!completed && <span className="muted">· {collecting ? `Collect ${date(j.collection_date)}` : `Due ${date(j.estimated_delivery_date)}`}</span>}
        </div>
        {j[`${p}_instructions`] && <p className="small" style={{ margin: "8px 0 0", color: "var(--text-2)" }}><AlertTriangle size={13} style={{ display: "inline", verticalAlign: -2 }} /> {j[`${p}_instructions`]}</p>}
      </Link>
    );
  };

  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>{completed ? "Completed jobs" : "Today's jobs"}</h1>
        <p className="muted" style={{ margin: 0 }}>{user.role === "driver" ? "Jobs assigned to you." : "All jobs with an assigned driver."}</p>
      </div>
      {data.length === 0 ? (
        <div className="card"><Empty icon={Truck} title={completed ? "No completed jobs yet" : "No active jobs"}>New assignments appear here.</Empty></div>
      ) : completed ? (
        <div className="grid-2">{data.map(renderJob)}</div>
      ) : (
        <>
          {collections.length > 0 && <><h2 style={{ fontSize: "1.2rem" }}><PackageOpen size={18} style={{ display: "inline", verticalAlign: -3 }} /> Collections ({collections.length})</h2><div className="grid-2">{collections.map(renderJob)}</div></>}
          {deliveries.length > 0 && <><h2 style={{ fontSize: "1.2rem", marginTop: 16 }}><Truck size={18} style={{ display: "inline", verticalAlign: -3 }} /> Deliveries & in progress ({deliveries.length})</h2><div className="grid-2">{deliveries.map(renderJob)}</div></>}
        </>
      )}
    </div>
  );
}
