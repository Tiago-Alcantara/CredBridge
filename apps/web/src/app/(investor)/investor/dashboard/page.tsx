"use client";

import { useState } from "react";
import type { Receivable } from "@credbridge/types";
import { Icon } from "@/components/primitives/Icon";
import { MiniKpi } from "@/components/patterns/MiniKpi";
import { NavChart } from "@/components/investor/NavChart";
import { ShareCard } from "@/components/investor/ShareCard";
import { PoolToggle, type PoolView } from "@/components/investor/PoolToggle";
import { PoolTable } from "@/components/investor/PoolTable";
import { PositionsTable } from "@/components/investor/PositionsTable";
import { BuyDrawer } from "@/components/investor/BuyDrawer";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { fmtBRL } from "@/lib/format";
import { useInvestorPool, useInvestorStats } from "@/lib/api/receivables";
import { useInvestorPositions, useInvestorPositionStats, useInvestorTransactions } from "@/lib/api/investments";
import { useMe } from "@/lib/api/me";
import { DepositModal } from "@/components/investor/DepositModal";
import { FinalizeAssignmentModal } from "@/components/investor/FinalizeAssignmentModal";

export default function InvestorDashboardPage() {
  const { t } = useTranslation("en");
  const [view, setView] = useState<PoolView>("pool");
  const [buyTarget, setBuyTarget] = useState<Receivable | null>(null);

  // Estados dos novos modais de depósito/aporte
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);

  const { data: pool = [], isLoading: loadingPool } = useInvestorPool();
  const { data: poolStats, isLoading: loadingPoolStats } = useInvestorStats();
  const { data: positions = [], isLoading: loadingPositions, refetch: refetchPositions } = useInvestorPositions();
  const { data: posStats, isLoading: loadingPosStats } = useInvestorPositionStats();
  const { data: me } = useMe();
  const { data: transactions = [], refetch: refetchTransactions } = useInvestorTransactions();

  const isMine = view === "mine";

  const activeDeposits = transactions.filter(
    (tx) => tx.type === "DEPOSIT" && tx.status !== "COMPLETED" && tx.status !== "REJECTED"
  );

  const goToPool = () => {
    setView("pool");
    requestAnimationFrame(() => {
      document.getElementById("pool-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const headerValue = isMine
    ? posStats?.totalInvested ?? 0
    : poolStats?.totalValue ?? 0;
  const headerSub = isMine
    ? `${posStats?.activePositions ?? 0} ${t("inv_active_shares")}`
    : `${poolStats?.poolCount ?? 0} ${t("inv_in_pool")}`;
  const headerLoading = isMine ? loadingPosStats : loadingPoolStats;

  return (
    <>
      {/* Header */}
      <div className="row between" style={{ marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{t("inv_overview")}</div>
          <h2 style={{ fontSize: 32 }}>{t("inv_title")}</h2>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost">
            <Icon name="download" size={14} /> {t("inv_report")}
          </button>
          <button
            className="btn btn-violet"
            onClick={goToPool}
          >
            <Icon name="plus" size={14} /> {t("inv_buy")}
          </button>
        </div>
      </div>

      {/* Seção de Aportes Ativos */}
      {activeDeposits.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {activeDeposits.map((dep) => (
            <div
              key={dep.id}
              className="card"
              style={{
                padding: "20px 24px",
                background: "linear-gradient(90deg, rgba(0, 212, 255, 0.05) 0%, rgba(123, 47, 255, 0.05) 100%)",
                border: "1px solid var(--line)",
                borderRadius: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "var(--surface)",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid var(--line-2)",
                  }}
                >
                  <span
                    style={{
                      color:
                        dep.status === "PENDING_PAYMENT"
                          ? "var(--accent)"
                          : dep.status === "PAYMENT_SUBMITTED"
                          ? "#FFE600"
                          : "#00FF94",
                    }}
                  >
                    <Icon
                      name={
                        dep.status === "PENDING_PAYMENT"
                          ? "wallet"
                          : dep.status === "PAYMENT_SUBMITTED"
                          ? "download"
                          : "check"
                      }
                      size={20}
                    />
                  </span>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 600 }}>{t("inv_dep_order_received")}</h4>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 99,
                        fontSize: 10,
                        fontWeight: 600,
                        background:
                          dep.status === "PENDING_PAYMENT"
                            ? "rgba(0, 212, 255, 0.1)"
                            : dep.status === "PAYMENT_SUBMITTED"
                            ? "rgba(255, 230, 0, 0.1)"
                            : "rgba(0, 255, 148, 0.1)",
                        color:
                          dep.status === "PENDING_PAYMENT"
                            ? "var(--accent)"
                            : dep.status === "PAYMENT_SUBMITTED"
                            ? "#FFE600"
                            : "#00FF94",
                      }}
                    >
                      {dep.status === "PENDING_PAYMENT"
                        ? t("inv_status_awaiting_pix")
                        : dep.status === "PAYMENT_SUBMITTED"
                        ? t("inv_status_pix_sent")
                        : t("inv_status_released_onchain")}
                    </span>
                  </div>
                  <p className="t-3" style={{ fontSize: 12.5, marginTop: 4 }}>
                    {dep.status === "PENDING_PAYMENT"
                      ? t("inv_dep_desc_pending")
                      : dep.status === "PAYMENT_SUBMITTED"
                      ? t("inv_dep_desc_submitted")
                      : t("inv_dep_desc_approved")}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ textAlign: "right" }}>
                  <span className="t-3" style={{ fontSize: 11 }}>{t("inv_value_label")}</span>
                  <div className="num" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
                    {fmtBRL(dep.amount)}
                  </div>
                </div>

                {dep.status === "PENDING_PAYMENT" && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setSelectedTransaction(dep);
                      setDepositModalOpen(true);
                    }}
                  >
                    {t("inv_make_pix_payment")} <Icon name="arrow_right" size={12} />
                  </button>
                )}

                {dep.status === "PAYMENT_SUBMITTED" && (
                  <button className="btn btn-ghost" disabled style={{ opacity: 0.8 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        border: "2px solid var(--line)",
                        borderTopColor: "#FFE600",
                        animation: "spin 0.8s linear infinite",
                        marginRight: 6,
                        display: "inline-block",
                      }}
                    />
                    {t("inv_awaiting_reconciliation")}
                  </button>
                )}

                {dep.status === "APPROVED" && (
                  <button
                    className="btn btn-violet"
                    onClick={() => {
                      setSelectedTransaction(dep);
                      setFinalizeModalOpen(true);
                    }}
                    style={{
                      background: "linear-gradient(135deg, #7B2FFF 0%, #5E1EC3 100%)",
                      border: "none",
                      boxShadow: "0 0 20px rgba(123, 47, 255, 0.4)",
                    }}
                  >
                    {t("inv_finalize_contribution")} <Icon name="bolt" size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI row */}
      <div
        className="grid-kpi"
        style={{ marginBottom: 24 }}
      >
        <div className="card violet-hi" style={{ padding: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            {t("inv_invested")}
          </div>
          <div className="kpi kpi-lg num">
            {headerLoading ? <span className="t-3">—</span> : <span>{fmtBRL(headerValue)}</span>}
          </div>
          <div className="row" style={{ gap: 16, marginTop: 14, fontSize: 12.5 }}>
            <span className="t-2">{headerSub}</span>
          </div>
        </div>
        <MiniKpi
          label={isMine ? t("inv_expected_return") : t("inv_nav")}
          value={
            isMine
              ? posStats
                ? fmtBRL(posStats.expectedReturn)
                : "—"
              : "1.186"
          }
          sub={isMine ? t("inv_at_maturity") : t("inv_per_share")}
          color="#00D4FF"
          icon="chart"
        />
        <MiniKpi label={t("inv_yield")} value="18.6%" sub={t("inv_last_12m")} color="#00FF94" icon="arrow_up_right" />
        <MiniKpi label={t("inv_liquidity_d")} value="D+2" sub="via Stellar DEX" color="#7B2FFF" icon="bolt" />
      </div>

      {/* Chart + shares */}
      <div
        className="grid-split"
        style={{ marginBottom: 24 }}
      >
        <div className="card" style={{ padding: 24 }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <h3>{t("inv_nav_chart")}</h3>
            <div className="row" style={{ gap: 4 }}>
              {(["1M", "3M", "6M", "1Y", "Max"] as const).map((p, i) => (
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
                {headerLoading ? "—" : fmtBRL(headerValue)}
              </div>
              <div className="row" style={{ gap: 8, fontSize: 12 }}>
                <span className="t-3">{isMine ? t("inv_your_positions") : t("inv_pool_total")}</span>
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
            value={headerLoading ? "—" : fmtBRL(headerValue)}
            yieldVal="—"
            desc={t("inv_fund_shares")}
          />
          <div className="card" style={{ padding: 16, display: "flex", gap: 10 }}>
            <button className="btn btn-primary grow" onClick={goToPool}>
              <Icon name="plus" size={14} /> {t("inv_buy")}
            </button>
          </div>
        </div>
      </div>

      {/* Pool / Positions table */}
      <div id="pool-table" className="card" style={{ padding: 0 }}>
        <div
          className="row between"
          style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}
        >
          <div>
            <h3>{isMine ? t("inv_my_shares") : t("inv_receivables")}</h3>
            <p className="t-3" style={{ fontSize: 12, marginTop: 4 }}>
              {isMine? loadingPositions
                  ? t("dash_loading")
                  : `${positions.length} ${t("inv_positions_proof")}`
                : loadingPool
                ? t("dash_loading")
                : `${poolStats?.poolCount ?? 0} ${t("inv_assets_proof")}`}
            </p>
          </div>
          <PoolToggle value={view} onChange={setView} />
        </div>
        {isMine ? (
          <PositionsTable positions={positions} loading={loadingPositions} />
        ) : (
          <PoolTable pool={pool} loading={loadingPool} onBuy={(r) => setBuyTarget(r)} />
        )}
      </div>

       <BuyDrawer
        receivable={buyTarget}
        userEmail={me?.email}
        onClose={() => setBuyTarget(null)}
        onSuccess={() => setView("mine")}
      />

      <DepositModal
        isOpen={depositModalOpen}
        transaction={selectedTransaction}
        onClose={() => {
          setDepositModalOpen(false);
          setSelectedTransaction(null);
        }}
        onSuccess={() => {
          refetchTransactions();
        }}
      />

      <FinalizeAssignmentModal
        isOpen={finalizeModalOpen}
        transaction={selectedTransaction}
        userEmail={me?.email}
        onClose={() => {
          setFinalizeModalOpen(false);
          setSelectedTransaction(null);
        }}
        onSuccess={() => {
          refetchTransactions();
          refetchPositions();
          setView("mine");
        }}
      />
    </>
  );
}
