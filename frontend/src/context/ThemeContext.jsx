import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function readPreference() {
  try {
    return localStorage.getItem("theme") || "system";
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }) {
  // preference: "light" | "dark" | "system"; theme: the resolved "light" | "dark"
  const [preference, setPreference] = useState(readPreference);
  const [systemDark, setSystemDark] = useState(() => media().matches);

  useEffect(() => {
    const mq = media();
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const theme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", preference);
    } catch {
      /* storage unavailable – theme still applies for this visit */
    }
  }, [theme, preference]);

  const toggle = () => setPreference(theme === "dark" ? "light" : "dark");

  return <ThemeContext.Provider value={{ theme, preference, setPreference, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
