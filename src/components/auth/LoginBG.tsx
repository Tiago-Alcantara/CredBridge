export function LoginBG() {
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.5,
      }}
      viewBox="0 0 600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="lbg" cx="0.3" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#7B2FFF" stopOpacity="0.25" />
          <stop offset="1" stopColor="#7B2FFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="600" height="900" fill="url(#lbg)" />
      {[...Array(8)].map((_, i) => (
        <circle
          key={i}
          cx={100 + i * 60}
          cy={300 + Math.sin(i) * 180}
          r={2 + (i % 3)}
          fill={i % 2 ? "#00D4FF" : "#7B2FFF"}
          style={{ filter: "blur(0.5px)", opacity: 0.6 }}
        />
      ))}
      {[...Array(6)].map((_, i) => (
        <line
          key={i}
          x1={80 + i * 70}
          y1={200}
          x2={80 + i * 70 + 30}
          y2={700}
          stroke="#00D4FF"
          strokeOpacity="0.08"
          strokeWidth="0.6"
        />
      ))}
    </svg>
  );
}
