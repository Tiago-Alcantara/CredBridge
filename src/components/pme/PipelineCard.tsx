interface PipelineCardProps {
  nfe: string;
  valor: string;
  sacado: string;
  hint: string;
  dim?: boolean;
}

export function PipelineCard({ nfe, valor, sacado, hint, dim }: PipelineCardProps) {
  return (
    <div
      style={{
        padding: 12,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        opacity: dim ? 0.65 : 1,
      }}
    >
      <div className="row between" style={{ marginBottom: 4 }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--fg-3)" }}>
          NF-e {nfe}
        </span>
      </div>
      <div className="num" style={{ fontWeight: 600, fontSize: 14 }}>
        {valor}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--fg-2)", marginTop: 2 }}>
        {sacado}
      </div>
      <div className="t-3" style={{ fontSize: 11, marginTop: 6 }}>
        {hint}
      </div>
    </div>
  );
}
