import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pin = (className, label) =>
  L.divIcon({ className: "", html: `<div class="live-pin ${className}" aria-label="${label}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });

// Customer tracking map: path travelled (solid), planned road route (dashed), the driver now
// and the address they're heading to. Keeps the user's zoom/pan once they've moved the map.
export default function LiveMap({ path = [], route, driver, destination }) {
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef(null);
  const userMoved = useRef(false);
  const fitting = useRef(false);

  useEffect(() => {
    map.current = L.map(el.current, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    layers.current = L.layerGroup().addTo(map.current);
    map.current.on("dragstart", () => { userMoved.current = true; });
    map.current.on("zoomstart", () => { if (!fitting.current) userMoved.current = true; });
    map.current.on("moveend", () => { fitting.current = false; });
    return () => map.current.remove();
  }, []);

  useEffect(() => {
    const group = layers.current;
    group.clearLayers();
    const bounds = [];
    if (path.length > 1) {
      L.polyline(path, { color: "#2563eb", weight: 5, opacity: 0.85 }).addTo(group);
      bounds.push(...path);
    }
    if (route?.length > 1) {
      L.polyline(route, { color: "#f97316", weight: 4, dashArray: "8 8", opacity: 0.9 }).addTo(group);
      bounds.push(...route);
    }
    if (destination?.latitude != null) {
      const d = [destination.latitude, destination.longitude];
      L.marker(d, { icon: pin("dest", "Destination") }).bindTooltip(destination.label || "Destination").addTo(group);
      bounds.push(d);
    }
    if (driver) {
      const p = [driver.latitude, driver.longitude];
      L.marker(p, { icon: pin("driver", "Driver"), zIndexOffset: 1000 }).bindTooltip(driver.place ? `Driver – near ${driver.place}` : "Driver").addTo(group);
      bounds.push(p);
    }
    if (!userMoved.current && bounds.length) {
      fitting.current = true;
      if (bounds.length === 1) map.current.setView(bounds[0], 15);
      else map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }
  }, [path, route, driver, destination]);

  return <div ref={el} className="live-map" role="img" aria-label="Map of the driver's route" />;
}
