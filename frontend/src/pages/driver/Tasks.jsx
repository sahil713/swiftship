import { Link, useNavigate } from "react-router-dom";
import { MapPin, Phone, PackageOpen, Truck, ChevronRight, Calendar, Route } from "lucide-react";
import { useApi } from "../../lib/hooks.js";
import { date, TASK_KIND_LABELS } from "../../lib/format.js";
import { Badge, Empty, Spinner, Tabs } from "../../components/ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const TONE = { assigned: "warning", started: "accent", arrived: "accent", collected: "info", arrived_delivery: "accent", closed: "good", completed: "good" };

export function TaskKind({ kind }) {
  const Icon = { collection: PackageOpen, delivery: Truck, direct: Route }[kind] || Truck;
  return <span className={`task-kind ${kind}`}><Icon size={14} /> {TASK_KIND_LABELS[kind] || kind}</span>;
}

export default function Tasks({ completed = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading } = useApi("/driver/tasks", { scope: completed ? "completed" : "active" });

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div>
        <h1 style={{ marginBottom: 4 }}>{user.role === "driver" ? "My tasks" : "Driver tasks"}</h1>
        <p className="muted" style={{ margin: 0 }}>{user.role === "driver" ? "Collections and deliveries assigned to you." : "Every task assigned to a driver."}</p>
      </div>
      <Tabs label="Task list" value={completed ? "done" : "active"} onChange={(v) => navigate(v === "done" ? "/driver/completed" : "/driver")} tabs={[{ value: "active", label: "Active" }, { value: "done", label: "Completed" }]} />
      {loading && !data ? <Spinner /> : data.length === 0 ? (
        <div className="card"><Empty icon={Truck} title={completed ? "No completed tasks yet" : "No tasks right now"}>New collections and deliveries will appear here.</Empty></div>
      ) : (
        <div className="stack">
          {data.map((t) => (
            <Link key={t.id} to={`/driver/tasks/${t.id}`} className="card card-hover job-card" style={{ padding: 18 }}>
              <div className="row-between">
                <TaskKind kind={t.kind} />
                <Badge tone={TONE[t.status] || "neutral"}>{t.status_label}</Badge>
              </div>
              <div className="row-between" style={{ marginTop: 12, alignItems: "flex-start", flexWrap: "nowrap" }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: "1.15rem" }}>{t.contact_name}</h3>
                  <div className="addr"><MapPin size={14} style={{ display: "inline", verticalAlign: -2 }} /> {t.address.line1}, {t.address.city} <strong className="mono">{t.address.postcode}</strong></div>
                  <div className="small muted" style={{ marginTop: 6 }}>
                    <Phone size={13} style={{ display: "inline", verticalAlign: -2 }} /> {t.contact_phone}
                    {t.date && <> · <Calendar size={13} style={{ display: "inline", verticalAlign: -2 }} /> {date(t.date, { weekday: "short", day: "numeric", month: "short" })}</>}
                  </div>
                  <div className="small" style={{ marginTop: 6, color: "var(--text-2)" }}>{t.item.quantity} × {t.item.description}{t.item.fragile ? " · Fragile" : ""}</div>
                </div>
                <ChevronRight size={22} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              </div>
              {user.role !== "driver" && <div className="small muted" style={{ marginTop: 8 }}>Driver: {t.driver.name} · {t.reference}</div>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
