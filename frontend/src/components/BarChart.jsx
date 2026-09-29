import { useState } from "react";

const W = 720;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 44 };

function niceMax(v) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Bar path with a 4px rounded top and a square base anchored to the baseline. */
function barPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/**
 * Single-series column chart with a hover tooltip and a table alternative.
 * data: [{ label, value, tooltip }]
 */
export default function BarChart({ data, format = (v) => v, title, labelEvery = 5 }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const gap = Math.max(2, slot * 0.2);
  const barW = Math.max(1, slot - gap);
  const ticks = [0, max / 2, max];

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <figcaption style={{ fontWeight: 700 }}>{title}</figcaption>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowTable((s) => !s)} aria-pressed={showTable}>{showTable ? "Show chart" : "Show table"}</button>
      </div>
      {showTable ? (
        <div className="table-wrap" style={{ maxHeight: 260, overflow: "auto" }}>
          <table className="table"><thead><tr><th>Date</th><th className="num">{title}</th></tr></thead>
            <tbody>{data.map((d) => <tr key={d.label}><td>{d.tooltip || d.label}</td><td className="num">{format(d.value)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div style={{ position: "relative" }} onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} bar chart`}>
            {ticks.map((t) => {
              const y = PAD.top + innerH - (t / max) * innerH;
              return (
                <g key={t}>
                  <line className="grid-line" x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} />
                  <text className="axis-label" x={PAD.left - 8} y={y + 4} textAnchor="end">{format(t)}</text>
                </g>
              );
            })}
            {data.map((d, i) => {
              const h = (d.value / max) * innerH;
              const x = PAD.left + i * slot + gap / 2;
              const y = PAD.top + innerH - h;
              return (
                <g key={d.label}>
                  {h > 0 && <path d={barPath(x, y, barW, h)} className={`bar ${hover === i ? "hover" : ""}`} />}
                  {/* Hit target spans the full slot height so short bars are easy to hover. */}
                  <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />
                  {i % labelEvery === 0 && <text className="axis-label" x={x + barW / 2} y={H - 8} textAnchor="middle">{d.label}</text>}
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div className="chart-tooltip" style={{ left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%`, top: `${((PAD.top + innerH - (data[hover].value / max) * innerH) / H) * 100}%` }}>
              {data[hover].tooltip || data[hover].label}: {format(data[hover].value)}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
