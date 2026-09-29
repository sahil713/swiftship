import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button className="icon-btn theme-toggle" onClick={toggle} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.25 }} style={{ display: "grid" }}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
