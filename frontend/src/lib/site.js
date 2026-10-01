import { useEffect, useState } from "react";
import { api } from "./api.js";

// Public site settings (contact details, pricing switch), fetched once per page load.
let cache = null;
let inflight = null;

function load() {
  inflight ||= api("/site")
    .then((d) => (cache = d))
    .catch(() => (cache = { pricing_enabled: false }))
    .finally(() => (inflight = null));
  return inflight;
}

export function useSite() {
  const [site, setSite] = useState(cache);
  useEffect(() => {
    if (!cache) load().then(setSite);
  }, []);
  return site;
}

/** True only once the backend confirms online pricing is switched on (phase 2). */
export function usePricingEnabled() {
  return useSite()?.pricing_enabled === true;
}
