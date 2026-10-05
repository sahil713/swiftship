import { useState } from "react";
import { dateTime } from "../lib/format.js";
import { Modal } from "./ui.jsx";

/** Read-only Proof of Collection / Proof of Delivery: who, when, notes, photos and signature. */
export default function ProofView({ proof, kind }) {
  const [open, setOpen] = useState(null);
  if (!proof) return null;
  const isCollection = kind === "collection";
  return (
    <div className="stack" style={{ "--gap": "10px" }}>
      <dl className="detail-list">
        <div><dt>{isCollection ? "Handed over by" : "Received by"}</dt><dd>{proof.person_name}</dd></div>
        <div><dt>{isCollection ? "Collected" : "Delivered"}</dt><dd>{dateTime(proof.occurred_at)}</dd></div>
        {proof.notes && <div><dt>Notes</dt><dd>{proof.notes}</dd></div>}
        {proof.recorded_by && <div><dt>Recorded by</dt><dd>{proof.recorded_by}</dd></div>}
      </dl>
      {proof.photos?.length > 0 && (
        <div className="proof-gallery" aria-label="Photos">
          {proof.photos.map((p, i) => (
            <a key={i} href="#photo" onClick={(e) => { e.preventDefault(); setOpen(p); }}><img src={p} alt={`${isCollection ? "Collection" : "Delivery"} photo ${i + 1}`} /></a>
          ))}
        </div>
      )}
      {proof.signature_data && (
        <div>
          <div className="small muted" style={{ marginBottom: 4 }}>Signature</div>
          <img src={proof.signature_data} alt="Signature" style={{ background: "#fff", borderRadius: 8, border: "1px solid var(--border)", maxWidth: 280, width: "100%" }} />
        </div>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title="Photo">
        {open && <img src={open} alt="Full-size proof" style={{ width: "100%", borderRadius: 8 }} />}
      </Modal>
    </div>
  );
}
