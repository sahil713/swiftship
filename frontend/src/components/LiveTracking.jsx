import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { Truck, MapPin, Clock, Route } from "lucide-react";
import { timeOnly } from "../lib/format.js";

const minutesAgo = (t) => Math.max(0, Math.round((Date.now() - new Date(t)) / 60000));
const inMinutes = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60 ? `${m % 60} min` : ""}`.trim());
const LiveMap = lazy(() => import("./LiveMap.jsx"));
const HEADING = ["to_collection", "to_delivery", "to_depot"];

// Driver-facing wording for each stage (the customer sees the server's stage_label).
const DRIVER_STAGE_LABELS = {
  to_collection: "Heading to the collection address",
  at_collection: "At the collection address",
  to_depot: "Heading to the depot",
  at_depot: "At the depot",
  to_delivery: "Heading to the delivery address",
  at_delivery: "At the delivery address",
  delivered: "Delivered – close the task to finish",
};

// From the moment the driver sets off until the task is closed: the stage, each step's time,
// the driver's position, the path so far, the planned route and the arrival time.
// audience: "customer" (tracking page) or "driver" (driver's task page).
export default function LiveTracking({ live, audience = "customer" }) {
  const forDriver = audience === "driver";
  const loc = live.location;
  const dest = live.destination;
  const heading = HEADING.includes(live.stage);
  const iconStyle = { display: "inline", verticalAlign: -2 };
  const title = forDriver ? DRIVER_STAGE_LABELS[live.stage] || "Live tracking" : live.stage_label;
  return (
    <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: forDriver ? 0 : 20 }}>
      <div className="row" style={{ gap: 8, color: "var(--accent)", fontWeight: 700 }}><Truck size={18} /> {title}</div>
      {!forDriver && live.driver_name && <div className="small muted" style={{ marginTop: 4 }}>Driver: {live.driver_name}</div>}

      <dl className="dl" style={{ marginTop: 16 }}>
        {heading && dest && <>
          <dt><Clock size={14} style={iconStyle} /> {forDriver ? "You'll arrive" : "Arriving"}</dt>
          <dd>{live.eta_at ? <><strong style={{ fontSize: "1.15rem" }}>around {timeOnly(live.eta_at)}</strong> <span className="muted">(about {inMinutes(live.eta_minutes)})</span></> : "Working it out…"}</dd>
          <dt><Route size={14} style={iconStyle} /> Distance</dt>
          <dd>{live.distance_miles != null ? `about ${live.distance_miles} miles by road to ${dest.label}` : dest.label}</dd>
        </>}
        <dt><MapPin size={14} style={iconStyle} /> {forDriver ? "You are" : "Driver is now"}</dt>
        <dd>{loc ? (loc.place ? `near ${loc.place}` : "on the road") : live.last_seen_at ? `last seen ${minutesAgo(live.last_seen_at)} min ago` : forDriver ? "waiting for your phone's location" : "waiting for the driver's phone to share its location"}</dd>
      </dl>

      {(loc || live.path?.length > 1) && (
        <Suspense fallback={<div className="live-map" />}>
          <LiveMap path={live.path} route={live.route} driver={loc} destination={heading ? dest : null} />
        </Suspense>
      )}
      {(loc || live.path?.length > 1) && (
        <div className="live-legend small muted">
          <span><i /> Route driven</span>
          {live.route && <span><i className="planned" /> Planned route</span>}
        </div>
      )}

      <ol className="live-steps" aria-label="Progress">
        {live.milestones.map((m) => (
          <li key={m.label} className={m.at ? "done" : ""}>{m.label}{m.at && <time dateTime={m.at}>{timeOnly(m.at)}</time>}</li>
        ))}
      </ol>

      <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
        {loc && `Location updated ${minutesAgo(loc.updated_at) === 0 ? "just now" : `${minutesAgo(loc.updated_at)} min ago`}. `}
        {heading && dest && "Arrival time is an estimate and can change with traffic. "}
        {forDriver ? "The customer sees this live until you close the task." : "Live tracking ends when the driver completes this job."}
      </p>
    </motion.div>
  );
}
