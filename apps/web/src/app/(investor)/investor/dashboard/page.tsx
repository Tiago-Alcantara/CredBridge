"use client";

import { Icon } from "@/components/primitives/Icon";
import { MiniKpi } from "@/components/patterns/MiniKpi";
import { NavChart } from "@/components/investor/NavChart";
import { ShareCard } from "@/components/investor/ShareCard";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { fmtBRL } from "@/lib/format";

interface Receivable {
  nfe: string;
  sacado: string;
  score: string;
  valor: number;
  yield: number;
  due: string;
  tx: string;
}

const invReceivables: Receivable[] = [
  { nfe: "428.551", sacado: "Magazine Luiza", score: "AAA", valor: 182450,  yield: 18.4, due: "12 mai", tx: "0xA7F2…91C" },
  { nfe: "428.539", sacado: "Via Varejo",      score: "AA",  valor: 94200,  yield: 19.1, due: "04 mai", tx: "0xB3D1…88F" },
  { nfe: "428.502", sacado: "Americanas",      score: "A+",  valor: 246800, yield: 22.8, due: "22 mai", tx: "0xC9E4…42B" },
  { nfe: "428.488", sacado: "Lojas Renner",    score: "AAA", valor: 58120,  yield: 17.2, due: "29 abr", tx: "0xD2A7…10E" },
  { nfe: "428.477", sacado: "Havan",           score: "AA",  valor: 88710,  yield: 20.4, due: "14 mai", tx: "0xE881…75C" },
];

function scoreColor(score: string): string {
  if (score.startsWith("AAA")) return "var(--green)";
  if (score.startsWith("AA")) return "var(--blue)";
  return "var(--amber)";
}

export default function InvestorDashboardPage() {
  const { t } = useTranslation("pt");

  return (
    <>
      {/* Header */}
      <div className="row between" style={{ marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{t("inv_overview")}</div>
          <h2 style={{ fontSize: 32 }}>Seu portfólio</h2>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost">
            <Icon name="download" size={14} /> Relatório
          </button>
          <button className="btn btn-violet">
            <Icon name="plus" size={14} /> {t("inv_buy")}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card violet-hi" style={{ padding: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{t("inv_invested")}</div>
          <div className="kpi kpi-lg num">
            <span className="unit">R$</span>2.450.000
            <span style={{ color: "var(--fg-2)", fontWeight: 500 }}>,00</span>
          </div>
          <div className="row" style={{ gap: 16, marginTop: 14, fontSize: 12.5 }}>
            <span className="t-2">NAV R$ 2.906.342</span>
            <span className="t-green">▲ R$ 456.342 · 18,6%</span>
          </div>
          <div className="progress" style={{ marginTop: 18 }}>
            <i style={{ width: "64%" }} />
          </div>
          <div
            className="row between"
            style={{ marginTop: 8, fontSize: 11, color: "var(--fg-3)" }}
          >
            <span>Sênior 64%</span>
            <span>Anjo 36%</span>
          </div>
        </div>
        <MiniKpi label={t("inv_nav")} value="1,186" sub="por cota" color="#00D4FF" icon="chart" />
        <MiniKpi label={t("inv_yield")} value="18,6%" sub="últimos 12m" color="#00FF94" icon="arrow_up_right" />
        <MiniKpi label="Liquidez D+" value="D+2" sub="via Stellar DEX" color="#7B2FFF" icon="bolt" />
      </div>

      {/* Chart + shares */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card" style={{ padding: 24 }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <h3>{t("inv_nav_chart")}</h3>
            <div className="row" style={{ gap: 4 }}>
              {(["1M", "3M", "6M", "1A", "Máx"] as const).map((p, i) => (
                <button
                  key={p}
                  className="btn btn-ghost btn-sm"
                  style={{
                    background: i === 3 ? "var(--surface-2)" : "transparent",
                    borderColor: i === 3 ? "var(--line-2)" : "transparent",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="row" style={{ gap: 24, marginBottom: 10 }}>
            <div>
              <div className="kpi num" style={{ fontSize: 28 }}>
                R$ 2.906.342
              </div>
              <div className="row" style={{ gap: 8, fontSize: 12 }}>
                <span className="t-green">▲ R$ 38.492 hoje</span>
                <span className="t-3">· +1,34%</span>
              </div>
            </div>
          </div>
          <NavChart />
        </div>

        <div className="col" style={{ gap: 12 }}>
          <ShareCard
            title={t("inv_senior")}
            color="#00D4FF"
            allocation="64%"
            value="R$ 1.568.000"
            yieldVal="CDI + 4,8%"
            desc={t("inv_senior_desc")}
          />
          <ShareCard
            title={t("inv_angel")}
            color="#7B2FFF"
            allocation="36%"
            value="R$ 882.000"
            yieldVal="CDI + 14,2%"
            desc={t("inv_angel_desc")}
          />
          <div className="card" style={{ padding: 16, display: "flex", gap: 10 }}>
            <button className="btn btn-primary grow">
              <Icon name="plus" size={14} /> {t("inv_buy")}
            </button>
            <button className="btn btn-ghost grow">
              <Icon name="arrow_up_right" size={14} /> {t("inv_sell")}
            </button>
          </div>
        </div>
      </div>

      {/* Receivables table */}
      <div className="card" style={{ padding: 0 }}>
        <div
          className="row between"
          style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}
        >
          <div>
            <h3>{t("inv_receivables")}</h3>
            <p className="t-3" style={{ fontSize: 12, marginTop: 4 }}>
              342 ativos · todos com prova on-chain
            </p>
          </div>
          <button className="btn btn-ghost btn-sm">
            {t("view_all")} <Icon name="arrow_right" size={12} />
          </button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>NF-e</th>
              <th>Sacado</th>
              <th>Rating</th>
              <th style={{ textAlign: "right" }}>Valor</th>
              <th style={{ textAlign: "right" }}>Yield</th>
              <th>Vencimento</th>
              <th>Prova on-chain</th>
            </tr>
          </thead>
          <tbody>
            {invReceivables.map((r) => (
              <tr key={r.nfe}>
                <td>
                  <span className="mono">{r.nfe}</span>
                </td>
                <td style={{ fontWeight: 500 }}>{r.sacado}</td>
                <td>
                  <span
                    className="badge neutral no-dot"
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      color: scoreColor(r.score),
                    }}
                  >
                    {r.score}
                  </span>
                </td>
                <td className="num" style={{ textAlign: "right", fontWeight: 500 }}>
                  {fmtBRL(r.valor)}
                </td>
                <td className="num t-green" style={{ textAlign: "right", fontWeight: 600 }}>
                  {r.yield.toFixed(1).replace(".", ",")}%
                </td>
                <td style={{ fontSize: 13 }}>{r.due}</td>
                <td>
                  <a
                    href="#"
                    className="row"
                    style={{
                      gap: 6,
                      fontSize: 12.5,
                      color: "var(--blue)",
                      textDecoration: "none",
                      fontFamily: "var(--mono)",
                    }}
                  >
                    <Icon name="chain" size={12} /> {r.tx}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
