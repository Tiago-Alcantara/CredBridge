"use client";

import type { Receivable } from "@credbridge/types";
import { Icon } from "@/components/primitives/Icon";
import { fmtBRL } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface PoolTableProps {
  pool: Receivable[];
  loading: boolean;
  onBuy: (r: Receivable) => void;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
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

export function PoolTable({ pool, loading, onBuy }: PoolTableProps) {
  const { t } = useTranslation("en");
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>ID</th>
          <th>{t("tbl_debtor")}</th>
          <th>Status</th>
          <th style={{ textAlign: "right" }}>{t("tbl_value")}</th>
          <th>{t("tbl_due")}</th>
          <th>{t("tbl_onchain_proof")}</th>
          <th style={{ textAlign: "right" }}>{t("tbl_action")}</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--fg-3)" }}>
              {t("tbl_loading_receivables")}
            </td>
          </tr>
        ) : pool.length === 0 ? (
          <tr>
            <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--fg-3)" }}>
              {t("tbl_no_receivables_available")}
            </td>
          </tr>
        ) : (
          pool.map((r) => (
            <tr key={r.id}>
              <td><span className="mono">{shortId(r.id)}</span></td>
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
                  {r.status === "active" ? t("op_active") : t("status_validated")}
                </span>
              </td>
              <td className="num" style={{ textAlign: "right", fontWeight: 500 }}>
                {fmtBRL(r.value)}
              </td>
              <td style={{ fontSize: 13 }}>{fmtDate(r.dueDate)}</td>
              <td>
                {r.txHash ? (
                  <span className="row" style={{ gap: 6, fontSize: 12.5, color: "var(--blue)", fontFamily: "var(--mono)" }}>
                    <Icon name="chain" size={12} /> {shortTx(r.txHash)}
                  </span>
                ) : (
                  <span className="t-3" style={{ fontSize: 12 }}>—</span>
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                <button className="btn btn-violet btn-sm" onClick={() => onBuy(r)}>
                  <Icon name="plus" size={12} /> {t("tbl_buy")}
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
