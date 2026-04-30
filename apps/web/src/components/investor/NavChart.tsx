export function NavChart() {
  const data = [1000, 1012, 1022, 1030, 1028, 1044, 1058, 1065, 1079, 1091, 1098, 1110, 1124, 1138, 1152, 1160, 1169, 1174, 1186];
  const W = 720, H = 220, pad = 10;
  const min = Math.min(...data) - 4, max = Math.max(...data) + 4;
  const xs = (i: number) => pad + (i / (data.length - 1)) * (W - pad * 2);
  const ys = (v: number) => pad + (1 - (v - min) / (max - min)) * (H - pad * 2);
  const path = data.map((v, i) => (i === 0 ? "M" : "L") + xs(i) + " " + ys(v)).join(" ");
  const months = ["jun", "ago", "out", "dez", "fev", "abr"] as const;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 220, marginTop: 8 }}>
      <defs>
        <linearGradient id="navg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#7B2FFF" stopOpacity="0.4" />
          <stop offset="1" stopColor="#7B2FFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1={pad}
          x2={W - pad}
          y1={pad + (i * (H - pad * 2)) / 3}
          y2={pad + (i * (H - pad * 2)) / 3}
          stroke="rgba(255,255,255,0.04)"
        />
      ))}
      <path
        d={`${path} L ${xs(data.length - 1)} ${H - pad} L ${xs(0)} ${H - pad} Z`}
        fill="url(#navg)"
      />
      <path
        d={path}
        stroke="#7B2FFF"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 6px rgba(123,47,255,0.5))" }}
      />
      <circle
        cx={xs(data.length - 1)}
        cy={ys(data[data.length - 1])}
        r="5"
        fill="#7B2FFF"
        style={{ filter: "drop-shadow(0 0 8px #7B2FFF)" }}
      />
      <circle
        cx={xs(data.length - 1)}
        cy={ys(data[data.length - 1])}
        r="10"
        fill="#7B2FFF"
        fillOpacity="0.15"
      />
      {months.map((m, i) => (
        <text
          key={m}
          x={pad + (i / 5) * (W - pad * 2)}
          y={H - 2}
          fill="rgba(255,255,255,0.35)"
          fontSize="10"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {m}
        </text>
      ))}
    </svg>
  );
}
