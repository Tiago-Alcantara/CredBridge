"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";

export function StatsBar() {
  const { t } = useTranslation("en");

  const stats = [
    { label: t("stat_anticipated"), value: "R$ 128.4M", sub: t("stat_anticipated_sub") },
    { label: t("stat_smes"), value: "1,847", sub: t("stat_smes_sub") },
    { label: t("stat_yield"), value: "18.6%", sub: t("stat_yield_sub") },
    { label: t("stat_nav"), value: "R$ 92.1M", sub: t("stat_nav_sub") },
  ];

  return (
    <section style={{ padding: "24px 0 24px" }}>
      <div className="wrap-wide">
        <div
          className="card"
          style={{
            padding: 0,
            overflow: "hidden",
            borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          <div className="grid-kpi">
            {stats.map((s, i) => (
              <div
                key={i}
                style={{
                  padding: "28px 28px",
                  borderLeft: i ? "1px solid var(--line)" : "none",
                }}
              >
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  {s.label}
                </div>
                <div className="kpi" style={{ fontSize: 32 }}>
                  {s.value}
                </div>
                <div className="t-2" style={{ fontSize: 12, marginTop: 6 }}>
                  {s.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
