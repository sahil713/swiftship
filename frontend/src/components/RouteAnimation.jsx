import { motion } from "framer-motion";

const PATH = "M 24 70 C 120 10, 200 10, 280 45 S 440 90, 520 40 S 640 10, 696 30";
const DURATION = 5;
const STOPS = [
  { x: 24, y: 70, label: "Collected" },
  { x: 280, y: 45, label: "Hub" },
  { x: 520, y: 40, label: "Out for delivery" },
  { x: 696, y: 30, label: "Delivered" },
];

/** A van travelling along a delivery route. Static for visitors who prefer reduced motion. */
export default function RouteAnimation() {
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div className="route-strip" aria-hidden>
      <svg viewBox="0 0 720 110" preserveAspectRatio="xMidYMid meet">
        <path d={PATH} className="route-path" />
        <motion.path
          d={PATH}
          className="route-progress"
          initial={{ pathLength: reduced ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={reduced ? { duration: 0 } : { duration: DURATION, ease: "linear", repeat: Infinity }}
        />
        {STOPS.map((s, i) => (
          <g key={s.label}>
            <circle cx={s.x} cy={s.y} r="7" fill="var(--bg-elevated)" stroke="var(--accent)" strokeWidth="3" />
            <text x={s.x} y={s.y + 28} textAnchor={i === 0 ? "start" : i === STOPS.length - 1 ? "end" : "middle"} fontSize="13" fontWeight="700" fill="var(--text-2)">
              {s.label}
            </text>
          </g>
        ))}
        <g transform={reduced ? `translate(${STOPS[3].x} ${STOPS[3].y})` : undefined}>
          {!reduced && <animateMotion dur={`${DURATION}s`} repeatCount="indefinite" path={PATH} rotate="auto" />}
          <rect x="-17" y="-17" width="34" height="34" rx="10" fill="var(--accent)" />
          <g transform="translate(-10 -10) scale(0.84)" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
            <path d="M15 18H9" />
            <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
            <circle cx="17" cy="18" r="2" />
            <circle cx="7" cy="18" r="2" />
          </g>
        </g>
      </svg>
    </div>
  );
}
