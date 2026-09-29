import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, PackageSearch, CalendarClock } from "lucide-react";
import { api } from "../lib/api.js";
import { date } from "../lib/format.js";
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
      .catch((err) => setState({ loading: false, data: null, error: err.status === 404 ? "We couldn't find a shipment with that tracking number. Check it and try again." : err.message }));
  }, [trackingNumber]);

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
          <p className="lead">Enter the tracking number from your confirmation email (it starts with SSUK). Signed in? Your orders are in <a href="/account">your account</a>.</p>
          <form className="track-form" onSubmit={submit} style={{ marginTop: 20 }}>
            <label htmlFor="tn" className="sr-only">Tracking number</label>
            <input id="tn" className="input" placeholder="SSUK0123456789" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" spellCheck={false} />
            <button className="btn btn-primary"><Search size={16} /> Track</button>
          </form>
        </div>
      </section>
      <section className="container" style={{ paddingBottom: 72 }}>
        {state.loading && <Spinner />}
        {state.error && <Alert type="error">{state.error}</Alert>}
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
