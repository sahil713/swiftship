import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

/** Fetches `path` (re-fetching when path/params change). Returns { data, error, loading, reload, setData }. */
export function useApi(path, params) {
  const key = path ? path + JSON.stringify(params || {}) : null;
  const [state, setState] = useState({ data: null, error: null, loading: !!path });

  const load = useCallback(() => {
    if (!path) return Promise.resolve();
    setState((s) => ({ ...s, loading: true, error: null }));
    return api(path, { params })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  const setData = (data) => setState((s) => ({ ...s, data: typeof data === "function" ? data(s.data) : data }));
  return { ...state, reload: load, setData };
}
