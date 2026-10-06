const BASE = import.meta.env.VITE_API_URL || "/api/v1";
const TOKEN_KEY = "swiftship_token";

export const tokenStore = {
  get() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token) {
    try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  },
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = "GET", body, params } = {}) {
  const url = new URL(BASE + path, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && url.searchParams.set(k, v));
  const headers = { Accept: "application/json" };
  const isForm = body instanceof FormData; // file uploads: the browser sets the multipart boundary
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  return data;
}

/** Fetches a private file (sent only with the signed-in user's token) and opens or downloads it. */
export async function openPrivateFile(path, { download = false, filename } = {}) {
  const token = tokenStore.get();
  const res = await fetch(BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status === 403 ? "You don't have access to this document" : "Couldn't open the document", res.status);
  const url = URL.createObjectURL(await res.blob());
  if (download) {
    const a = Object.assign(document.createElement("a"), { href: url, download: filename || "document" });
    document.body.appendChild(a); a.click(); a.remove();
  } else {
    window.open(url, "_blank", "noopener");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
