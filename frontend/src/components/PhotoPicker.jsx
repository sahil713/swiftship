import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { compressImage } from "../lib/image.js";

/** Take or choose several photos (compressed on the phone before upload). */
export default function PhotoPicker({ photos, onChange, max = 8, label = "Photos", required = false }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const add = async (e) => {
    const files = [...(e.target.files || [])].slice(0, max - photos.length);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      const added = [];
      for (const f of files) added.push(await compressImage(f, 1280, 0.72));
      onChange([...photos, ...added]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field">
      <span className="label">{label}{required ? "" : <span className="muted small"> (optional)</span>}</span>
      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((p, i) => (
            <div key={i} className="photo-thumb">
              <img src={p} alt={`Photo ${i + 1}`} />
              <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => onChange(photos.filter((_, j) => j !== i))}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {photos.length < max && (
        <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Camera size={18} /> {busy ? "Processing…" : photos.length ? "Add another photo" : "Take or choose photo"}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple onChange={add} className="sr-only" tabIndex={-1} />
      <span className={error ? "error-text" : "hint"}>{error || `${photos.length} of ${max} photos`}</span>
    </div>
  );
}
