import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";

export const FAQS = [
  ["Where do you deliver?", "Anywhere in England, Scotland and Wales, including the Scottish Highlands & Islands (with a remote-area surcharge), and Northern Ireland. We don't deliver to or from the Republic of Ireland, the Channel Islands or the Isle of Man."],
  ["How is my price calculated?", "Each service has a base price that includes a weight allowance. We add a per-kg charge above that, a route charge if collection and delivery are in different regions, area surcharges for remote locations or Northern Ireland, and surcharges for fragile, bulky or weekend collections. Your quote shows every line."],
  ["Why might my price change?", "If you don't know the weight or size, we estimate it. If the item turns out to be heavier or larger than described, we'll confirm a revised price with you before you pay. After payment, a significant difference found at collection may result in an additional charge or refusal."],
  ["Do I need an account?", "No — you can book as a guest and use your tracking number and the private link in your confirmation email. An account lets you save addresses and see all your orders in one place."],
  ["How do I pay?", "By debit or credit card online once your price is confirmed. Your booking is only confirmed when payment succeeds."],
  ["Can I cancel or change a booking?", "Yes. Unpaid bookings can be cancelled instantly from your order page. For paid bookings, submit a cancellation or change request and our team will respond — refunds are issued to the original card according to our terms."],
  ["What if my delivery fails or is damaged?", "If we can't deliver we'll let you know by email and SMS and arrange another attempt. For damaged items, keep all packaging and make a claim within 14 days — see our claims procedure."],
  ["What can't I send?", "Dangerous goods, cash, live animals, perishables and some other items are prohibited. See the full prohibited items list before booking."],
];

export function FaqList({ items = FAQS }) {
  const [open, setOpen] = useState(0);
  return (
    <div>
      {items.map(([q, a], i) => (
        <div className="faq-item" key={q}>
          <button className="faq-q" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? -1 : i)}>
            {q} <Plus size={20} aria-hidden />
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div id={`faq-${i}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                <div className="faq-a">{a}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

export default function Faq() {
  return (
    <section className="container" style={{ paddingBottom: 72 }}>
      <div className="page-head" style={{ paddingInline: 0 }}>
        <div className="eyebrow">Help centre</div>
        <h1>Frequently asked questions</h1>
        <p className="lead">Can't find what you need? <Link to="/contact">Contact our team</Link>.</p>
      </div>
      <div style={{ maxWidth: 820 }}>
        <FaqList />
        <p className="small muted" style={{ marginTop: 24 }}>
          See also: <Link to="/legal/terms">Terms</Link> · <Link to="/legal/prohibited-items">Prohibited items</Link> · <Link to="/legal/claims">Claims</Link> · <Link to="/legal/privacy">Privacy</Link>
        </p>
      </div>
    </section>
  );
}
