import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Navigation, Phone, Mail, CheckCircle2, Warehouse, Truck, PenLine, AlertTriangle, ClipboardCheck, MapPin } from "lucide-react";
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
  collection: [["assigned", "Assigned"], ["started", "On the way"], ["arrived", "Arrived"], ["collected", "Collected"], ["closed", "At depot"]],
  delivery: [["assigned", "Assigned"], ["started", "On the way"], ["arrived", "Arrived"], ["completed", "Delivered"]],
  direct: [["assigned", "Assigned"], ["started", "On the way"], ["arrived", "At collection"], ["collected", "Collected"], ["arrived_delivery", "At delivery"], ["completed", "Delivered"]],
};
const ORDER = ["assigned", "started", "arrived", "collected", "arrived_delivery", "closed", "completed"];
const reached = (status, key) => ORDER.indexOf(status) >= ORDER.indexOf(key);

// The three proof forms and their rules (matching the server's).
const PROOFS = {
  collection: { title: "Proof of Collection", hint: "Complete this once you have the items.", person: "Handed over by", photos: "Photos of the collected items", minPhotos: 1, signature: "optional", submit: "Submit collection", notes: "e.g. number of boxes, condition, anything damaged" },
  depot: { title: "Items at the depot", hint: "Photograph the items where they're stored and get a signature from the depot.", person: "Checked in by (depot staff)", photos: "Photos of the items at the depot", minPhotos: 1, signature: "required", submit: "Confirm at depot & close task", notes: "e.g. bay or shelf location" },
  delivery: { title: "Proof of Delivery", hint: "Complete this when you hand the items over.", person: "Recipient name", photos: "Photos at delivery (at least 2)", minPhotos: 2, signature: "required", submit: "Save proof of delivery", notes: "e.g. left with neighbour at no. 12, condition on delivery" },
};

// Local date-time string for <input type="datetime-local">.
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
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

/** POC, depot or POD form. Photos and signature rules follow PROOFS. */
function ProofForm({ task, kind, defaultPerson, onSaved }) {
  const rules = PROOFS[kind];
  const existing = task.proofs?.[kind];
  const sigRef = useRef(null);
  const [form, setForm] = useState({ person_name: existing?.person_name || defaultPerson || "", occurred_at: nowLocal(), notes: existing?.notes || "" });
  const [photos, setPhotos] = useState(existing?.photos || []);
  const [signature, setSignature] = useState(existing?.signature_data || null);
  const [withSignature, setWithSignature] = useState(rules.signature === "required");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const sig = withSignature ? sigRef.current?.toDataURL() || signature : null;
    if (photos.length < rules.minPhotos) return setError(`Add at least ${rules.minPhotos} photo${rules.minPhotos > 1 ? "s" : ""}.`);
    if (rules.signature === "required" && !sig) return setError("A signature is required.");
    setBusy(true);
    const action = { collection: "collect", depot: "close", delivery: "proof" }[kind];
    const body = { ...form, occurred_at: toIso(form.occurred_at), photos, signature_data: sig, ...(kind === "depot" ? { note: form.notes } : {}) };
    try {
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
      {rules.signature === "optional" && (
        <label className="checkbox"><input type="checkbox" checked={withSignature} onChange={(e) => setWithSignature(e.target.checked)} /> Add a signature</label>
      )}
      {withSignature && (
        <div className="field">
          <div className="row-between"><span className="label">Signature{rules.signature === "required" ? "" : " (optional)"}</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => { sigRef.current?.clear(); setSignature(null); }}>Clear</button></div>
          {signature && !sigRef.current?.toDataURL() ? <img src={signature} alt="Saved signature" className="sig-pad" style={{ objectFit: "contain", background: "#fff" }} onClick={() => setSignature(null)} /> : <SignaturePad ref={sigRef} onChange={setSignature} />}
        </div>
      )}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}><CheckCircle2 size={18} /> {busy ? "Saving…" : existing && kind === "delivery" ? "Update proof of delivery" : rules.submit}</button>
    </form>
  );
}

export default function Task() {
  const { id } = useParams();
  const toast = useToast();
  const { data: task, loading, error, setData } = useApi(`/driver/tasks/${id}`);
  const [busy, setBusy] = useState(false);
  const [editingPod, setEditingPod] = useState(false);
  const [issue, setIssue] = useState(null);

  if (loading && !task) return <Spinner />;
  if (error) return <Alert type="error">{error.status === 404 ? "This task isn't assigned to you." : error.message}</Alert>;

  const run = async (action, message) => {
    setBusy(true);
    try {
      setData(await api(`/driver/tasks/${task.id}/${action}`, { method: "POST" }));
      toast(message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const saved = (message) => (t) => { setData(t); setEditingPod(false); toast(message); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const { kind, status } = task;
  const pod = task.proofs?.delivery;
  const atDelivery = (kind === "delivery" && status === "arrived") || (kind === "direct" && status === "arrived_delivery");
  const side = task.current_side;

  // The one thing the driver should do next.
  let next = null;
  if (status === "assigned") {
    next = <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => run("start", kind === "delivery" ? "Customer told you're on the way" : "Task started")}><Truck size={18} /> Start – I'm on my way</button>;
  } else if (status === "started") {
    next = <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => run("arrive", "Arrival recorded")}><MapPin size={18} /> I've arrived at the {side} address</button>;
  } else if (status === "arrived" && kind !== "delivery") {
    next = <ProofForm task={task} kind="collection" defaultPerson={task.collection?.contact_name} onSaved={saved("Collection recorded")} />;
  } else if (status === "collected" && kind === "collection") {
    next = <ProofForm task={task} kind="depot" defaultPerson="" onSaved={saved("Items checked in at the depot – task closed")} />;
  } else if (status === "collected" && kind === "direct") {
    next = <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => run("arrive_delivery", "Arrival recorded")}><MapPin size={18} /> I've arrived at the delivery address</button>;
  } else if (atDelivery) {
    next = pod && !editingPod ? (
      <div className="card stack">
        <Alert type="success" title="Proof of delivery saved">Check the details below, then close the task.</Alert>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => run("complete", "Delivery completed – task closed")}><CheckCircle2 size={18} /> Close task – delivery completed</button>
        <div className="row-between"><h3 style={{ margin: 0 }}>Proof of Delivery</h3><button className="btn btn-ghost btn-sm" onClick={() => setEditingPod(true)}><PenLine size={14} /> Edit</button></div>
        <ProofView proof={pod} kind="delivery" />
      </div>
    ) : <ProofForm task={task} kind="delivery" defaultPerson={task.delivery?.contact_name} onSaved={saved("Proof of delivery saved")} />;
  }

  const finished = ["closed", "completed"].includes(status);
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

      {status === "closed" && <Alert type="success" title="At depot – task closed">The delivery has been set up as a separate task.</Alert>}
      {status === "completed" && <Alert type="success" title="Delivery completed">The proof of delivery has been saved to the job.</Alert>}
      {status === "cancelled" && <Alert type="warning" title="Task cancelled">This task was cancelled by the office.</Alert>}

      {next}

      {kind !== "delivery" && task.collection && <Stop stop={task.collection} title="Collect from" active={!finished && side === "collection"} />}
      {kind !== "collection" && task.delivery && <Stop stop={task.delivery} title="Deliver to" active={!finished && side === "delivery"} />}
      <Items task={task} />

      {["collection", "depot", "delivery"].filter((k) => task.proofs?.[k] && !(k === "delivery" && atDelivery)).map((k) => (
        <div key={k} className="card"><h3>{PROOFS[k].title}</h3><ProofView proof={task.proofs[k]} kind={k} /></div>
      ))}

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
