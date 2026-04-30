export function YieldSpark() {
  const path =
    "M 0 36 L 20 30 L 40 32 L 60 24 L 80 22 L 100 12 L 120 16 L 140 8 L 160 6 L 180 10 L 200 4";

  return (
    <div
      className="card"
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div className="row between">
          <span className="eyebrow">Taxa média desta semana</span>
          <span className="badge completed no-dot" style={{ fontSize: 10 }}>
            ▼ 0,24 p.p.
          </span>
        </div>
        <div className="kpi num" style={{ fontSize: 30, marginTop: 8 }}>
          2,88<span style={{ color: "var(--fg-2)", fontSize: 18 }}>%</span>
        </div>
      </div>
      <svg
        viewBox="0 0 200 44"
        style={{ width: "100%", height: 60, marginTop: 10 }}
      >
        <defs>
          <linearGradient id="sparkg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#00D4FF" stopOpacity={0.4} />
            <stop offset="1" stopColor="#00D4FF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={`${path} L 200 44 L 0 44 Z`} fill="url(#sparkg)" />
        <path
          d={path}
          stroke="#00D4FF"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 4px #00D4FF)" }}
        />
        <circle
          cx="200"
          cy="4"
          r="3"
          fill="#00D4FF"
          style={{ filter: "drop-shadow(0 0 6px #00D4FF)" }}
        />
      </svg>
      <div
        className="row between"
        style={{ fontSize: 11, color: "var(--fg-3)" }}
      >
        <span>seg</span>
        <span>ter</span>
        <span>qua</span>
        <span>qui</span>
        <span>sex</span>
      </div>
    </div>
  );
}
