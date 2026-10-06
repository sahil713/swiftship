import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Navigation, Phone, Mail, CheckCircle2, Warehouse, Truck, PenLine, AlertTriangle, ClipboardCheck, MapPin, Lock } from "lucide-react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { date } from "../../lib/format.js";
import { Alert, Badge, Field, Modal, Spinner } from "../../components/ui.jsx";
import SignaturePad from "../../components/SignaturePad.jsx";
import PhotoPicker from "../../components/PhotoPicker.jsx";
import ProofView from "../../components/ProofView.jsx";
import { useToast } from "../../components/Toast.jsx";
import { TaskKind } from "./Tasks.jsx";

// Progress shown at the top of the task, per task type.
const STEPS = {
  collection: [["assigned", "Assigned"], ["started", "Started"], ["arrived", "Arrived"], ["collected", "Collected"], ["at_depot", "At depot"], ["closed", "Closed"]],
  delivery: [["assigned", "Assigned"], ["started", "Started"], ["arrived_delivery", "Arrived"], ["delivered", "Delivered"], ["closed", "Closed"]],
  direct: [["assigned", "Assigned"], ["started", "Started"], ["arrived", "At collection"], ["collected", "Collected"], ["arrived_delivery", "At delivery"], ["delivered", "Delivered"], ["closed", "Closed"]],
};
const ORDER = ["assigned", "started", "arrived", "collected", "at_depot", "arrived_delivery", "delivered", "closed", "completed"];
const reached = (status, key) => ORDER.indexOf(status) >= ORDER.indexOf(key);

// Proof forms and their rules (matching the server's).
const PROOFS = {
  collection: { title: "Proof of Collection", hint: "Photograph the items and get the customer's signature.", person: "Handed over by", photos: "Photos of the items collected", minPhotos: 1, submit: "Save collection proof", notes: "e.g. number of boxes, condition, anything damaged" },
  depot: { title: "Depot drop-off", hint: "Record where the items are stored, photograph them and get a signature from the depot.", person: "Received by (depot staff)", photos: "Photos of the items at the depot", minPhotos: 1, submit: "Save depot record", notes: "e.g. shelf or bay, anything to note", location: "Depot name / location" },
  delivery: { title: "Proof of Delivery", hint: "Take at least 2 photos and get the recipient's signature.", person: "Recipient name", photos: "Delivery photos (at least 2)", minPhotos: 2, submit: "Save proof of delivery", notes: "e.g. left with neighbour at no. 12, condition on delivery" },
};

// The phone's position for the step being recorded, if the driver allows location access.
function currentPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy_m: Math.round(p.coords.accuracy) }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  });
}

// Local date-time string for <input type="datetime-local">.
const toLocalInput = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
const toIso = (local) => (local ? new Date(local).toISOString() : undefined);

/** Address, contact and access details for one stop. */
function Stop({ stop, title, active }) {
  const a = stop.address;
  const address = [a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(", ");
  return (
    <section className="card stack" style={active ? { borderColor: "var(--accent)", borderWidth: 2 } : { opacity: 0.85 }}>
      <div className="row-between">
        <div className="small muted"><MapPin size={14} style={{ display: "inline", verticalAlign: -2 }} /> {title}</div>
        {active && <Badge tone="accent" plain>Current stop</Badge>}
      </div>
      <div style={{ fontSize: "1.1rem", fontWeight: 700, lineHeight: 1.35 }}>{a.line1}{a.line2 && <><br />{a.line2}</>}<br />{a.city} <span className="mono">{a.postcode}</span></div>
      <dl className="detail-list">
        <div><dt>Contact</dt><dd>{stop.contact_name}</dd></div>
        <div><dt>Phone</dt><dd><a href={`tel:${stop.contact_phone}`}>{stop.contact_phone}</a></dd></div>
        {stop.contact_email && <div><dt>Email</dt><dd><a href={`mailto:${stop.contact_email}`}><Mail size={13} style={{ display: "inline", verticalAlign: -2 }} /> {stop.contact_email}</a></dd></div>}
      </dl>
      {stop.instructions && <Alert type="warning" title="Access information">{stop.instructions}</Alert>}
      {active && (
        <div className="big-actions">
          <a className="btn btn-primary btn-lg" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer"><Navigation size={18} /> Navigate</a>
          <a className="btn btn-secondary btn-lg" href={`tel:${stop.contact_phone}`}><Phone size={18} /> Call</a>
        </div>
      )}
    </section>
  );
}

function Items({ task }) {
  const it = task.item;
  const dims = it.length_cm && it.width_cm && it.height_cm ? `${it.length_cm} × ${it.width_cm} × ${it.height_cm} cm` : null;
  return (
    <section className="card">
      <h3>Items</h3>
      <dl className="detail-list">
        <div><dt>Item</dt><dd>{it.description}</dd></div>
        <div><dt>Quantity</dt><dd>{it.quantity}</dd></div>
        <div><dt>Weight</dt><dd>{it.weight_kg ? `${it.weight_kg} kg each` : "Not given"}</dd></div>
        <div><dt>Dimensions</dt><dd>{dims || "Not given"}</dd></div>
        {it.fragile && <div><dt>Handling</dt><dd><Badge tone="warning">Fragile</Badge></dd></div>}
        {task.date && <div><dt>Date</dt><dd>{date(task.date, { weekday: "short", day: "numeric", month: "short" })}</dd></div>}
      </dl>
      {task.special_requirements && <div style={{ marginTop: 14 }}><Alert type="info" title="Special requirements">{task.special_requirements}</Alert></div>}
    </section>
  );
}

/** Collection, depot or delivery proof form. Saving again before the stage is completed corrects it. */
function ProofForm({ task, kind, defaultPerson, onSaved, onCancel }) {
  const rules = PROOFS[kind];
  const existing = task.proofs?.[kind];
  const signatureRequired = kind === "collection" ? task.collection_signature_required !== false : true;
  const sigRef = useRef(null);
  const [form, setForm] = useState({
    person_name: existing?.person_name || defaultPerson || "",
    occurred_at: toLocalInput(existing?.occurred_at || new Date()),
    notes: existing?.notes || "",
    location: existing?.location || (kind === "depot" ? "Main depot" : ""),
  });
  const [photos, setPhotos] = useState(existing?.photos || []);
  const [signature, setSignature] = useState(existing?.signature_data || null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const sig = sigRef.current?.toDataURL() || signature;
    if (photos.length < rules.minPhotos) return setError(`Add at least ${rules.minPhotos} photo${rules.minPhotos > 1 ? "s" : ""}.`);
    if (signatureRequired && !sig) return setError("A signature is required.");
    setBusy(true);
    const action = { collection: "collect", depot: "depot", delivery: "proof" }[kind];
    try {
      const geo = await currentPosition();
      const body = { ...form, location: kind === "depot" ? form.location : undefined, occurred_at: toIso(form.occurred_at), photos, signature_data: sig, geo };
      onSaved(await api(`/driver/tasks/${task.id}/${action}`, { method: "POST", body }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit} style={{ borderColor: "var(--accent)", borderWidth: 2 }}>
      <div>
        <h3 style={{ margin: 0 }}>{kind === "depot" ? <Warehouse size={20} style={{ display: "inline", verticalAlign: -4 }} /> : <ClipboardCheck size={20} style={{ display: "inline", verticalAlign: -4 }} />} {rules.title}</h3>
        <p className="small muted" style={{ margin: "4px 0 0" }}>{rules.hint}</p>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      {kind === "depot" && (
        <Field label={rules.location} htmlFor="pf-location"><input id="pf-location" className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required /></Field>
      )}
      <Field label={rules.person} htmlFor={`pf-name-${kind}`}>
        <input id={`pf-name-${kind}`} className="input" value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} required autoComplete="off" />
      </Field>
      <Field label="Date & time" htmlFor={`pf-time-${kind}`}>
        <input id={`pf-time-${kind}`} type="datetime-local" className="input" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} required />
      </Field>
      <PhotoPicker photos={photos} onChange={setPhotos} required label={rules.photos} />
      <Field label="Notes (optional)" htmlFor={`pf-notes-${kind}`} hint={rules.notes}>
        <textarea id={`pf-notes-${kind}`} className="textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
      <div className="field">
        <div className="row-between">
          <span className="label">Signature{signatureRequired ? "" : " (optional)"}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { sigRef.current?.clear(); setSignature(null); }}>Clear</button>
        </div>
        {signature && !sigRef.current?.toDataURL() ? <img src={signature} alt="Saved signature – tap to sign again" className="sig-pad" style={{ objectFit: "contain", background: "#fff" }} onClick={() => setSignature(null)} /> : <SignaturePad ref={sigRef} onChange={setSignature} />}
        <span className="hint">Sign with a finger. Tap a saved signature to sign again.</span>
      </div>
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}><CheckCircle2 size={18} /> {busy ? "Saving…" : existing ? `Update ${rules.title.toLowerCase()}` : rules.submit}</button>
      {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
    </form>
  );
}

/** A saved proof with the stage's confirm button (and an edit link while the stage is still open). */
function SavedProof({ kind, proof, confirmLabel, onConfirm, onEdit, busy, note }) {
  return (
    <div className="card stack">
      <Alert type="success" title={`${PROOFS[kind].title} saved`}>{note || "Check the details below, then confirm."}</Alert>
      {onConfirm && <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={onConfirm}><CheckCircle2 size={18} /> {confirmLabel}</button>}
      <div className="row-between">
        <h3 style={{ margin: 0 }}>{PROOFS[kind].title}</h3>
        {onEdit && <button className="btn btn-ghost btn-sm" onClick={onEdit}><PenLine size={14} /> Edit</button>}
      </div>
      <ProofView proof={proof} kind={kind} />
    </div>
  );
}

export default function Task() {
  const { id } = useParams();
  const toast = useToast();
  const { data: task, loading, error, setData } = useApi(`/driver/tasks/${id}`);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [issue, setIssue] = useState(null);

  if (loading && !task) return <Spinner />;
  if (error) return <Alert type="error">{error.status === 404 ? "This task isn't assigned to you." : error.message}</Alert>;

  const run = async (action, message) => {
    setBusy(true);
    try {
      const geo = await currentPosition();
      setData(await api(`/driver/tasks/${task.id}/${action}`, { method: "POST", body: { geo } }));
      toast(message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const saved = (message) => (t) => { setData(t); setEditing(null); toast(message); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const { kind, status, proofs = {} } = task;
  const side = task.current_side;
  const atDelivery = status === "arrived_delivery" || (kind === "delivery" && status === "arrived");

  // The one thing the driver should do next.
  let next = null;
  if (status === "assigned") {
    next = <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => run("start", "Task started")}><Truck size={18} /> Start task</button>;
  } else if (status === "started") {
    next = <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => run("arrive", "Arrival recorded")}><MapPin size={18} /> Arrived at {side} location</button>;
  } else if (status === "arrived" && kind !== "delivery") {
    next = proofs.collection && editing !== "collection"
      ? <SavedProof kind="collection" proof={proofs.collection} confirmLabel="Collection completed" busy={busy} onConfirm={() => run("complete_collection", "Collection completed")} onEdit={() => setEditing("collection")} />
      : <ProofForm task={task} kind="collection" defaultPerson={task.collection?.contact_name} onSaved={saved("Collection proof saved")} onCancel={proofs.collection ? () => setEditing(null) : null} />;
  } else if (status === "collected" && kind === "collection") {
    next = <ProofForm task={task} kind="depot" defaultPerson="" onSaved={saved("Depot drop-off recorded")} />;
  } else if (status === "at_depot") {
    next = editing === "depot"
      ? <ProofForm task={task} kind="depot" onSaved={saved("Depot record updated")} onCancel={() => setEditing(null)} />
      : <SavedProof kind="depot" proof={proofs.depot} confirmLabel="Close task" busy={busy} note="The items are recorded at the depot. Close the task to finish." onConfirm={() => run("close", "Task closed")} onEdit={() => setEditing("depot")} />;
  } else if (status === "collected" && kind === "direct") {
    next = <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => run("arrive_delivery", "Arrival recorded")}><MapPin size={18} /> Arrived at delivery location</button>;
  } else if (atDelivery) {
    next = proofs.delivery && editing !== "delivery"
      ? <SavedProof kind="delivery" proof={proofs.delivery} confirmLabel="Delivery completed" busy={busy} onConfirm={() => run("complete", "Delivery completed")} onEdit={() => setEditing("delivery")} />
      : <ProofForm task={task} kind="delivery" defaultPerson={task.delivery?.contact_name} onSaved={saved("Proof of delivery saved")} onCancel={proofs.delivery ? () => setEditing(null) : null} />;
  } else if (status === "delivered") {
    next = (
      <div className="card stack">
        <Alert type="success" title="Delivery completed">Close the task to finish. We'll check everything has been recorded.</Alert>
        {task.missing_for_close?.length > 0 && <Alert type="warning" title="Still needed">{task.missing_for_close.join(", ")}</Alert>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => run("close", "Task closed")}><Lock size={18} /> Close task</button>
      </div>
    );
  }

  const finished = ["closed", "completed"].includes(status);
  const shownProofs = ["collection", "depot", "delivery"].filter((k) => proofs[k] && !(next && ((k === "collection" && status === "arrived") || (k === "delivery" && atDelivery) || (k === "depot" && status === "at_depot"))));
  return (
    <div className="stack" style={{ maxWidth: 680 }}>
      <Link to="/driver" className="small row" style={{ gap: 4 }}><ArrowLeft size={14} /> My tasks</Link>
      <div>
        <div className="row-between"><TaskKind kind={kind} /><span className="small mono muted">{task.reference}</span></div>
        <h1 style={{ margin: "10px 0 4px", fontSize: "1.5rem" }}>{task.status_label}</h1>
        <ol className="task-steps" aria-label="Task progress">
          {STEPS[kind].map(([key, label]) => <li key={key} className={reached(status, key) ? "done" : ""}>{label}</li>)}
        </ol>
      </div>

      {finished && <Alert type="success" title="Task closed">{kind === "collection" ? "The delivery has been set up as a separate task." : "All proof has been saved to the job. Thank you."}</Alert>}
      {status === "cancelled" && <Alert type="warning" title="Task cancelled">This task was cancelled by the office.</Alert>}

      {next}

      {kind !== "delivery" && task.collection && <Stop stop={task.collection} title="Collect from" active={!finished && side === "collection"} />}
      {kind !== "collection" && task.delivery && <Stop stop={task.delivery} title="Deliver to" active={!finished && side === "delivery"} />}
      <Items task={task} />

      {shownProofs.map((k) => <div key={k} className="card"><h3>{PROOFS[k].title}</h3><ProofView proof={proofs[k]} kind={k} /></div>)}

      {!finished && status !== "cancelled" && (
        <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={() => setIssue({ body: "", mark_exception: false })}><AlertTriangle size={16} /> Report a problem</button>
      )}

      <Modal open={!!issue} onClose={() => setIssue(null)} title="Report a problem">
        {issue && (
          <form className="stack" onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try { setData(await api(`/driver/tasks/${task.id}/report_issue`, { method: "POST", body: issue })); toast("Problem reported to the office"); setIssue(null); }
            catch (err) { toast(err.message, "error"); }
            finally { setBusy(false); }
          }}>
            <Field label="What's the problem?" htmlFor="is-body" hint="This goes to the office">
              <textarea id="is-body" className="textarea" value={issue.body} onChange={(e) => setIssue({ ...issue, body: e.target.value })} required />
            </Field>
            <label className="checkbox"><input type="checkbox" checked={issue.mark_exception} onChange={(e) => setIssue({ ...issue, mark_exception: e.target.checked })} /> Flag the job as having a problem (customer is told)</label>
            <button className="btn btn-primary" disabled={busy}>Send to office</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
