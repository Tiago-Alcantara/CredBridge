"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";

interface ActorColumnProps {
  label: string;
  color: string;
  steps: string[];
}

export function ActorColumn({ label, color, steps }: ActorColumnProps) {
  return (
    <div
      className="card"
      style={{
        borderColor: `${color}40`,
        background: `linear-gradient(180deg, ${color}0A, rgba(255,255,255,0.015))`,
        padding: 24,
      }}
    >
      <div className="row between" style={{ marginBottom: 20 }}>
        <span className="eyebrow" style={{ color, letterSpacing: "0.18em" }}>
          {label}
        </span>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: color,
            boxShadow: `0 0 10px ${color}`,
          }}
        />
      </div>
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {steps.map((s, i) => (
          <li
            key={i}
            className="row"
            style={{
              gap: 12,
              padding: "10px 12px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color,
                minWidth: 18,
                fontWeight: 600,
              }}
            >
              0{i + 1}
            </span>
            <span
              style={{ fontSize: 13.5, color: "var(--fg-1)", lineHeight: 1.4 }}
            >
              {s}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function HowItWorks() {
  const { t } = useTranslation("pt");

  const data = {
    client: [
      "Cadastro inicial (empresa + dados)",
      "Upload NF-e + validação SEFAZ",
      "Assina cessão via Stellar Auth",
      "Recebe stablecoins → saca via Pix",
      "Boleto único emitido ao sacado",
    ],
    bridge: [
      "Valida documentos na SEFAZ",
      "Analisa risco + gera proposta",
      "Executa Smart Contract (Soroban)",
      "Monitora pagamento do boleto",
      "Atualiza NAV automaticamente",
    ],
    investor: [
      "Deposita capital via Pix",
      "Visualiza propostas disponíveis",
      "Aprova proposta + envia capital",
      "Recebe garantia on-chain",
      "Consulta veracidade na blockchain",
    ],
  };

  const actors = [
    { key: "client", label: "CLIENTE · PME", color: "#00D4FF", steps: data.client },
    { key: "bridge", label: "CREDBRIDGE", color: "#7B2FFF", steps: data.bridge },
    { key: "investor", label: "INVESTIDOR", color: "#00FF94", steps: data.investor },
  ];

  return (
    <section id="how" style={{ paddingTop: 96, paddingBottom: 96 }}>
      <div className="wrap-wide">
        <div
          className="row between"
          style={{
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 24,
            marginBottom: 56,
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              {t("howitworks_eyebrow")}
            </div>
            <h2 style={{ maxWidth: 720, whiteSpace: "pre-line" }}>
              {t("howitworks_title")}
            </h2>
          </div>
          <p
            style={{
              maxWidth: 420,
              color: "var(--fg-1)",
              fontSize: 15,
              lineHeight: 1.55,
            }}
          >
            {t("howitworks_sub")}
          </p>
        </div>
        <div style={{ position: "relative", padding: "40px 0" }}>
          <svg
            viewBox="0 0 1200 620"
            preserveAspectRatio="none"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            <defs>
              <linearGradient id="lg-cb" x1="0" x2="1">
                <stop offset="0" stopColor="#00D4FF" stopOpacity="0.1" />
                <stop offset="0.5" stopColor="#00D4FF" stopOpacity="0.5" />
                <stop offset="1" stopColor="#7B2FFF" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="lg-bi" x1="0" x2="1">
                <stop offset="0" stopColor="#7B2FFF" stopOpacity="0.5" />
                <stop offset="0.5" stopColor="#00FF94" stopOpacity="0.5" />
                <stop offset="1" stopColor="#00FF94" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <path
              d="M 340 120 C 500 120, 500 310, 600 310"
              stroke="url(#lg-cb)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4 6"
            />
            <path
              d="M 340 240 C 500 240, 520 340, 600 340"
              stroke="url(#lg-cb)"
              strokeWidth="1"
              fill="none"
              strokeDasharray="2 5"
              opacity="0.6"
            />
            <path
              d="M 600 310 C 700 310, 700 120, 860 120"
              stroke="url(#lg-bi)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4 6"
            />
            <path
              d="M 860 380 C 700 380, 700 450, 600 450"
              stroke="url(#lg-bi)"
              strokeWidth="1.2"
              fill="none"
              strokeDasharray="3 6"
              opacity="0.6"
            />
          </svg>
          <svg
            viewBox="0 0 1200 620"
            preserveAspectRatio="none"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            <circle
              r="4"
              fill="#00D4FF"
              style={{
                filter: "drop-shadow(0 0 6px #00D4FF)",
                offsetPath: "path('M 340 120 C 500 120, 500 310, 600 310')",
                offsetRotate: "0deg",
                animation: "tokenTravel 4s linear infinite",
              }}
            />
            <circle
              r="3"
              fill="#00D4FF"
              style={{
                filter: "drop-shadow(0 0 5px #00D4FF)",
                offsetPath: "path('M 340 120 C 500 120, 500 310, 600 310')",
                animation: "tokenTravel 4s linear infinite",
                animationDelay: "1.3s",
              }}
            />
            <circle
              r="3"
              fill="#00D4FF"
              style={{
                filter: "drop-shadow(0 0 5px #00D4FF)",
                offsetPath: "path('M 340 240 C 500 240, 520 340, 600 340')",
                animation: "tokenTravel 4.5s linear infinite",
                animationDelay: "0.8s",
              }}
            />
            <circle
              r="4"
              fill="#7B2FFF"
              style={{
                filter: "drop-shadow(0 0 6px #7B2FFF)",
                offsetPath: "path('M 600 310 C 700 310, 700 120, 860 120')",
                animation: "tokenTravel 4.2s linear infinite",
                animationDelay: "2s",
              }}
            />
            <circle
              r="3"
              fill="#00FF94"
              style={{
                filter: "drop-shadow(0 0 6px #00FF94)",
                offsetPath: "path('M 860 380 C 700 380, 700 450, 600 450')",
                animation: "tokenTravel 4s linear infinite",
                animationDelay: "0.4s",
              }}
            />
            <circle
              r="3"
              fill="#00FF94"
              style={{
                filter: "drop-shadow(0 0 6px #00FF94)",
                offsetPath: "path('M 860 380 C 700 380, 700 450, 600 450')",
                animation: "tokenTravel 4s linear infinite",
                animationDelay: "2.5s",
              }}
            />
          </svg>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 24,
              position: "relative",
            }}
          >
            {actors.map((a) => (
              <ActorColumn
                key={a.key}
                label={a.label}
                color={a.color}
                steps={a.steps}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
