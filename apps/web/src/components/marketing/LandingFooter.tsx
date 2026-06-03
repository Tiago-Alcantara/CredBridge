"use client";

import { Logo } from "@/components/primitives/Logo";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function LandingFooter() {
  const { t } = useTranslation("pt");

  const linkColumns = [
    {
      h: "Produto",
      items: ["PME", "Investidor", "Parceiro", "API Reference"],
    },
    {
      h: "Recursos",
      items: ["Docs", "Guias", "Status", "Changelog"],
    },
    {
      h: "Empresa",
      items: ["Sobre", "Segurança", "Compliance", "Contato"],
    },
  ];

  return (
    <footer style={{ borderTop: "1px solid var(--line)", padding: "48px 0 40px" }}>
      <div className="wrap-wide">
        <div
          className="grid-kpi"
          style={{ marginBottom: 40, gap: 40 }}
        >
          <div>
            <Logo />
            <p
              style={{
                color: "var(--fg-2)",
                fontSize: 13,
                marginTop: 16,
                maxWidth: 280,
                lineHeight: 1.5,
              }}
            >
              Protocolo de antecipação de recebíveis construído na Stellar
              blockchain.
            </p>
          </div>
          {linkColumns.map((col, i) => (
            <div key={i}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                {col.h}
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {col.items.map((it, j) => (
                  <li key={j}>
                    <a
                      href="#"
                      style={{
                        color: "var(--fg-2)",
                        textDecoration: "none",
                        fontSize: 13,
                      }}
                    >
                      {it}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          className="row between"
          style={{ paddingTop: 28, borderTop: "1px solid var(--line)" }}
        >
          <span className="t-3" style={{ fontSize: 12 }}>
            {t("footer_rights")}
          </span>
          <span
            className="row"
            style={{ gap: 16, color: "var(--fg-3)", fontSize: 12 }}
          >
            <span className="row" style={{ gap: 6 }}>
              <span className="dot-live" /> mainnet
            </span>
            <span className="mono">v1.4.2</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
