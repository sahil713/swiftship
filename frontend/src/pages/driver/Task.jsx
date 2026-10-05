import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Navigation, Phone, Mail, CheckCircle2, Warehouse, Truck, PenLine, AlertTriangle, ClipboardCheck } from "lucide-react";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { date } from "../../lib/format.js";
import { Alert, Badge, Field, Modal, Spinner } from "../../components/ui.jsx";
import SignaturePad from "../../components/SignaturePad.jsx";
import PhotoPicker from "../../components/PhotoPicker.jsx";
import ProofView from "../../components/ProofView.jsx";
import { useToast } from "../../components/Toast.jsx";
import { TaskKind } from "./Tasks.jsx";

const STEPS = {
  collection: [["assigned", "Assigned"], ["started", "In progress"], ["collected", "Collected"], ["closed", "At warehouse"]],
  delivery: [["assigned", "Assigned"], ["started", "Out for delivery"], ["completed", "Completed"]],
};
const ORDER = {
  collection: { assigned: 0, started: 1, collected: 2, closed: 3 },
  delivery: { assigned: 0, started: 1, completed: 2 },
};

// Local date-time string for <input type="datetime-local">.
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const toIso = (local) => (local ? new Date(local).toISOString() : undefined);

function Details({ task }) {
  const a = task.address;
  const address = [a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(", ");
  const it = task.item;
  const dims = it.length_cm && it.width_cm && it.height_cm ? `${it.length_cm} × ${it.width_cm} × ${it.height_cm} cm` : null;
  const isCollection = task.kind === "collection";
  return (
    <>
      <section className="card stack">
        <div className="small muted">{isCollection ? "Collection address" : "Delivery address"}</div>
        <div style={{ fontSize: "1.15rem", fontWeight: 700, lineHeight: 1.35 }}>{a.line1}{a.line2 && <><br />{a.line2}</>}<br />{a.city} <span className="mono">{a.postcode}</span></div>
        <div className="big-actions">
          <a className="btn btn-primary btn-lg" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer"><Navigation size={18} /> Navigate</a>
          <a className="btn btn-secondary btn-lg" href={`tel:${task.contact_phone}`}><Phone size={18} /> Call</a>
        </div>
      </section>

      <section className="card">
        <h3>{isCollection ? "Customer" : "Recipient"}</h3>
        <dl className="detail-list">
          <div><dt>Name</dt><dd>{task.contact_name}</dd></div>
          <div><dt>Phone</dt><dd><a href={`tel:${task.contact_phone}`}>{task.contact_phone}</a></dd></div>
          {task.contact_email && <div><dt>Email</dt><dd><a href={`mailto:${task.contact_email}`}><Mail size={13} style={{ display: "inline", verticalAlign: -2 }} /> {task.contact_email}</a></dd></div>}
          {task.date && <div><dt>{isCollection ? "Collection date" : "Due"}</dt><dd>{date(task.date, { weekday: "short", day: "numeric", month: "short" })}</dd></div>}
        </dl>
      </section>

      <section className="card">
        <h3>Items</h3>
        <dl className="detail-list">
          <div><dt>Item</dt><dd>{it.description}</dd></div>
          <div><dt>Quantity</dt><dd>{it.quantity}</dd></div>
          <div><dt>Weight</dt><dd>{it.weight_kg ? `${it.weight_kg} kg each` : "Not given"}</dd></div>
          <div><dt>Dimensions</dt><dd>{dims || "Not given"}</dd></div>
          {it.fragile && <div><dt>Handling</dt><dd><Badge tone="warning">Fragile</Badge></dd></div>}
        </dl>
        {(task.instructions || task.special_requirements) && (
          <div className="stack" style={{ marginTop: 14 }}>
            {task.instructions && <Alert type="warning" title={isCollection ? "Access / collection instructions" : "Access / delivery instructions"}>{task.instructions}</Alert>}
            {task.special_requirements && <Alert type="info" title="Special requirements">{task.special_requirements}</Alert>}
          </div>
        )}
      </section>
    </>
  );
}

/** POC or POD form. Collection: photo required, signature optional. Delivery: photo and signature required. */
function ProofForm({ task, onSaved }) {
  const isCollection = task.kind === "collection";
  const existing = task.proof;
  const sigRef = useRef(null);
  const [form, setForm] = useState({
    person_name: existing?.person_name || task.contact_name || "",
    occurred_at: nowLocal(),
    notes: existing?.notes || "",
  });
  const [photos, setPhotos] = useState(existing?.photos || []);
  const [signature, setSignature] = useState(existing?.signature_data || null);
  const [withSignature, setWithSignature] = useState(!isCollection);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const sig = withSignature ? sigRef.current?.toDataURL() || signature : null;
    if (!photos.length) return setError("Add at least one photo.");
    if (!isCollection && !sig) return setError("Ask the recipient to sign.");
    setBusy(true);
    try {
      const body = { ...form, occurred_at: toIso(form.occurred_at), photos, signature_data: sig };
      onSaved(await api(`/driver/tasks/${task.id}/${isCollection ? "collect" : "proof"}`, { method: "POST", body }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit} style={{ borderColor: "var(--accent)", borderWidth: 2 }}>
      <div>
        <h3 style={{ margin: 0 }}><ClipboardCheck size={20} style={{ display: "inline", verticalAlign: -4 }} /> {isCollection ? "Proof of Collection" : "Proof of Delivery"}</h3>
        <p className="small muted" style={{ margin: "4px 0 0" }}>{isCollection ? "Complete this once you have the items." : "Complete this when you hand the items over."}</p>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      <Field label={isCollection ? "Handed over by" : "Recipient name"} htmlFor="pf-name">
        <input id="pf-name" className="input" value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} required autoComplete="off" />
      </Field>
      <Field label="Date & time" htmlFor="pf-time">
        <input id="pf-time" type="datetime-local" className="input" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} required />
      </Field>
      <PhotoPicker photos={photos} onChange={setPhotos} required label={isCollection ? "Photos of the collected items" : "Photos at delivery"} />
      <Field label="Notes (optional)" htmlFor="pf-notes" hint={isCollection ? "e.g. number of boxes, condition, anything damaged" : "e.g. left with neighbour at no. 12, condition on delivery"}>
        <textarea id="pf-notes" className="textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
      {isCollection && (
        <label className="checkbox"><input type="checkbox" checked={withSignature} onChange={(e) => setWithSignature(e.target.checked)} /> Add the customer's signature</label>
      )}
      {withSignature && (
        <div className="field">
          <div className="row-between"><span className="label">{isCollection ? "Customer signature" : "Recipient signature"}</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => { sigRef.current?.clear(); setSignature(null); }}>Clear</button></div>
          {signature && !sigRef.current?.toDataURL() ? <img src={signature} alt="Saved signature" className="sig-pad" style={{ objectFit: "contain", background: "#fff" }} onClick={() => setSignature(null)} /> : <SignaturePad ref={sigRef} onChange={setSignature} />}
        </div>
      )}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
        <CheckCircle2 size={18} /> {busy ? "Saving…" : isCollection ? "Submit collection" : existing ? "Update proof of delivery" : "Save proof of delivery"}
      </button>
    </form>
  );
}

export default function Task() {
  const { id } = useParams();
  const toast = useToast();
  const { data: task, loading, error, setData } = useApi(`/driver/tasks/${id}`);
  const [warehouseNote, setWarehouseNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingProof, setEditingProof] = useState(false);
  const [issue, setIssue] = useState(null);

  if (loading && !task) return <Spinner />;
  if (error) return <Alert type="error">{error.status === 404 ? "This task isn't assigned to you." : error.message}</Alert>;

  const isCollection = task.kind === "collection";
  const run = async (action, body, message) => {
    setBusy(true);
    try {
      setData(await api(`/driver/tasks/${task.id}/${action}`, { method: "POST", body }));
      toast(message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const proofSaved = (t) => { setData(t); setEditingProof(false); toast(isCollection ? "Collection recorded" : "Proof of delivery saved"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const podComplete = !!(task.proof && task.proof.signature_data && task.proof.photos?.length && task.proof.person_name);
  const steps = STEPS[task.kind];

  return (
    <div className="stack" style={{ maxWidth: 680 }}>
      <Link to="/driver" className="small row" style={{ gap: 4 }}><ArrowLeft size={14} /> My tasks</Link>
      <div>
        <div className="row-between">
          <TaskKind kind={task.kind} />
          <span className="small mono muted">{task.reference}</span>
        </div>
        <h1 style={{ margin: "10px 0 8px", fontSize: "1.5rem" }}>{task.contact_name}</h1>
        <ol className="task-steps" aria-label="Task progress">
          {steps.map(([key, label]) => <li key={key} className={(ORDER[task.kind][task.status] ?? -1) >= ORDER[task.kind][key] ? "done" : ""}>{label}</li>)}
        </ol>
      </div>

      {/* Status banners */}
      {task.status === "collected" && <Alert type="success" title="Items collected">Take the items to the warehouse, then confirm below to close this task.</Alert>}
      {task.status === "closed" && <Alert type="success" title="At warehouse – task closed">The delivery has been set up as a separate task.</Alert>}
      {task.status === "completed" && <Alert type="success" title="Delivery completed">Thanks – the proof of delivery has been saved to the job.</Alert>}
      {task.status === "cancelled" && <Alert type="warning" title="Task cancelled">This task was cancelled by the office.</Alert>}

      {/* Next action */}
      {isCollection && task.status === "assigned" && (
        <button className="btn btn-secondary btn-lg btn-block" disabled={busy} onClick={() => run("start", undefined, "Collection started")}>
          <Truck size={18} /> Start collection (I'm on my way)
        </button>
      )}
      {isCollection && ["assigned", "started"].includes(task.status) && <ProofForm task={task} onSaved={proofSaved} />}

      {isCollection && task.status === "collected" && (
        <div className="card stack">
          <h3 style={{ margin: 0 }}><Warehouse size={20} style={{ display: "inline", verticalAlign: -4 }} /> Delivered to the warehouse?</h3>
          <Field label="Warehouse note (optional)" htmlFor="wh-note" hint="e.g. bay or shelf location">
            <input id="wh-note" className="input" value={warehouseNote} onChange={(e) => setWarehouseNote(e.target.value)} />
          </Field>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => run("close", { note: warehouseNote }, "Task closed – items in warehouse")}>
            <CheckCircle2 size={18} /> Confirm in warehouse & close task
          </button>
        </div>
      )}

      {!isCollection && ["assigned", "started"].includes(task.status) && (
        <>
          {task.status === "assigned" && (
            <button className="btn btn-secondary btn-lg btn-block" disabled={busy} onClick={() => run("start", undefined, "Customer notified you're on the way")}>
              <Truck size={18} /> Start delivery (I'm on my way)
            </button>
          )}
          {podComplete && !editingProof ? (
            <div className="card stack">
              <Alert type="success" title="Proof of delivery saved">Check the details below, then mark the delivery as completed.</Alert>
              <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => run("complete", undefined, "Delivery completed")}>
                <CheckCircle2 size={18} /> Mark delivery completed
              </button>
              <div className="row-between">
                <h3 style={{ margin: 0 }}>Proof of Delivery</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingProof(true)}><PenLine size={14} /> Edit</button>
              </div>
              <ProofView proof={task.proof} kind="delivery" />
            </div>
          ) : (
            <ProofForm task={task} onSaved={proofSaved} />
          )}
        </>
      )}

      {/* Saved proof for finished steps */}
      {isCollection && task.proof && !["assigned", "started"].includes(task.status) && (
        <div className="card"><h3>Proof of Collection</h3><ProofView proof={task.proof} kind="collection" />{task.warehouse_note && <p className="small muted" style={{ marginTop: 10 }}>Warehouse note: {task.warehouse_note}</p>}</div>
      )}
      {!isCollection && task.status === "completed" && task.proof && <div className="card"><h3>Proof of Delivery</h3><ProofView proof={task.proof} kind="delivery" /></div>}

      <Details task={task} />

      {task.status !== "cancelled" && !["closed", "completed"].includes(task.status) && (
        <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={() => setIssue({ body: "", mark_exception: false, customer_note: "" })}>
          <AlertTriangle size={16} /> Report a problem
        </button>
      )}

      <Modal open={!!issue} onClose={() => setIssue(null)} title="Report a problem">
        {issue && (
          <form className="stack" onSubmit={async (e) => { e.preventDefault(); await run("report_issue", issue, "Problem reported to the office"); setIssue(null); }}>
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
