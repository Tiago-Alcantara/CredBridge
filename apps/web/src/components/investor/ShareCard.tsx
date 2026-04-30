interface ShareCardProps {
  title: string;
  color: string;
  allocation: string;
  value: string;
  yieldVal: string;
  desc: string;
}

export function ShareCard({ title, color, allocation, value, yieldVal, desc }: ShareCardProps) {
  return (
    <div
      className="card"
      style={{
        padding: 18,
        borderColor: `${color}35`,
        background: `linear-gradient(180deg, ${color}0A, rgba(255,255,255,0.01))`,
      }}
    >
      <div className="row between">
        <div className="row" style={{ gap: 10 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: color,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
          <span style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 14 }}>{title}</span>
        </div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--fg-2)" }}>
          {allocation}
        </span>
      </div>
      <div className="kpi num" style={{ fontSize: 22, marginTop: 10 }}>
        {value}
      </div>
      <div className="row between" style={{ marginTop: 8, fontSize: 12 }}>
        <span className="t-3">{desc}</span>
        <span className="num" style={{ color, fontWeight: 600 }}>
          {yieldVal}
        </span>
      </div>
    </div>
  );
}
