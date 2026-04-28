export function HeroNetworkBG() {
  const nodes: [number, number, string, number][] = [
    [500, 340, "#00D4FF", 5],
    [360, 340, "#7B2FFF", 3],
    [640, 340, "#7B2FFF", 3],
    [500, 200, "#00FF94", 3],
    [500, 480, "#00D4FF", 3],
    [600, 440, "#00D4FF", 2],
    [400, 440, "#7B2FFF", 2],
    [400, 240, "#00D4FF", 2],
    [600, 240, "#00FF94", 2],
  ];

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        right: -100,
        width: 820,
        height: 700,
        opacity: 0.55,
        pointerEvents: "none",
      }}
      viewBox="0 0 820 700"
      fill="none"
    >
      <defs>
        <radialGradient id="rg1" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#00D4FF" stopOpacity="0.15" />
          <stop offset="1" stopColor="#00D4FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="500" cy="340" r="300" fill="url(#rg1)" />
      {[...Array(18)].map((_, i) => {
        const a = (i / 18) * Math.PI * 2;
        const r1 = 140;
        const r2 = 300;
        const x1 = 500 + Math.cos(a) * r1;
        const y1 = 340 + Math.sin(a) * r1;
        const x2 = 500 + Math.cos(a) * r2;
        const y2 = 340 + Math.sin(a) * r2;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#00D4FF"
            strokeOpacity="0.12"
            strokeWidth="0.8"
          />
        );
      })}
      <circle
        cx="500"
        cy="340"
        r="140"
        stroke="#7B2FFF"
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <circle
        cx="500"
        cy="340"
        r="220"
        stroke="#00D4FF"
        strokeOpacity="0.18"
        strokeWidth="1"
      />
      <circle
        cx="500"
        cy="340"
        r="300"
        stroke="#00D4FF"
        strokeOpacity="0.10"
        strokeWidth="1"
      />
      {nodes.map(([cx, cy, color, r], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill={color}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      ))}
    </svg>
  );
}
