import { Icon } from "@/components/primitives/Icon";

interface UploadZoneProps {
  id?: string;
}

export function UploadZone({ id }: UploadZoneProps) {
  return (
    <div
      id={id}
      className="card"
      style={{
        padding: 0,
        background: "linear-gradient(180deg, rgba(0,212,255,0.04), rgba(255,255,255,0.01))",
        borderColor: "rgba(0,212,255,0.22)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: 24 }}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <div>
            <h3>Enviar NF-e</h3>
            <p className="t-2" style={{ fontSize: 13, marginTop: 4 }}>
              Validação SEFAZ em tempo real · proposta em &lt; 60s
            </p>
          </div>
          <span className="badge violet">Soroban v1.4</span>
        </div>
        <div
          style={{
            border: "1.5px dashed rgba(0, 212, 255, 0.4)",
            background: "rgba(0, 212, 255, 0.04)",
            borderRadius: 12,
            padding: "36px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(0, 212, 255, 0.12)",
              color: "var(--blue)",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 14px",
            }}
          >
            <Icon name="upload" size={22} />
          </div>
          <div
            style={{
              fontFamily: "var(--sans)",
              fontWeight: 600,
              fontSize: 16,
              marginBottom: 6,
            }}
          >
            Arraste o XML aqui ou clique para selecionar
          </div>
          <div className="t-3" style={{ fontSize: 12 }}>
            XML · até 10 MB · lote de até 50 arquivos
          </div>
          <button className="btn btn-primary" style={{ marginTop: 20 }}>
            <Icon name="upload" size={14} /> Selecionar arquivos
          </button>
        </div>
        <div className="row" style={{ gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          {(["SEFAZ", "Score", "Proposta", "Cessão", "Pix"] as const).map((s, i) => (
            <span key={s} style={{ display: "contents" }}>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--fg-2)",
                  padding: "3px 8px",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                }}
              >
                <span className="t-3" style={{ marginRight: 4 }}>
                  0{i + 1}
                </span>
                {s}
              </span>
              {i < 4 && <span className="t-3">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
