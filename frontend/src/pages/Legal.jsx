import { Link, useParams } from "react-router-dom";
import { Alert } from "../components/ui.jsx";
import NotFound from "./NotFound.jsx";

// Template content – have these reviewed by a qualified legal adviser before launch.
const PAGES = {
  terms: {
    title: "Terms of service",
    body: (
      <>
        <h2>1. Our service</h2>
        <p>Shift Logistics (powered by V&amp;V Logistics and Rentals Ltd) collects and delivers goods between addresses in England, Scotland, Wales and Northern Ireland. We do not serve the Republic of Ireland, the Channel Islands or the Isle of Man.</p>
        <h2>2. Quotes and prices</h2>
        <ul>
          <li>Online estimates are based on the information you give us. If the weight, size, addresses or item description are incomplete or inaccurate, the price may change.</li>
          <li>We will show you the final confirmed price before you pay. Your booking is confirmed only when payment succeeds.</li>
          <li>If an item is found at collection to differ significantly from its description, we may charge the difference or decline to carry it.</li>
        </ul>
        <h2>3. Collection and delivery</h2>
        <ul>
          <li>Transit times are estimates in working days (Monday to Friday, excluding bank holidays) and are not guaranteed unless stated.</li>
          <li>You must make sure items are properly packed and someone is available at collection and delivery, and provide any access instructions.</li>
          <li>If we cannot deliver, we will contact you to arrange another attempt. Repeated failed attempts may incur a charge.</li>
        </ul>
        <h2>4. Cancellations and changes</h2>
        <ul>
          <li>Unpaid bookings can be cancelled at any time without charge.</li>
          <li>Paid bookings cancelled before collection are refunded in full, less any card processing costs we cannot recover. Once collected, a booking cannot be cancelled.</li>
          <li>Change requests (dates, addresses, item details) are subject to availability and may change the price.</li>
        </ul>
        <h2>5. Liability</h2>
        <p>Our liability for loss or damage is limited to the lower of the item's value and the cover level of your service, unless caused by our negligence. See our <Link to="/legal/claims">claims procedure</Link>. Nothing in these terms limits your statutory rights.</p>
        <h2>6. Prohibited items</h2>
        <p>You must not send any item on our <Link to="/legal/prohibited-items">prohibited items list</Link>.</p>
      </>
    ),
  },
  privacy: {
    title: "Privacy notice",
    body: (
      <>
        <p>This notice explains how Shift Logistics, powered by V&amp;V Logistics and Rentals Ltd ("we"), uses personal data, in line with UK GDPR and the Data Protection Act 2018.</p>
        <h2>What we collect</h2>
        <ul>
          <li>Names, addresses, phone numbers and email addresses for senders and recipients.</li>
          <li>Shipment details, tracking history and proof of delivery (signature or photo).</li>
          <li>Payment records. Card details are handled by our payment provider and are not stored by us.</li>
          <li>Account details if you register, and messages you send us.</li>
        </ul>
        <h2>Why we use it</h2>
        <p>To quote, collect and deliver your shipment (contract), to send service updates by email and SMS (contract), to handle claims and enquiries (legitimate interests), and to meet legal and accounting obligations.</p>
        <h2>How long we keep it</h2>
        <p>Booking and payment records are kept for 6 years for accounting purposes. Proof-of-delivery images are kept for 12 months.</p>
        <h2>Your rights</h2>
        <p>You can ask to access, correct or delete your data, or object to how we use it, by contacting us. You can also complain to the Information Commissioner's Office (ico.org.uk).</p>
      </>
    ),
  },
  "prohibited-items": {
    title: "Prohibited & restricted items",
    body: (
      <>
        <p>For safety and legal reasons we cannot carry the following. If you're unsure, <Link to="/contact">ask us</Link> before booking.</p>
        <h2>Prohibited</h2>
        <ul>
          <li>Dangerous goods: explosives, fireworks, flammable liquids or gases, aerosols, corrosives, and loose lithium batteries</li>
          <li>Firearms, ammunition, weapons and replicas</li>
          <li>Cash, bullion, gift cards, lottery tickets and negotiable documents</li>
          <li>Illegal items, controlled drugs and counterfeit goods</li>
          <li>Live animals, human or animal remains</li>
          <li>Perishable food requiring temperature control</li>
        </ul>
        <h2>Restricted (accepted with conditions)</h2>
        <ul>
          <li>Electronics containing batteries – must be installed in the device and switched off</li>
          <li>Glass, ceramics and artwork – book as fragile, and pack with at least 5 cm of protective material</li>
          <li>Furniture and oversized items – use our Fragile & Bulky service</li>
          <li>Jewellery and high-value items – maximum cover applies</li>
        </ul>
      </>
    ),
  },
  claims: {
    title: "Claims procedure",
    body: (
      <>
        <h2>Damaged items</h2>
        <ol>
          <li>Keep the item and all of its packaging – don't throw anything away.</li>
          <li>Take photos of the outer packaging, inner packaging and damage.</li>
          <li>Contact us within <strong>14 days</strong> of delivery with your booking reference and photos.</li>
        </ol>
        <h2>Lost items</h2>
        <p>If your shipment hasn't arrived 5 working days after its estimated delivery date, contact us. We'll investigate and aim to resolve the case within 10 working days.</p>
        <h2>What you'll need</h2>
        <ul>
          <li>Your booking reference and tracking number</li>
          <li>Proof of the item's value (e.g. receipt or invoice)</li>
          <li>Photos of the damage and packaging</li>
        </ul>
        <h2>Cover</h2>
        <p>Standard cover is up to £100 per shipment; Express and Fragile & Bulky include cover up to £1,000. Cover doesn't apply to items that were poorly packed or on the prohibited list.</p>
        <p><Link to="/contact" className="btn btn-primary" style={{ marginTop: 8 }}>Start a claim</Link></p>
      </>
    ),
  },
};

export default function Legal() {
  const { page } = useParams();
  const content = PAGES[page];
  if (!content) return <NotFound />;
  return (
    <section className="container" style={{ paddingBottom: 72 }}>
      <div className="page-head" style={{ paddingInline: 0 }}>
        <div className="eyebrow">Legal & policies</div>
        <h1>{content.title}</h1>
      </div>
      <div className="legal">
        {import.meta.env.DEV && <Alert type="warning">Template wording – have this reviewed by a legal adviser before going live.</Alert>}
        {content.body}
      </div>
    </section>
  );
}
