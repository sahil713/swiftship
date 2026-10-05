import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CreditCard, Lock, RefreshCw, XCircle, PencilLine, Copy, ExternalLink } from "lucide-react";
import { api } from "../lib/api.js";
import { useApi } from "../lib/hooks.js";
import { date, dateTime, humanize, money } from "../lib/format.js";
import { Alert, Badge, Field, Modal, Spinner, StatusBadge } from "../components/ui.jsx";
import { EventTimeline, ProgressTrack } from "../components/StatusTimeline.jsx";
import { useToast } from "../components/Toast.jsx";
import ProofView from "../components/ProofView.jsx";
import { usePricingEnabled } from "../lib/site.js";

function PaymentForm({ booking, token, onPaid }) {
  const [card, setCard] = useState({ card_number: "", expiry: "", cvc: "", name: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, fmt = (v) => v) => (e) => setCard({ ...card, [k]: fmt(e.target.value) });
  const fmtCard = (v) => v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
  const fmtExpiry = (v) => v.replace(/\D/g, "").slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api(`/bookings/${booking.reference}/pay`, { method: "POST", body: { ...card, token } });
      onPaid(res.booking);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit} style={{ borderColor: "var(--accent)", borderWidth: 2 }}>
      <div className="row-between">
        <h3 style={{ margin: 0 }}><CreditCard size={20} style={{ display: "inline", verticalAlign: -4 }} /> Pay {money(booking.confirmed_price_pence)}</h3>
        <span className="small muted row" style={{ gap: 4 }}><Lock size={14} /> Secure payment</span>
      </div>
      {import.meta.env.DEV && <Alert type="info">Test mode: use 4242 4242 4242 4242, any future expiry and any CVC. 4000 0000 0000 0002 simulates a decline.</Alert>}
      {error && <Alert type="error">{error}</Alert>}
      <Field label="Name on card" htmlFor="cc-name"><input id="cc-name" className="input" autoComplete="cc-name" value={card.name} onChange={set("name")} required /></Field>
      <Field label="Card number" htmlFor="cc-num"><input id="cc-num" className="input mono" inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" value={card.card_number} onChange={set("card_number", fmtCard)} required /></Field>
      <div className="form-grid">
        <Field label="Expiry" htmlFor="cc-exp"><input id="cc-exp" className="input mono" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={card.expiry} onChange={set("expiry", fmtExpiry)} required /></Field>
        <Field label="Security code" htmlFor="cc-cvc"><input id="cc-cvc" className="input mono" inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} value={card.cvc} onChange={set("cvc", (v) => v.replace(/\D/g, ""))} required /></Field>
      </div>
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? "Processing…" : `Pay ${money(booking.confirmed_price_pence)} and confirm booking`}</button>
    </form>
  );
}

function ChangeRequestModal({ kind, booking, token, onClose, onDone }) {
  const [details, setDetails] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const cancelling = kind === "cancellation";
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api(`/bookings/${booking.reference}/change_request`, { method: "POST", body: { kind, details, token } });
      onDone(res.booking, cancelling && booking.payment_status === "unpaid" ? "Booking cancelled" : "Request sent – we'll be in touch");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={cancelling ? "Cancel booking" : "Request a change"}>
      <form className="stack" onSubmit={submit}>
        {error && <Alert type="error">{error}</Alert>}
        {cancelling ? (
          <p className="muted">{booking.payment_status === "unpaid" ? "No payment has been taken, so this booking will be cancelled straight away." : "You've already paid, so our team will review your cancellation and process any refund in line with our terms."}</p>
        ) : (
          <p className="muted">Tell us what you'd like to change — e.g. a new collection date, address or item details. Changes may affect the price.</p>
        )}
        <Field label={cancelling ? "Reason (optional)" : "What would you like to change?"} htmlFor="cr-details">
          <textarea id="cr-details" className="textarea" rows={4} value={details} onChange={(e) => setDetails(e.target.value)} required={!cancelling} />
        </Field>
        <button className={`btn ${cancelling ? "btn-danger" : "btn-primary"}`} disabled={busy}>{busy ? "Sending…" : cancelling ? "Cancel booking" : "Send request"}</button>
      </form>
    </Modal>
  );
}

export default function OrderPage({ embedded = false }) {
  const { reference } = useParams();
  const [params] = useSearchParams();
  const token = params.get("token");
  const isNew = params.get("new") === "1";
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi(`/bookings/${reference}`, token ? { token } : undefined);
  const [modal, setModal] = useState(null);
  const [justPaid, setJustPaid] = useState(false);
  const pricing = usePricingEnabled();

  if (loading && !data) return <Spinner />;
  if (error) {
    return (
      <section className={embedded ? "" : "container"} style={{ padding: "48px 16px" }}>
        <Alert type="error" title="We couldn't open this booking">{error.status === 404 ? "Check the link in your confirmation email, or sign in to the account you booked with." : error.message}</Alert>
      </section>
    );
  }
  const b = data.booking;
  const breakdown = b.price_breakdown || {};
  const pendingRequest = b.change_requests.find((r) => r.status === "pending");
  const guestLink = token ? `${window.location.origin}/orders/${b.reference}?token=${token}` : null;

  const content = (
    <div className="stack">
      {(isNew || justPaid) && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <Alert type="success" title={justPaid ? "Payment received – you're booked!" : b.status === "awaiting_payment" ? "Your price is confirmed" : "Quote request received"}>
            {justPaid
              ? `We've emailed your confirmation to ${b.customer_email}. Your tracking number is ${b.tracking_number}.`
              : b.status === "awaiting_payment"
                ? "Pay below to confirm your booking."
                : `We'll review your details and email ${b.customer_email} when your final price is ready.`}
          </Alert>
        </motion.div>
      )}

      <div className="row-between">
        <div>
          <div className="small muted">Booking reference</div>
          <h1 style={{ margin: 0, fontSize: "clamp(1.4rem, 3vw, 2rem)" }} className="mono">{b.reference}</h1>
        </div>
        <div className="row">
          <StatusBadge status={b.status} />
          <Badge tone={b.payment_status === "paid" ? "good" : b.payment_status === "unpaid" ? "neutral" : "warning"}>{humanize(b.payment_status)}</Badge>
          <button className="icon-btn" onClick={reload} aria-label="Refresh" title="Refresh"><RefreshCw size={16} /></button>
        </div>
      </div>

      {guestLink && (
        <Alert type="info" title="Keep this link">
          This private link is how you get back to your booking without an account.{" "}
          <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(guestLink).then(() => toast("Link copied"))}><Copy size={14} /> Copy link</button>
        </Alert>
      )}

      <div className="booking-layout">
        <div className="stack">
          {pricing && b.payable && <PaymentForm booking={b} token={token} onPaid={(nb) => { setData({ booking: nb }); setJustPaid(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}

          {!["quote_requested", "awaiting_payment", "cancelled"].includes(b.status) && (
            <div className="card">
              <div className="row-between">
                <h3 style={{ margin: 0 }}>Tracking</h3>
                <Link to={`/track/${b.tracking_number}`} className="small mono">{b.tracking_number} <ExternalLink size={12} style={{ display: "inline" }} /></Link>
              </div>
              <ProgressTrack status={b.status} events={b.events} />
            </div>
          )}

          <div className="card">
            <h3>Shipment details</h3>
            <div className="grid-2" style={{ gap: 16 }}>
              <div>
                <div className="small muted">Collect from</div>
                <p style={{ fontWeight: 600, marginBottom: 0 }}>{b.collection_contact_name}<br />{b.collection_line1}{b.collection_line2 && `, ${b.collection_line2}`}<br />{b.collection_city} {b.collection_postcode}</p>
                {b.collection_instructions && <p className="small muted">“{b.collection_instructions}”</p>}
              </div>
              <div>
                <div className="small muted">Deliver to</div>
                <p style={{ fontWeight: 600, marginBottom: 0 }}>{b.delivery_contact_name}<br />{b.delivery_line1}{b.delivery_line2 && `, ${b.delivery_line2}`}<br />{b.delivery_city} {b.delivery_postcode}</p>
                {b.delivery_instructions && <p className="small muted">“{b.delivery_instructions}”</p>}
              </div>
            </div>
            <hr className="divider" />
            <dl className="dl">
              <dt>Service</dt><dd>{b.service.name}</dd>
              <dt>Item</dt><dd>{b.quantity} × {b.item_description}{b.fragile ? " · fragile" : ""}</dd>
              {b.weight_kg && <><dt>Weight</dt><dd>{Number(b.weight_kg)} kg each</dd></>}
              <dt>Collection date</dt><dd>{date(b.collection_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</dd>
              <dt>Est. delivery</dt><dd>{date(b.estimated_delivery_date, { weekday: "short", day: "numeric", month: "short" })}</dd>
              <dt>Booked on</dt><dd>{dateTime(b.created_at)}</dd>
            </dl>
          </div>

          {(() => {
            const pod = [...(b.tasks || [])].reverse().find((t) => t.kind === "delivery" && t.status === "completed")?.proof;
            return pod ? <div className="card"><h3>Proof of delivery</h3><ProofView proof={{ ...pod, recorded_by: undefined }} kind="delivery" /></div> : null;
          })()}
          {b.proof_of_delivery && (
            <div className="card">
              <h3>Proof of delivery</h3>
              <p>Received by <strong>{b.proof_of_delivery.recipient_name}</strong> on {dateTime(b.proof_of_delivery.created_at)}</p>
              <div className="row" style={{ alignItems: "flex-start" }}>
                {b.proof_of_delivery.signature_data && <img src={b.proof_of_delivery.signature_data} alt="Recipient signature" className="photo-preview" style={{ background: "#fff", maxWidth: 260 }} />}
                {b.proof_of_delivery.photo_data && <img src={b.proof_of_delivery.photo_data} alt="Delivery photo" className="photo-preview" />}
              </div>
            </div>
          )}

          <div className="card">
            <h3>History</h3>
            <EventTimeline events={b.events} />
          </div>
        </div>

        <aside className="stack sticky-summary">
          {pricing ? <div className="card">
            <h3>{b.confirmed_price_pence ? "Confirmed price" : "Estimated price"}</h3>
            <ul className="price-lines">
              {(breakdown.lines || []).map((l) => <li key={l.label}><span>{l.label}</span><span>{money(l.amount_pence)}</span></li>)}
              {b.confirmed_price_pence && b.confirmed_price_pence !== b.estimated_price_pence && (
                <li><span>Adjustment after review</span><span>{money(b.confirmed_price_pence - b.estimated_price_pence)}</span></li>
              )}
            </ul>
            <div className="price-total"><span>Total</span><span className="amount">{money(b.price_pence)}</span></div>
            {!b.confirmed_price_pence && <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>Awaiting confirmation from our team. The price may change if item details are incomplete or inaccurate.</p>}
            {b.payments.filter((p) => p.refunded_pence > 0).map((p) => (
              <p key={p.id} className="small" style={{ marginTop: 12, marginBottom: 0 }}>Refunded {money(p.refunded_pence)} to {p.card_brand} •••• {p.card_last4}</p>
            ))}
          </div> : (
            <div className="card">
              <h3>Your quotation</h3>
              <p className="muted small" style={{ margin: 0 }}>Our team will call you to discuss pricing for this request.</p>
            </div>
          )}

          <div className="card">
            <h3>Need to make a change?</h3>
            {pendingRequest ? (
              <Alert type="info" title={`${humanize(pendingRequest.kind)} request pending`}>Sent {dateTime(pendingRequest.created_at)}. We'll get back to you soon.</Alert>
            ) : b.status === "cancelled" ? (
              <p className="muted small">This booking has been cancelled.</p>
            ) : (
              <div className="stack">
                <button className="btn btn-secondary btn-block" onClick={() => setModal("change")}><PencilLine size={16} /> Request a change</button>
                {b.cancellable && <button className="btn btn-danger btn-block" onClick={() => setModal("cancellation")}><XCircle size={16} /> Cancel booking</button>}
              </div>
            )}
            {b.change_requests.filter((r) => r.status !== "pending").map((r) => (
              <div key={r.id} className="small" style={{ marginTop: 12 }}>
                <Badge tone={r.status === "approved" ? "good" : "critical"}>{humanize(r.kind)} {r.status}</Badge>
                {r.admin_response && <p className="muted" style={{ marginTop: 6 }}>{r.admin_response}</p>}
              </div>
            ))}
            <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>Questions? <Link to="/contact">Contact us</Link> quoting {b.reference}.</p>
          </div>
        </aside>
      </div>

      {modal && (
        <ChangeRequestModal kind={modal} booking={b} token={token} onClose={() => setModal(null)} onDone={(nb, msg) => { setData({ booking: nb }); setModal(null); toast(msg); }} />
      )}
    </div>
  );

  return embedded ? content : <section className="container" style={{ padding: "40px 16px 72px" }}>{content}</section>;
}
