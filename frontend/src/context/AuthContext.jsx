import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tokenStore.get()) return setReady(true);
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => tokenStore.set(null))
      .finally(() => setReady(true));
  }, []);

  const handleAuth = (d) => {
    tokenStore.set(d.token);
    setUser(d.user);
    return d.user;
  };

  const login = useCallback((email, password) => api("/auth/login", { method: "POST", body: { email, password } }).then(handleAuth), []);
  const register = useCallback((attrs) => api("/auth/register", { method: "POST", body: attrs }).then(handleAuth), []);
  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  const isStaff = user && ["admin", "operations"].includes(user.role);
  const isDriver = user && ["driver", "operations", "admin"].includes(user.role);

  return (
    <AuthContext.Provider value={{ user, setUser, ready, login, register, logout, isStaff, isDriver, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

/** Where each role lands after signing in. */
export const homeFor = (user) =>
  !user ? "/" : ["admin", "operations"].includes(user.role) ? "/admin" : user.role === "driver" ? "/driver" : "/account";
