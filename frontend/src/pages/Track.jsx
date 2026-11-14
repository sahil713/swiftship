import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, PackageSearch, CalendarClock, Truck, MapPin, Clock, Route } from "lucide-react";
import { api } from "../lib/api.js";
import { date, timeOnly } from "../lib/format.js";
import { Alert, Spinner, StatusBadge } from "../components/ui.jsx";
import { EventTimeline, ProgressTrack } from "../components/StatusTimeline.jsx";

export default function Track() {
  const { trackingNumber } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(trackingNumber || "");
  const [state, setState] = useState({ loading: false, data: null, error: null });

  useEffect(() => {
    if (!trackingNumber) return setState({ loading: false, data: null, error: null });
    setInput(trackingNumber);
    setState({ loading: true, data: null, error: null });
    api(`/track/${encodeURIComponent(trackingNumber)}`)
      .then((data) => setState({ loading: false, data, error: null }))
      .catch((err) => setState({ loading: false, data: null, error: err.status === 404 ? "We couldn't find a shipment with that tracking number or booking reference. Check it and try again." : err.message }));
  }, [trackingNumber]);

  // While the driver is on the way, refresh quietly so the position and arrival time stay current.
  const live = !!state.data?.live;
  useEffect(() => {
    if (!live || !trackingNumber) return;
    const timer = setInterval(() => {
      api(`/track/${encodeURIComponent(trackingNumber)}`).then((data) => setState((s) => ({ ...s, data }))).catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [live, trackingNumber]);

  const submit = (e) => {
    e.preventDefault();
    const tn = input.trim().toUpperCase().replace(/\s+/g, "");
    if (tn) navigate(`/track/${tn}`);
  };

  const d = state.data;
  return (
    <>
      <section className="track-hero">
        <div className="container">
          <div className="eyebrow"><PackageSearch size={14} /> Tracking</div>
          <h1>Track your shipment</h1>
          <p className="lead">Enter the tracking number (starts with SSUK) or booking reference (starts with SS-) from your confirmation email. Signed in? Your orders are in <a href="/account">your account</a>.</p>
          <form className="track-form" onSubmit={submit} style={{ marginTop: 20 }}>
            <label htmlFor="tn" className="sr-only">Tracking number</label>
            <input id="tn" className="input" placeholder="SSUK0123456789 or SS-2611-ABC123" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" spellCheck={false} />
            <button className="btn btn-primary"><Search size={16} /> Track</button>
          </form>
        </div>
      </section>
      <section className="container" style={{ paddingBottom: 72 }}>
        {state.loading && <Spinner />}
        {state.error && <Alert type="error">{state.error}</Alert>}
        {d?.live && <LiveTracking live={d.live} />}
        {d && (
          <motion.div className="grid-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ alignItems: "start" }}>
            <div className="card">
              <div className="row-between">
                <div>
                  <div className="small muted">Tracking number</div>
                  <div className="mono" style={{ fontWeight: 700, fontSize: "1.1rem" }}>{d.tracking_number}</div>
                </div>
                <StatusBadge status={d.status} label={d.status_label} />
              </div>
              <ProgressTrack status={d.status} events={d.events} />
              {["exception", "failed_delivery"].includes(d.status) && (
                <Alert type="warning" title={d.status_label}>{d.events[d.events.length - 1]?.note || "We're looking into this and will be in touch."}</Alert>
              )}
              <dl className="dl" style={{ marginTop: 20 }}>
                <dt>Service</dt><dd>{d.service}</dd>
                <dt>From</dt><dd>{d.from}</dd>
                <dt>To</dt><dd>{d.to}</dd>
                <dt>Collection</dt><dd>{date(d.collection_date)}</dd>
                {d.delivered_at ? (<><dt>Delivered</dt><dd>{date(d.delivered_at, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{d.delivered_to ? ` · signed by ${d.delivered_to}` : ""}</dd></>) : (
                  <><dt><CalendarClock size={14} style={{ display: "inline", verticalAlign: -2 }} /> Estimated</dt><dd>{date(d.estimated_delivery_date, { weekday: "long", day: "numeric", month: "long" })}</dd></>
                )}
              </dl>
            </div>
            <div className="card">
              <h3>Shipment history</h3>
              <EventTimeline events={d.events} />
            </div>
          </motion.div>
        )}
      </section>
    </>
  );
}

const minutesAgo = (t) => Math.max(0, Math.round((Date.now() - new Date(t)) / 60000));
const inMinutes = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60 ? `${m % 60} min` : ""}`.trim());
const LiveMap = lazy(() => import("../components/LiveMap.jsx"));
const HEADING = ["to_collection", "to_delivery"];

// From the moment the driver sets off until the task is closed: the stage, each step's time,
// the driver's position, the path so far, the planned route and the arrival time.
function LiveTracking({ live }) {
  const loc = live.location;
  const dest = live.destination;
  const heading = HEADING.includes(live.stage);
  const iconStyle = { display: "inline", verticalAlign: -2 };
  return (
    <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 20 }}>
      <div className="row" style={{ gap: 8, color: "var(--accent)", fontWeight: 700 }}><Truck size={18} /> {live.stage_label}</div>
      {live.driver_name && <div className="small muted" style={{ marginTop: 4 }}>Driver: {live.driver_name}</div>}

      <dl className="dl" style={{ marginTop: 16 }}>
        {heading && <>
          <dt><Clock size={14} style={iconStyle} /> Arriving</dt>
          <dd>{live.eta_at ? <><strong style={{ fontSize: "1.15rem" }}>around {timeOnly(live.eta_at)}</strong> <span className="muted">(about {inMinutes(live.eta_minutes)})</span></> : "Working it out…"}</dd>
          <dt><Route size={14} style={iconStyle} /> Distance</dt>
          <dd>{live.distance_miles != null ? `about ${live.distance_miles} miles by road to ${dest?.label}` : dest?.label}</dd>
        </>}
        <dt><MapPin size={14} style={iconStyle} /> Driver is now</dt>
        <dd>{loc ? (loc.place ? `near ${loc.place}` : "on the road") : live.last_seen_at ? `last seen ${minutesAgo(live.last_seen_at)} min ago` : "waiting for the driver's phone to share its location"}</dd>
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
        {heading && "Arrival time is an estimate and can change with traffic. "}
        Live tracking ends when the driver completes this job.
      </p>
    </motion.div>
  );
}
