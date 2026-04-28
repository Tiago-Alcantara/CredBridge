"use client";

import { Icon } from "@/components/primitives/Icon";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { HeroNetworkBG } from "./HeroNetworkBG";

export function HeroNetwork() {
  const { t } = useTranslation("pt");
  const title = t("hero_title");

  return (
    <section
      style={{
        position: "relative",
        paddingTop: 80,
        paddingBottom: 120,
        overflow: "hidden",
      }}
    >
      <HeroNetworkBG />
      <div className="wrap-wide" style={{ position: "relative" }}>
        <div className="chip" style={{ marginBottom: 24 }}>
          <span className="dot-live" />
          <span>{t("hero_eyebrow")}</span>
        </div>
        <h1
          className="glow-blue"
          style={{ maxWidth: 960, whiteSpace: "pre-line" }}
        >
          {title}
        </h1>
        <p
          style={{
            maxWidth: 620,
            color: "var(--fg-1)",
            fontSize: 18,
            marginTop: 28,
            lineHeight: 1.55,
          }}
        >
          {t("hero_sub")}
        </p>
        <div
          className="row"
          style={{ marginTop: 40, gap: 12, flexWrap: "wrap" }}
        >
          <a className="btn btn-primary btn-lg" href="/login">
            {t("cta_antecipar")} <Icon name="arrow_right" size={16} />
          </a>
          <a className="btn btn-ghost btn-lg" href="/login">
            {t("cta_investir")}
          </a>
          <a className="btn btn-ghost btn-lg" href="/partner/dashboard">
            {t("cta_api")} <Icon name="code" size={16} />
          </a>
        </div>
        <div
          className="row"
          style={{
            gap: 32,
            marginTop: 56,
            color: "var(--fg-2)",
            fontSize: 13,
            flexWrap: "wrap",
          }}
        >
          <span className="row" style={{ gap: 8 }}>
            <Icon name="shield" size={14} /> Auditoria Soroban
          </span>
          <span className="row" style={{ gap: 8 }}>
            <Icon name="check" size={14} /> Validação SEFAZ
          </span>
          <span className="row" style={{ gap: 8 }}>
            <Icon name="chain" size={14} /> Liquidação verificável
          </span>
          <span className="row" style={{ gap: 8 }}>
            <Icon name="bolt" size={14} /> Pix em &lt; 2 min
          </span>
        </div>
      </div>
    </section>
  );
}
