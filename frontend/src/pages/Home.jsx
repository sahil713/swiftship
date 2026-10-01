import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ShieldCheck, Clock, MapPin, Star, CheckCircle2, PackageCheck, BellRing, Navigation, Search } from "lucide-react";
import BackgroundVideo from "../components/BackgroundVideo.jsx";
import QuickQuote from "../components/QuickQuote.jsx";
import AnimatedCounter from "../components/AnimatedCounter.jsx";
import RouteAnimation from "../components/RouteAnimation.jsx";
import { Reveal } from "../components/ui.jsx";
import { useApi } from "../lib/hooks.js";
import { money } from "../lib/format.js";
import { serviceIcon } from "../lib/serviceIcons.js";
import { usePricingEnabled } from "../lib/site.js";

const HEADLINE = ["Deliveries", "across", "the", "UK,", { text: "done right.", accent: true }];
const CITIES = ["London", "Manchester", "Birmingham", "Glasgow", "Edinburgh", "Cardiff", "Belfast", "Leeds", "Bristol", "Newcastle", "Liverpool", "Inverness", "Aberdeen", "Norwich", "Plymouth", "Southampton"];

const STEPS = [
  { video: "/videos/warehouse-conveyor.mp4", title: "Book & we collect", text: "Get an instant price, pick a collection date and we'll pick up from your door." },
  { video: "/videos/highway-night.mp4", title: "Tracked in transit", text: "Your shipment moves through our network with a timestamped scan at every stage." },
  { video: "/videos/doorstep-delivery.mp4", title: "Delivered with proof", text: "Signature or photo proof of delivery, plus email and SMS updates along the way." },
];

function Hero({ services }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const videoScale = useTransform(scrollYProgress, [0, 1], [1.05, 1.15]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  return (
    <section className="hero" ref={ref} aria-labelledby="hero-title">
      <motion.div style={{ position: "absolute", inset: 0, zIndex: -2, y: videoY, scale: videoScale }}>
        <BackgroundVideo src="/videos/hero-truck-aerial.mp4" className="hero-video" />
      </motion.div>
      <motion.div className="container hero-grid" style={{ y: contentY }}>
        <div>
          <motion.div className="hero-pill" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <b>New</b><span className="pulse-dot" aria-hidden /> Same-day delivery now in 11 UK regions
          </motion.div>
          <h1 id="hero-title">
            {HEADLINE.map((w, i) => (
              <motion.span key={i} className={`word ${w.accent ? "accent" : ""}`} initial={{ opacity: 0, y: 40, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.7, delay: 0.1 + i * 0.09, ease: [0.2, 0.8, 0.2, 1] }}>
                {w.text || w}
              </motion.span>
            ))}
          </h1>
          <motion.p className="lead" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.7 }}>
            Parcels, pallets and precious items — collected from your door and delivered anywhere in England, Scotland, Wales and Northern Ireland. Transparent pricing, live tracking.
          </motion.p>
          <motion.div className="row" style={{ gap: 12, marginTop: 28 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.7 }}>
            <Link to="/quote" className="btn btn-primary btn-lg">Book a delivery <ArrowRight size={18} /></Link>
            <Link to="/track" className="btn btn-outline-light btn-lg"><Search size={18} /> Track a parcel</Link>
          </motion.div>
          <motion.div className="hero-badges" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
            <span><ShieldCheck size={18} /> Cover up to £1,000</span>
            <span><Clock size={18} /> Next-day available</span>
            <span><Star size={18} /> 4.8/5 from 12k reviews</span>
          </motion.div>
        </div>
        <QuickQuote services={services} />
      </motion.div>
      <div className="scroll-cue" aria-hidden><span className="mouse" /> Scroll</div>
    </section>
  );
}

function Marquee() {
  const items = [...CITIES, ...CITIES];
  return (
    <div className="marquee" aria-label="Cities we deliver to">
      <div className="marquee-track">
        {items.map((c, i) => (
          <span key={i} aria-hidden={i >= CITIES.length}><MapPin size={16} /> {c}</span>
        ))}
      </div>
    </div>
  );
}

function Stats() {
  const stats = [
    { to: 2.4, decimals: 1, suffix: "M", label: "Parcels delivered in 2025" },
    { to: 98.7, decimals: 1, suffix: "%", label: "On-time delivery rate" },
    { to: 121, label: "UK postcode areas covered" },
    { to: 4.8, decimals: 1, suffix: "/5", label: "Average customer rating" },
  ];
  return (
    <section className="section" style={{ paddingBottom: 0 }}>
      <div className="container grid-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08} className="stat">
            <div className="value"><AnimatedCounter {...s} /></div>
            <div className="label">{s.label}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="section" aria-labelledby="how-title">
      <div className="container">
        <Reveal className="center" y={20}>
          <div className="eyebrow">How it works</div>
          <h2 id="how-title">From your door to theirs in three steps</h2>
          <p className="lead">Hover a card to see it in motion.</p>
        </Reveal>
        <div className="grid-3" style={{ marginTop: 40 }}>
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.12}>
              <article className="video-card">
                <BackgroundVideo src={s.video} playOnHover />
                <div className="content">
                  <div className="step-num">{i + 1}</div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServicesPreview({ services }) {
  const pricing = usePricingEnabled();
  return (
    <section className="section section-alt" aria-labelledby="services-title">
      <div className="container">
        <Reveal className="row-between" y={20}>
          <div>
            <div className="eyebrow">Our services</div>
            <h2 id="services-title">A service for every shipment</h2>
          </div>
          <Link to="/services" className="btn btn-secondary">Compare services <ArrowRight size={16} /></Link>
        </Reveal>
        <div className="grid-4" style={{ marginTop: 32 }}>
          {services.map((s, i) => {
            const Icon = serviceIcon(s.slug);
            return (
              <Reveal key={s.id} delay={i * 0.08}>
                <Link to={`/quote?service_id=${s.id}`} className="card card-hover service-card" style={{ color: "inherit", textDecoration: "none" }}>
                  <motion.div className="ico" whileHover={{ rotate: -8, scale: 1.08 }}><Icon size={24} /></motion.div>
                  <h3>{s.name}</h3>
                  <p className="muted small">{s.tagline}</p>
                  <div className="price-from">
                    <span className="small muted">{s.transit_time}</span>
                    {pricing ? <span><span className="small muted">from </span><strong>{money(s.base_price_pence)}</strong></span> : <span className="small" style={{ fontWeight: 700, color: "var(--accent-text)" }}>Request a quote →</span>}
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TrackingFeature() {
  const float = (d) => ({ animate: { y: [0, -10, 0] }, transition: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: d } });
  return (
    <section className="section" aria-labelledby="tracking-title">
      <div className="container split-media">
        <Reveal>
          <div className="media-frame">
            <BackgroundVideo src="/videos/doorstep-delivery.mp4" />
            <motion.div className="floating-chip" style={{ top: 20, left: 20 }} {...float(0)}>
              <span className="ico tone-good"><PackageCheck size={18} /></span>
              <div>Delivered<div className="small muted" style={{ fontWeight: 500 }}>Signed by J. Taylor · 14:02</div></div>
            </motion.div>
            <motion.div className="floating-chip" style={{ bottom: 20, right: 20 }} {...float(1.2)}>
              <span className="ico tone-accent"><BellRing size={18} /></span>
              <div>SMS sent<div className="small muted" style={{ fontWeight: 500 }}>“Your parcel is 3 stops away”</div></div>
            </motion.div>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="eyebrow"><Navigation size={14} /> Live tracking</div>
          <h2 id="tracking-title">Know exactly where your shipment is</h2>
          <p className="lead">Every scan is timestamped — booked, collected, in transit, out for delivery and delivered. You'll get email and SMS updates at each important step, and proof of delivery when it arrives.</p>
          <RouteAnimation />
          <ul className="check-list" style={{ marginTop: 24 }}>
            <li><CheckCircle2 size={18} /> Track by number — no account needed</li>
            <li><CheckCircle2 size={18} /> Photo or signature proof of delivery</li>
            <li><CheckCircle2 size={18} /> Instant alerts if anything changes</li>
          </ul>
          <Link to="/track" className="btn btn-primary">Track a shipment <ArrowRight size={16} /></Link>
        </Reveal>
      </div>
    </section>
  );
}

function VideoBand() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  return (
    <section className="video-band" ref={ref} aria-labelledby="band-title">
      <motion.div style={{ position: "absolute", inset: 0, zIndex: -2, y }}>
        <BackgroundVideo src="/videos/highway-night.mp4" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      </motion.div>
      <div className="container">
        <Reveal>
          <div className="eyebrow" style={{ color: "#ffb86b" }}>Working through the night</div>
          <h2 id="band-title" style={{ maxWidth: "18ch" }}>Our network never stops moving.</h2>
          <p className="lead">Overnight trunking between regional hubs means Express shipments booked by 5pm arrive the next working day across the UK mainland.</p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link to="/quote" className="btn btn-primary btn-lg">Get a price</Link>
            <Link to="/areas" className="btn btn-outline-light btn-lg">See delivery areas</Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="section">
      <div className="container">
        <Reveal>
          <div className="cta-panel">
            <motion.span className="blob" style={{ width: 320, height: 320, right: -80, top: -120 }} animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 8, repeat: Infinity }} aria-hidden />
            <motion.span className="blob" style={{ width: 200, height: 200, right: 160, bottom: -120 }} animate={{ scale: [1.1, 1, 1.1] }} transition={{ duration: 6, repeat: Infinity }} aria-hidden />
            <div style={{ position: "relative", maxWidth: 620 }}>
              <h2>Ready to send something?</h2>
              <p className="lead" style={{ color: "rgba(255,255,255,0.92)" }}>Get a price in seconds and book in under two minutes. Guest checkout available.</p>
              <div className="row" style={{ marginTop: 20 }}>
                <Link to="/quote" className="btn btn-light btn-lg">Start booking <ArrowRight size={18} /></Link>
                <Link to="/contact" className="btn btn-outline-light btn-lg">Talk to us</Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function Home() {
  const { data } = useApi("/services");
  const services = data || [];
  return (
    <>
      <Hero services={services} />
      <Marquee />
      <Stats />
      <HowItWorks />
      <ServicesPreview services={services} />
      <TrackingFeature />
      <VideoBand />
      <Cta />
    </>
  );
}
