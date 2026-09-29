import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Navigation, Phone, PenLine, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { dateTime, STATUS_LABELS } from "../../lib/format.js";
import { compressImage } from "../../lib/image.js";
import { Alert, Badge, Field, Modal, Spinner, StatusBadge } from "../../components/ui.jsx";
import { EventTimeline } from "../../components/StatusTimeline.jsx";
import SignaturePad from "../../components/SignaturePad.jsx";
import { useToast } from "../../components/Toast.jsx";

const ISSUE_KINDS = { collection_issue: "Collection problem", delivery_issue: "Delivery problem", damage: "Item damaged" };

function ProofOfDelivery({ job, onDone }) {
  const sigRef = useRef(null);
  const [recipient, setRecipient] = useState(job.delivery_contact_name || "");
  const [signature, setSignature] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await compressImage(file));
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const sig = sigRef.current?.toDataURL() || signature;
    if (!sig && !photo) return setError("Capture a signature or take a photo.");
    setBusy(true);
    try {
      onDone(await api(`/driver/jobs/${job.reference}/proof_of_delivery`, { method: "POST", body: { recipient_name: recipient, signature_data: sig, photo_data: photo, notes, location: job.delivery_city } }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit} style={{ borderColor: "var(--accent)", borderWidth: 2 }}>
      <h3 style={{ margin: 0 }}><PenLine size={18} style={{ display: "inline", verticalAlign: -3 }} /> Proof of delivery</h3>
      {error && <Alert type="error">{error}</Alert>}
      <Field label="Received by" htmlFor="pod-name"><input id="pod-name" className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} required /></Field>
      <div className="field">
        <div className="row-between"><span className="label">Signature</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => sigRef.current.clear()}>Clear</button></div>
        <SignaturePad ref={sigRef} onChange={setSignature} />
      </div>
      <div className="field">
        <span className="label">Photo (optional if signed)</span>
        <label className="btn btn-secondary" style={{ alignSelf: "flex-start" }}>
          <Camera size={16} /> {photo ? "Retake photo" : "Take photo"}
          <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="sr-only" />
        </label>
        {photo && <img src={photo} alt="Delivery photo preview" className="photo-preview" />}
      </div>
      <Field label="Notes (optional)" htmlFor="pod-notes" hint="e.g. Left with neighbour at no. 12"><input id="pod-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <button className="btn btn-primary btn-lg" disabled={busy}><CheckCircle2 size={18} /> {busy ? "Saving…" : "Complete delivery"}</button>
    </form>
  );
}

export default function Job() {
  const { reference } = useParams();
  const toast = useToast();
  const { data: job, loading, error, setData } = useApi(`/driver/jobs/${reference}`);
  const [pending, setPending] = useState(null);
  const [note, setNote] = useState("");
  const [issue, setIssue] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading && !job) return <Spinner />;
  if (error) return <Alert type="error">{error.message}</Alert>;

  const needsNote = (s) => ["exception", "failed_delivery"].includes(s);
  const updateStatus = async (status) => {
    setBusy(true);
    try {
      setData(await api(`/driver/jobs/${reference}/status`, { method: "POST", body: { status, note: note || undefined } }));
      toast(`Marked as ${STATUS_LABELS[status].toLowerCase()}`);
      setPending(null);
      setNote("");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const submitIssue = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      setData(await api(`/driver/jobs/${reference}/report_issue`, { method: "POST", body: issue }));
      toast("Issue reported to the office");
      setIssue(null);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const collecting = job.stage === "collection";
  const p = collecting ? "collection" : "delivery";
  const address = [job[`${p}_line1`], job[`${p}_line2`], job[`${p}_city`], job[`${p}_postcode`]].filter(Boolean).join(", ");
  const statusButtons = job.allowed_statuses.filter((s) => s !== "delivered");

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <Link to="/driver" className="small row" style={{ gap: 4 }}><ArrowLeft size={14} /> All jobs</Link>
      <div className="row-between">
        <div><h1 className="mono" style={{ margin: 0, fontSize: "1.4rem" }}>{job.reference}</h1><div className="small muted">{job.service.name} · {job.quantity} × {job.item_description}</div></div>
        <div className="row"><StatusBadge status={job.status} />{job.fragile && <Badge tone="warning">Fragile</Badge>}</div>
      </div>

      <div className="card">
        <div className="small muted">{collecting ? "Collect from" : "Deliver to"}</div>
        <h2 style={{ fontSize: "1.3rem", margin: "4px 0" }}>{job[`${p}_contact_name`]}</h2>
        <p style={{ marginBottom: 12 }}>{address}</p>
        {job[`${p}_instructions`] && <Alert type="warning">{job[`${p}_instructions`]}</Alert>}
        <div className="big-actions" style={{ marginTop: 12 }}>
          <a className="btn btn-secondary" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer"><Navigation size={16} /> Navigate</a>
          <a className="btn btn-secondary" href={`tel:${job[`${p}_phone`]}`}><Phone size={16} /> Call {job[`${p}_contact_name`].split(" ")[0]}</a>
        </div>
      </div>

      {statusButtons.length > 0 && (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Update status</h3>
          <div className="big-actions">
            {statusButtons.map((s) => (
              <button key={s} className={`btn btn-lg ${needsNote(s) ? "btn-danger" : "btn-primary"}`} disabled={busy} onClick={() => (needsNote(s) ? setPending(s) : updateStatus(s))}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setIssue({ kind: collecting ? "collection_issue" : "delivery_issue", body: "", mark_exception: false, customer_note: "" })}>
            <AlertTriangle size={14} /> Report an issue
          </button>
        </div>
      )}

      {job.status === "out_for_delivery" && !job.proof_of_delivery && <ProofOfDelivery job={job} onDone={(j) => { setData(j); toast("Delivery completed"); }} />}

      {job.proof_of_delivery && (
        <Alert type="success" title="Delivered">Signed for by {job.proof_of_delivery.recipient_name} at {dateTime(job.proof_of_delivery.created_at)}.</Alert>
      )}

      {job.notes.length > 0 && (
        <div className="card">
          <h3>Notes</h3>
          {job.notes.map((n) => <p key={n.id} className="small"><strong>{n.author}</strong> · {dateTime(n.created_at)}<br />{n.body}</p>)}
        </div>
      )}

      <div className="card"><h3>History</h3><EventTimeline events={job.events} showBy /></div>

      <Modal open={!!pending} onClose={() => setPending(null)} title={STATUS_LABELS[pending] || ""}>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); updateStatus(pending); }}>
          <Field label="What happened?" htmlFor="ex-note" hint="This note is shown to the customer"><textarea id="ex-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} required /></Field>
          <button className="btn btn-danger" disabled={busy}>Confirm</button>
        </form>
      </Modal>

      <Modal open={!!issue} onClose={() => setIssue(null)} title="Report an issue">
        {issue && (
          <form className="stack" onSubmit={submitIssue}>
            <Field label="Type" htmlFor="is-kind"><select id="is-kind" className="select" value={issue.kind} onChange={(e) => setIssue({ ...issue, kind: e.target.value })}>{Object.entries(ISSUE_KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Details for the office" htmlFor="is-body"><textarea id="is-body" className="textarea" value={issue.body} onChange={(e) => setIssue({ ...issue, body: e.target.value })} required /></Field>
            <label className="checkbox"><input type="checkbox" checked={issue.mark_exception} onChange={(e) => setIssue({ ...issue, mark_exception: e.target.checked })} /> Mark the shipment as an exception (customer is notified)</label>
            {issue.mark_exception && <Field label="Message to customer" htmlFor="is-cust"><input id="is-cust" className="input" value={issue.customer_note} onChange={(e) => setIssue({ ...issue, customer_note: e.target.value })} placeholder="We've recorded an issue with your shipment." /></Field>}
            <button className="btn btn-primary" disabled={busy}>Send report</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
