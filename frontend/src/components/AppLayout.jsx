import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { Header } from "./Layout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { Spinner } from "./ui.jsx";

/** Guards a route by role, redirecting to sign-in when needed. */
export function RequireRole({ roles, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

/** Sidebar layout for the account, admin and driver areas. */
export default function AppLayout({ title, links }) {
  const { user } = useAuth();
  const visible = links.filter((l) => !l.roles || l.roles.includes(user?.role));
  const renderLinks = (withSections = true) =>
    visible.filter((l) => withSections || !l.section).map((l) =>
      l.section ? (
        <div key={l.section} className="side-title">{l.section}</div>
      ) : (
        <NavLink key={l.to} to={l.to} end={l.end} className="side-link">
          {l.icon && <l.icon size={18} aria-hidden />}
          {l.label}
          {l.count ? <span className="count">{l.count}</span> : null}
        </NavLink>
      )
    );
  return (
    <div className="app-shell">
      <Header />
      <div className="app-layout">
        <aside className="sidebar" aria-label={`${title} navigation`}>
          <div className="side-title">{title}</div>
          {renderLinks()}
        </aside>
        <div style={{ minWidth: 0 }}>
          <nav className="mobile-subnav" aria-label={`${title} navigation`}>{renderLinks(false)}</nav>
          <main id="main" className="app-main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
