import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Calculator, StickyNote, Mail, MessageSquareText } from "lucide-react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { date, dateTime, humanize, money, penceFromPounds, poundsFromPence, STATUS_LABELS } from "../../lib/format.js";
import { Alert, Badge, Field, Modal, Spinner, StatusBadge } from "../../components/ui.jsx";
import { EventTimeline } from "../../components/StatusTimeline.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import ProofView from "../../components/ProofView.jsx";

const NOTE_KINDS = { internal: "Internal note", collection_issue: "Collection issue", delivery_issue: "Delivery issue", damage: "Damage report" };

export default function Booking() {
  const { reference } = useParams();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { data, loading, error, setData } = useApi(`/admin/bookings/${reference}`);
  const [statusForm, setStatusForm] = useState({ status: "", note: "", location: "", customer_visible: true });
  const [price, setPrice] = useState("");
  const [note, setNote] = useState({ kind: "internal", body: "" });
  const [refund, setRefund] = useState(null);
  const [edit, setEdit] = useState(null);
  const [reprice, setReprice] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Spinner />;
  if (error) return <Alert type="error">{error.message}</Alert>;
  const b = data.booking;

  const act = async (path, body, message, method = "POST") => {
    setBusy(true);
    try {
      const res = await api(`/admin/bookings/${reference}${path}`, { method, body });
      setData(res);
      toast(message);
      return true;
    } catch (err) {
      toast(err.message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitStatus = async (e) => {
    e.preventDefault();
    if (await act("/status", statusForm, `Status updated to ${STATUS_LABELS[statusForm.status]}`)) setStatusForm({ status: "", note: "", location: "", customer_visible: true });
  };

  const loadReprice = async () => {
    try {
      setReprice(await api(`/admin/bookings/${reference}/reprice`));
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const canPrice = ["quote_requested", "awaiting_payment"].includes(b.status) && b.payment_status === "unpaid";
  const pending = b.change_requests.filter((r) => r.status === "pending");

  return (
    <div className="stack">
      <Link to="/admin/bookings" className="small row" style={{ gap: 4 }}><ArrowLeft size={14} /> All bookings</Link>
      <div className="row-between">
        <div>
          <h1 className="mono" style={{ margin: 0 }}>{b.reference}</h1>
          <div className="small muted">Tracking <Link to={`/track/${b.tracking_number}`} className="mono">{b.tracking_number} <ExternalLink size={11} style={{ display: "inline" }} /></Link> · created {dateTime(b.created_at)}</div>
        </div>
        <div className="row">
          <StatusBadge status={b.status} />
          <Badge tone={b.payment_status === "paid" ? "good" : b.payment_status === "unpaid" ? "neutral" : "warning"}>{humanize(b.payment_status)}</Badge>
        </div>
      </div>

      {b.area_review && (
        <Alert type="warning" title="Service area review needed">
          This request is outside our normal service area – check whether we can take the job before quoting.
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{(b.area_review_notes || "").split("\n").filter(Boolean).map((n) => <li key={n}>{n}</li>)}</ul>
        </Alert>
      )}
      {pending.map((r) => (
        <Alert key={r.id} type="warning" title={`Customer ${r.kind} request · ${dateTime(r.created_at)}`}>
          {r.details || "No details given."}
          <ChangeRequestActions booking={b} request={r} act={act} />
        </Alert>
      ))}

      <div className="booking-layout" style={{ gridTemplateColumns: undefined }}>
        <div className="stack">
          <div className="card">
            <div className="row-between"><h3 style={{ margin: 0 }}>Shipment</h3><button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...b, service_id: b.service.id })}>Edit details</button></div>
            <div className="grid-2" style={{ gap: 16, marginTop: 12 }}>
              {["collection", "delivery"].map((p) => (
                <div key={p}>
                  <div className="small muted">{p === "collection" ? "Collect from" : "Deliver to"}</div>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>{b[`${p}_contact_name`]}<br />{b[`${p}_line1`]}{b[`${p}_line2`] && `, ${b[`${p}_line2`]}`}<br />{b[`${p}_city`]} {b[`${p}_postcode`]}</p>
                  <div className="small"><a href={`tel:${b[`${p}_phone`]}`}>{b[`${p}_phone`]}</a> · <a href={`mailto:${b[`${p}_email`]}`}>{b[`${p}_email`]}</a></div>
                  {b[`${p}_instructions`] && <p className="small muted" style={{ marginTop: 6 }}>“{b[`${p}_instructions`]}”</p>}
                </div>
              ))}
            </div>
            <hr className="divider" />
            <dl className="dl">
              <dt>Service</dt><dd>{b.service.name}</dd>
              <dt>Item</dt><dd>{b.quantity} × {b.item_description}{b.fragile ? " · fragile" : ""}</dd>
              <dt>Weight</dt><dd>{b.weight_kg ? `${Number(b.weight_kg)} kg each` : <span className="muted">Not given</span>}</dd>
              <dt>Dimensions</dt><dd>{b.length_cm ? `${Number(b.length_cm)} × ${Number(b.width_cm)} × ${Number(b.height_cm)} cm` : <span className="muted">Not given</span>}</dd>
              <dt>Collection</dt><dd>{date(b.collection_date)}</dd>
              <dt>Est. delivery</dt><dd>{date(b.estimated_delivery_date)}</dd>
              <dt>Special requirements</dt><dd style={{ whiteSpace: "pre-wrap" }}>{b.special_requirements || <span className="muted">None</span>}</dd>
              <dt>Customer</dt><dd>{b.user ? <Link to={`/admin/customers/${b.user.id}`}>{b.user.name}</Link> : "Guest"} · {b.customer_email}</dd>
            </dl>
          </div>

          <DriverTasks booking={b} drivers={data.drivers} act={act} busy={busy} />

          <form className="card stack" onSubmit={submitStatus}>
            <h3 style={{ margin: 0 }}>Update status</h3>
            {b.allowed_transitions.length === 0 ? <p className="muted small">No further status changes are possible.</p> : (
              <>
                <div className="row" role="radiogroup" aria-label="New status">
                  {b.allowed_transitions.map((s) => (
                    <button type="button" key={s} role="radio" aria-checked={statusForm.status === s} className={`btn btn-sm ${statusForm.status === s ? "btn-primary" : "btn-secondary"}`} onClick={() => setStatusForm({ ...statusForm, status: s })}>{STATUS_LABELS[s]}</button>
                  ))}
                </div>
                {b.allowed_transitions.includes("awaiting_payment") && <p className="small muted" style={{ margin: 0 }}>Tip: use “Confirm price” to move a quote to awaiting payment.</p>}
                <div className="form-grid">
                  <Field label="Note" htmlFor="st-note" hint="Shown to the customer unless marked internal"><input id="st-note" className="input" value={statusForm.note} onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })} /></Field>
                  <Field label="Location (optional)" htmlFor="st-loc"><input id="st-loc" className="input" value={statusForm.location} onChange={(e) => setStatusForm({ ...statusForm, location: e.target.value })} /></Field>
                </div>
                <label className="checkbox"><input type="checkbox" checked={!statusForm.customer_visible} onChange={(e) => setStatusForm({ ...statusForm, customer_visible: !e.target.checked })} /> Internal only (hide from customer tracking)</label>
                <button className="btn btn-primary" disabled={!statusForm.status || busy}>Update status</button>
              </>
            )}
          </form>

          <div className="card">
            <h3>History</h3>
            <EventTimeline events={b.events} showBy />
          </div>

          <div className="card stack">
            <h3 style={{ margin: 0 }}><StickyNote size={18} style={{ display: "inline", verticalAlign: -3 }} /> Notes & issues</h3>
            <form className="stack" onSubmit={async (e) => { e.preventDefault(); if (await act("/add_note", note, "Note added")) setNote({ kind: "internal", body: "" }); }}>
              <div className="form-grid" style={{ gridTemplateColumns: "minmax(160px, 200px) 1fr" }}>
                <select className="select" aria-label="Note type" value={note.kind} onChange={(e) => setNote({ ...note, kind: e.target.value })}>
                  {Object.entries(NOTE_KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input className="input" aria-label="Note" placeholder="Add an internal note…" value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} required />
              </div>
              <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy}>Add note</button>
            </form>
            {b.notes.map((n) => (
              <div key={n.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <div className="row small"><Badge tone={n.kind === "internal" ? "neutral" : n.kind === "damage" ? "critical" : "warning"} plain>{NOTE_KINDS[n.kind]}</Badge><span className="muted">{n.author || "System"} · {dateTime(n.created_at)}</span></div>
                <p style={{ margin: "6px 0 0" }}>{n.body}</p>
              </div>
            ))}
          </div>

          {b.proof_of_delivery && (
            <div className="card">
              <h3>Proof of delivery (earlier system)</h3>
              <p>Signed by <strong>{b.proof_of_delivery.recipient_name}</strong> · {dateTime(b.proof_of_delivery.created_at)} · driver {b.proof_of_delivery.driver}</p>
              {b.proof_of_delivery.notes && <p className="muted">{b.proof_of_delivery.notes}</p>}
              <div className="row" style={{ alignItems: "flex-start" }}>
                {b.proof_of_delivery.signature_data && <img src={b.proof_of_delivery.signature_data} alt="Signature" className="photo-preview" style={{ background: "#fff", maxWidth: 260 }} />}
                {b.proof_of_delivery.photo_data && <img src={b.proof_of_delivery.photo_data} alt="Delivery" className="photo-preview" />}
              </div>
            </div>
          )}
        </div>

        <aside className="stack">
          <div className="card stack">
            <h3 style={{ margin: 0 }}>Price</h3>
            <ul className="price-lines">
              {(b.price_breakdown.lines || []).map((l) => <li key={l.label}><span>{l.label}</span><span>{money(l.amount_pence)}</span></li>)}
            </ul>
            <div className="price-total"><span>Estimate</span><span>{money(b.estimated_price_pence)}</span></div>
            <div className="price-total" style={{ marginTop: 0 }}><span>Confirmed</span><span className="amount">{money(b.confirmed_price_pence)}</span></div>
            {(b.price_breakdown.warnings || []).map((w) => <Alert key={w} type="warning">{w}</Alert>)}
            {canPrice && (
              <form className="stack" onSubmit={async (e) => { e.preventDefault(); if (await act("/confirm_price", { price_pence: penceFromPounds(price || poundsFromPence(b.estimated_price_pence)) }, "Price confirmed – customer notified")) setPrice(""); }}>
                <Field label="Confirm final price (£)" htmlFor="cp">
                  <input id="cp" type="number" step="0.01" min="0.01" className="input" placeholder={poundsFromPence(b.confirmed_price_pence || b.estimated_price_pence)} value={price} onChange={(e) => setPrice(e.target.value)} />
                </Field>
                <div className="row">
                  <button className="btn btn-primary btn-sm" disabled={busy}>Confirm price</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={loadReprice}><Calculator size={14} /> Recalculate</button>
                </div>
                {reprice && (reprice.ok ? <p className="small muted" style={{ margin: 0 }}>Current pricing rules give <strong>{money(reprice.total_pence)}</strong>. <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPrice(poundsFromPence(reprice.total_pence))}>Use this</button></p> : <Alert type="error">{reprice.errors.join(" ")}</Alert>)}
              </form>
            )}
          </div>

          <div className="card stack">
            <h3 style={{ margin: 0 }}>Payments</h3>
            {b.payments.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No payments yet.</p> : b.payments.map((p) => (
              <div key={p.id} className="small">
                <div className="row-between"><strong>{money(p.amount_pence)}</strong><Badge tone={p.status === "succeeded" ? "good" : "warning"} plain>{humanize(p.status)}</Badge></div>
                <div className="muted">{p.card_brand} •••• {p.card_last4} · {dateTime(p.created_at)}</div>
                {p.refunded_pence > 0 && <div>Refunded {money(p.refunded_pence)}</div>}
                {isAdmin && p.amount_pence - p.refunded_pence > 0 && <button className="btn btn-danger btn-sm" style={{ marginTop: 8 }} onClick={() => setRefund({ payment: p, amount: poundsFromPence(p.amount_pence - p.refunded_pence), reason: "" })}>Refund…</button>}
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Notifications sent</h3>
            {b.notifications.length === 0 ? <p className="muted small">None yet.</p> : (
              <ul className="price-lines">
                {b.notifications.slice(0, 10).map((n) => (
                  <li key={n.id} className="small" style={{ justifyContent: "flex-start" }}>
                    {n.channel === "email" ? <Mail size={14} /> : <MessageSquareText size={14} />}
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={n.body}>{n.subject || n.body}</span>
                    {n.status !== "sent" && <Badge tone="warning" plain>{humanize(n.status)}</Badge>}
                    <span className="muted" style={{ fontWeight: 400 }}>{dateTime(n.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <Modal open={!!refund} onClose={() => setRefund(null)} title="Issue refund">
        {refund && (
          <form className="stack" onSubmit={async (e) => { e.preventDefault(); if (await act("/refund", { payment_id: refund.payment.id, amount_pence: penceFromPounds(refund.amount), reason: refund.reason }, "Refund issued")) setRefund(null); }}>
            <Field label="Amount (£)" htmlFor="rf-amt" hint={`Up to ${money(refund.payment.amount_pence - refund.payment.refunded_pence)}`}>
              <input id="rf-amt" type="number" step="0.01" min="0.01" className="input" value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} required />
            </Field>
            <Field label="Reason" htmlFor="rf-reason"><input id="rf-reason" className="input" value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} /></Field>
            <button className="btn btn-danger" disabled={busy}>Refund {money(penceFromPounds(refund.amount))}</button>
          </form>
        )}
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit booking details">
        {edit && <EditForm booking={edit} onSave={async (attrs) => (await act("", { booking: attrs }, "Booking updated", "PATCH")) && setEdit(null)} busy={busy} />}
      </Modal>
    </div>
  );
}

function ChangeRequestActions({ request, act }) {
  const [response, setResponse] = useState("");
  const decide = (decision) => act(`/change_requests/${request.id}`, { decision, response }, `Request ${decision}`);
  return (
    <div className="stack" style={{ marginTop: 10 }}>
      <input className="input" aria-label="Response to customer" placeholder="Response to customer (optional)" value={response} onChange={(e) => setResponse(e.target.value)} />
      <div className="row">
        <button className="btn btn-primary btn-sm" onClick={() => decide("approved")}>{request.kind === "cancellation" ? "Approve & cancel booking" : "Mark approved"}</button>
        <button className="btn btn-secondary btn-sm" onClick={() => decide("rejected")}>Reject</button>
      </div>
      {request.kind === "cancellation" && <p className="small muted" style={{ margin: 0 }}>Approving cancels the booking. Issue any refund from the Payments panel.</p>}
    </div>
  );
}

const EDIT_FIELDS = [
  ["item_description", "Item description", "text"], ["quantity", "Quantity", "number"], ["weight_kg", "Weight (kg)", "number"],
  ["length_cm", "Length (cm)", "number"], ["width_cm", "Width (cm)", "number"], ["height_cm", "Height (cm)", "number"],
  ["collection_date", "Collection date", "date"], ["estimated_delivery_date", "Est. delivery date", "date"],
  ["collection_line1", "Collection address", "text"], ["collection_city", "Collection city", "text"], ["collection_postcode", "Collection postcode", "text"],
  ["delivery_line1", "Delivery address", "text"], ["delivery_city", "Delivery city", "text"], ["delivery_postcode", "Delivery postcode", "text"],
  ["collection_phone", "Collection phone", "tel"], ["delivery_phone", "Delivery phone", "tel"],
  ["collection_instructions", "Collection access information", "text"], ["delivery_instructions", "Delivery access information", "text"],
  ["special_requirements", "Special requirements", "text"],
];

function EditForm({ booking, onSave, busy }) {
  const [form, setForm] = useState(() => Object.fromEntries(EDIT_FIELDS.map(([k]) => [k, booking[k] ?? ""]).concat([["fragile", booking.fragile]])));
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-grid">
        {EDIT_FIELDS.map(([k, label, type]) => (
          <Field key={k} label={label} htmlFor={`ed-${k}`}><input id={`ed-${k}`} type={type} step={type === "number" ? "any" : undefined} className="input" value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></Field>
        ))}
      </div>
      <label className="checkbox"><input type="checkbox" checked={!!form.fragile} onChange={(e) => setForm({ ...form, fragile: e.target.checked })} /> Fragile</label>
      <p className="small muted" style={{ margin: 0 }}>Editing doesn't change the price automatically — use Recalculate and Confirm price if needed.</p>
      <button className="btn btn-primary" disabled={busy}>Save changes</button>
    </form>
  );
}

const TASK_TONE = { unassigned: "critical", assigned: "warning", started: "accent", collected: "info", closed: "good", completed: "good", cancelled: "muted" };

/** Collection and delivery tasks for the job, with assignment and the drivers' POC / POD records. */
function DriverTasks({ booking: b, drivers, act, busy }) {
  const tasks = b.tasks || [];
  const live = (kind) => [...tasks].reverse().find((t) => t.kind === kind && t.status !== "cancelled");
  const canCreate = { collection: b.status === "booked", delivery: ["in_warehouse", "in_transit", "failed_delivery"].includes(b.status) };
  const hint = {
    collection: b.status === "quote_requested" || b.status === "awaiting_payment" ? "Mark the booking as Booked (price agreed) to assign the collection." : null,
    delivery: "Created automatically when the driver closes the collection at the warehouse.",
  };

  const block = (kind) => {
    const t = live(kind);
    const title = kind === "collection" ? "Collection task" : "Delivery task";
    return (
      <div key={kind} style={{ borderTop: kind === "delivery" ? "1px solid var(--border)" : 0, paddingTop: kind === "delivery" ? 16 : 0 }}>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <strong>{title}</strong>
          {t && <Badge tone={TASK_TONE[t.status]}>{t.status_label}</Badge>}
        </div>
        {t ? (
          <div className="stack">
            <div className="row" style={{ gap: 8 }}>
              <label className="small muted" htmlFor={`drv-${kind}`}>Driver</label>
              <select id={`drv-${kind}`} className="select" style={{ maxWidth: 240, minHeight: 38 }} value={t.driver?.id || ""} disabled={busy || !["unassigned", "assigned", "started", "collected"].includes(t.status)}
                onChange={(e) => e.target.value && act("/assign_task", { kind, driver_id: e.target.value }, t.driver ? "Task reassigned" : "Task assigned")}>
                {!t.driver && <option value="">Choose driver…</option>}
                {t.driver && !drivers.some((d) => d.id === t.driver.id) && <option value={t.driver.id}>{t.driver.name}</option>}
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {["assigned", "started"].includes(t.status) && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => window.confirm(`Remove ${t.driver?.name} from this ${kind} task?`) && act(`/tasks/${t.id}/unassign`, {}, "Task unassigned")}>Unassign</button>}
            </div>
            <div className="small muted">
              Assigned {dateTime(t.created_at)}
              {t.collected_at && ` · collected ${dateTime(t.collected_at)}`}
              {t.closed_at && ` · in warehouse ${dateTime(t.closed_at)}`}
              {t.started_at && ` · on the way ${dateTime(t.started_at)}`}
              {t.completed_at && ` · completed ${dateTime(t.completed_at)}`}
            </div>
            {t.warehouse_note && <div className="small">Warehouse note: <strong>{t.warehouse_note}</strong></div>}
            {t.proof ? (
              <div style={{ background: "var(--bg-subtle)", borderRadius: 12, padding: 14 }}>
                <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>{kind === "collection" ? "Proof of Collection (POC)" : "Proof of Delivery (POD)"}</div>
                <ProofView proof={t.proof} kind={kind} />
              </div>
            ) : <p className="small muted" style={{ margin: 0 }}>No {kind === "collection" ? "proof of collection" : "proof of delivery"} yet.</p>}
          </div>
        ) : canCreate[kind] ? (
          <div className="row">
            <select className="select" aria-label={`Driver for ${kind}`} defaultValue="" style={{ maxWidth: 240, minHeight: 38 }} disabled={busy}
              onChange={(e) => e.target.value && act("/assign_task", { kind, driver_id: e.target.value }, `${title} assigned`)}>
              <option value="">Assign to driver…</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        ) : <p className="small muted" style={{ margin: 0 }}>{hint[kind] || "Not available at this stage."}</p>}
      </div>
    );
  };

  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Driver tasks</h3>
      {block("collection")}
      {block("delivery")}
    </div>
  );
}
