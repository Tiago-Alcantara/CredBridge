"use client";

import Link from "next/link";
import { Icon } from "@/components/primitives/Icon";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface AudiencesProps {
  publicOnly?: boolean;
}

export function Audiences({ publicOnly = false }: AudiencesProps) {
  const { t } = useTranslation("pt");

  const cards = [
    {
      color: "#00D4FF",
      eyebrow: t("audience_pme"),
      title: "Liquidez instantânea\npara suas NF-e.",
      benefits: [
        "Aprovação em minutos, não dias",
        "Taxas até 40% menores",
        "Recebimento via Pix 24/7",
        "Sem burocracia bancária",
      ],
      cta: t("cta_antecipar"),
      href: "/login",
    },
    {
      color: "#7B2FFF",
      eyebrow: t("audience_inv"),
      title: "Yield real, lastreado\nem recebíveis.",
      benefits: [
        "Cota Sênior ou Cota Anjo",
        "Retorno médio 18,6% a.a.",
        "Liquidez via Stellar DEX",
        "Prova on-chain de cada ativo",
      ],
      cta: t("cta_investir"),
      href: "/login",
    },
    {
      color: "#00FF94",
      eyebrow: t("audience_partner"),
      title: "API e webhooks para\nsua plataforma.",
      benefits: [
        "REST + GraphQL endpoints",
        "Webhooks em tempo real",
        "SDKs em JS, Python, Go",
        "Sandbox com dados SEFAZ",
      ],
      cta: t("cta_api"),
      href: "/partner/dashboard",
    },
  ];

  return (
    <section style={{ padding: "80px 0 120px" }}>
      <div className="wrap-wide">
        <h2 style={{ marginBottom: 56, whiteSpace: "pre-line" }}>
          {t("audiences_title")}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
          }}
        >
          {cards.map((c, i) => (
            <div
              key={i}
              className="card"
              style={{
                padding: 28,
                borderColor: `${c.color}30`,
                background: `linear-gradient(180deg, ${c.color}0A, rgba(255,255,255,0.015))`,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div className="row between" style={{ marginBottom: 20 }}>
                <span className="eyebrow" style={{ color: c.color }}>
                  {c.eyebrow}
                </span>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: c.color,
                    boxShadow: `0 0 10px ${c.color}`,
                  }}
                />
              </div>
              <h3
                style={{
                  fontSize: 28,
                  whiteSpace: "pre-line",
                  letterSpacing: "-0.02em",
                  marginBottom: 24,
                }}
              >
                {c.title}
              </h3>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 32,
                }}
              >
                {c.benefits.map((b, j) => (
                  <li
                    key={j}
                    className="row"
                    style={{ gap: 10, fontSize: 13.5, color: "var(--fg-1)" }}
                  >
                    <span style={{ color: c.color, display: "inline-flex" }}>
                      <Icon name="check" size={14} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
              {!publicOnly && (
                <Link
                  className="btn btn-ghost"
                  href={c.href}
                  style={{
                    marginTop: "auto",
                    borderColor: `${c.color}50`,
                    color: c.color,
                  }}
                >
                  {c.cta} <Icon name="arrow_right" size={14} />
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
