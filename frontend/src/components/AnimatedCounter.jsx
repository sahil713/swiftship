import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";

export default function AnimatedCounter({ to, decimals = 0, suffix = "", prefix = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, { duration: 1.8, ease: [0.2, 0.8, 0.2, 1], onUpdate: setValue });
    return () => controls.stop();
  }, [inView, to]);
  return (
    <span ref={ref}>
      {prefix}
      {value.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
