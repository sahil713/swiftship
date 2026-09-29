import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Truck, LogOut, User } from "lucide-react";
import ThemeToggle from "./ThemeToggle.jsx";
import { homeFor, useAuth } from "../context/AuthContext.jsx";

const NAV = [
  { to: "/services", label: "Services" },
  { to: "/areas", label: "Delivery areas" },
  { to: "/quote", label: "Get a quote" },
  { to: "/track", label: "Track" },
  { to: "/faq", label: "Help" },
];

export function Brand({ to = "/" }) {
  return (
    <Link to={to} className="brand" aria-label="SwiftShip home">
      <span className="brand-mark"><Truck size={19} strokeWidth={2.4} /></span>
      SwiftShip
    </Link>
  );
}

export function Header() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const overHero = location.pathname === "/" && !scrolled && !open;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const signOut = () => {
    logout();
    navigate("/");
  };

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className={`site-header ${overHero ? "over-hero" : ""}`}>
        <div className="container header-inner">
          <Brand />
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className="nav-link">{n.label}</NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <ThemeToggle />
            {user ? (
              <>
                <Link to={homeFor(user)} className="btn btn-secondary btn-sm desktop-only"><User size={16} />{user.role === "customer" ? "My account" : "Dashboard"}</Link>
                <button className="icon-btn desktop-only" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
              </>
            ) : (
              <Link to="/login" className="nav-link desktop-only">Sign in</Link>
            )}
            <Link to="/quote" className="btn btn-primary btn-sm desktop-only">Book now</Link>
            <button className="icon-btn menu-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>
      {open && (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile">
          {NAV.map((n) => <Link key={n.to} to={n.to}>{n.label}</Link>)}
          <Link to="/contact">Contact us</Link>
          <hr className="divider" />
          {user ? (
            <>
              <Link to={homeFor(user)}>{user.role === "customer" ? "My account" : "Dashboard"}</Link>
              <button className="btn btn-secondary" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link to="/register">Create account</Link>
            </>
          )}
          <Link to="/quote" className="btn btn-primary btn-lg" style={{ marginTop: 12 }}>Book a delivery</Link>
        </nav>
      )}
    </>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Brand />
            <p className="small" style={{ marginTop: 14, maxWidth: 280 }}>
              Parcel, express, same-day and two-person delivery across England, Scotland, Wales and Northern Ireland.
            </p>
          </div>
          <div>
            <h4>Ship</h4>
            <Link to="/quote">Get a quote</Link>
            <Link to="/services">Services</Link>
            <Link to="/areas">Delivery areas</Link>
            <Link to="/track">Track a shipment</Link>
          </div>
          <div>
            <h4>Help</h4>
            <Link to="/faq">FAQs</Link>
            <Link to="/contact">Contact us</Link>
            <Link to="/legal/claims">Make a claim</Link>
            <Link to="/legal/prohibited-items">Prohibited items</Link>
          </div>
          <div>
            <h4>Legal</h4>
            <Link to="/legal/terms">Terms of service</Link>
            <Link to="/legal/privacy">Privacy notice</Link>
          </div>
        </div>
        <div className="footer-bottom row-between">
          <span>© {new Date().getFullYear()} SwiftShip Logistics Ltd. UK mainland, Highlands & Islands and Northern Ireland. We don't serve the Republic of Ireland.</span>
          <span>Videos: Pexels</span>
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="app-shell">
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
