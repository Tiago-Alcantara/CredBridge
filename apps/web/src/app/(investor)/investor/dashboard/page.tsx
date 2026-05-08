"use client";

import { Icon } from "@/components/primitives/Icon";
import { MiniKpi } from "@/components/patterns/MiniKpi";
import { NavChart } from "@/components/investor/NavChart";
import { ShareCard } from "@/components/investor/ShareCard";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { fmtBRL } from "@/lib/format";
import { useInvestorPool, useInvestorStats } from "@/lib/api/receivables";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function shortTx(tx: string): string {
  return tx.length > 10 ? `${tx.slice(0, 6)}…${tx.slice(-3)}` : tx;
}

export default function InvestorDashboardPage() {
  const { t } = useTranslation("pt");
  const { data: pool = [], isLoading: loadingPool } = useInvestorPool();
  const { data: stats, isLoading: loadingStats } = useInvestorStats();

  const totalValue = stats?.totalValue ?? 0;
  const poolCount = stats?.poolCount ?? 0;

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
            {loadingStats ? (
              <span className="t-3">—</span>
            ) : (
              <span>{fmtBRL(totalValue)}</span>
            )}
          </div>
          <div className="row" style={{ gap: 16, marginTop: 14, fontSize: 12.5 }}>
            <span className="t-2">{poolCount} recebíveis no pool</span>
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
                {loadingStats ? "—" : fmtBRL(totalValue)}
              </div>
              <div className="row" style={{ gap: 8, fontSize: 12 }}>
                <span className="t-3">Pool total</span>
              </div>
            </div>
          </div>
          <NavChart />
        </div>

        <div className="col" style={{ gap: 12 }}>
          <ShareCard
            title={t("inv_shares")}
            color="#00D4FF"
            allocation="100%"
            value={loadingStats ? "—" : fmtBRL(totalValue)}
            yieldVal="—"
            desc="Cotas do fundo"
          />
          <div className="card" style={{ padding: 16, display: "flex", gap: 10 }}>
            <button className="btn btn-primary grow">
              <Icon name="plus" size={14} /> {t("inv_buy")}
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
              {loadingPool ? "Carregando…" : `${poolCount} ativos · todos com prova on-chain`}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm">
            {t("view_all")} <Icon name="arrow_right" size={12} />
          </button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Sacado</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Valor</th>
              <th>Vencimento</th>
              <th>Prova on-chain</th>
            </tr>
          </thead>
          <tbody>
            {loadingPool ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--fg-3)" }}>
                  Carregando recebíveis…
                </td>
              </tr>
            ) : pool.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--fg-3)" }}>
                  Nenhum recebível disponível no pool.
                </td>
              </tr>
            ) : (
              pool.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="mono">{shortId(r.id)}</span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{r.debtorName}</td>
                  <td>
                    <span
                      className="badge neutral no-dot"
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        color: r.status === "active" ? "var(--green)" : "var(--blue)",
                      }}
                    >
                      {r.status === "active" ? "Ativo" : "Validado"}
                    </span>
                  </td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 500 }}>
                    {fmtBRL(r.value)}
                  </td>
                  <td style={{ fontSize: 13 }}>{fmtDate(r.dueDate)}</td>
                  <td>
                    {r.txHash ? (
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
                        <Icon name="chain" size={12} /> {shortTx(r.txHash)}
                      </a>
                    ) : (
                      <span className="t-3" style={{ fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
