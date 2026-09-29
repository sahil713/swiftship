import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/hooks.js";
import { dateTime, humanize } from "../../lib/format.js";
import { Badge, Empty, Field, Modal, Pagination, Spinner, Tabs } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";

const TONE = { open: "warning", in_progress: "info", closed: "muted" };

export default function Enquiries() {
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useApi("/admin/enquiries", { status, page });
  const [active, setActive] = useState(null);
  const toast = useToast();

  const save = async (e) => {
    e.preventDefault();
    await api(`/admin/enquiries/${active.id}`, { method: "PATCH", body: { enquiry: { status: active.status, response: active.response } } });
    toast("Enquiry updated");
    setActive(null);
    reload();
  };

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Customer enquiries</h1>
      <Tabs label="Enquiry status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[{ value: "open", label: "Open" }, { value: "in_progress", label: "In progress" }, { value: "closed", label: "Closed" }, { value: "", label: "All" }]} />
      {loading && !data ? <Spinner /> : data.enquiries.length === 0 ? <div className="card"><Empty title="No enquiries" /></div> : (
        <>
          <div className="stack">
            {data.enquiries.map((q) => (
              <button key={q.id} className="card card-hover" style={{ textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => setActive({ ...q, response: q.response || "" })}>
                <div className="row-between">
                  <strong>{q.subject}</strong>
                  <Badge tone={TONE[q.status]}>{humanize(q.status)}</Badge>
                </div>
                <div className="small muted">{q.name} · {q.email} · {dateTime(q.created_at)}{q.booking_reference ? ` · ${q.booking_reference}` : ""}</div>
                <p style={{ margin: "8px 0 0" }}>{q.message.length > 180 ? `${q.message.slice(0, 180)}…` : q.message}</p>
              </button>
            ))}
          </div>
          <Pagination meta={data.meta} onPage={setPage} />
        </>
      )}
      <Modal open={!!active} onClose={() => setActive(null)} title={active?.subject}>
        {active && (
          <form className="stack" onSubmit={save}>
            <div className="small muted">{active.name} · <a href={`mailto:${active.email}`}>{active.email}</a>{active.phone && ` · ${active.phone}`}</div>
            {active.booking_reference && <Link to={`/admin/bookings/${active.booking_reference}`} className="small">Booking {active.booking_reference}</Link>}
            <p style={{ whiteSpace: "pre-wrap" }}>{active.message}</p>
            <Field label="Status" htmlFor="eq-status">
              <select id="eq-status" className="select" value={active.status} onChange={(e) => setActive({ ...active, status: e.target.value })}>
                {["open", "in_progress", "closed"].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </select>
            </Field>
            <Field label="Response / internal notes" htmlFor="eq-resp"><textarea id="eq-resp" className="textarea" rows={4} value={active.response} onChange={(e) => setActive({ ...active, response: e.target.value })} /></Field>
            <div className="row">
              <button className="btn btn-primary">Save</button>
              <a className="btn btn-secondary" href={`mailto:${active.email}?subject=${encodeURIComponent(`Re: ${active.subject}`)}&body=${encodeURIComponent(active.response)}`}>Reply by email</a>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
