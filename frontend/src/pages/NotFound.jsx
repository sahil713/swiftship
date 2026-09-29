import { Link } from "react-router-dom";
import { PackageX } from "lucide-react";

export default function NotFound() {
  return (
    <section className="container center" style={{ padding: "96px 16px" }}>
      <PackageX size={56} style={{ margin: "0 auto 16px", color: "var(--accent)" }} />
      <h1>Page not found</h1>
      <p className="lead">This page seems to have gone astray. Let's get you back on route.</p>
      <Link to="/" className="btn btn-primary">Go home</Link>
    </section>
  );
}
