"use client";

import type { Investment } from "@credbridge/types";
import { fmtBRL } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface PositionsTableProps {
  positions: Investment[];
  loading: boolean;
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

function statusMeta(s: Investment["status"]): { key: string; color: string } {
  if (s === "settled") return { key: "status_settled", color: "var(--green)" };
  if (s === "defaulted") return { key: "status_defaulted", color: "var(--red)" };
  return { key: "status_active", color: "var(--blue)" };
}

export function PositionsTable({ positions, loading }: PositionsTableProps) {
  const { t } = useTranslation("en");
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>ID</th>
          <th>{t("tbl_debtor")}</th>
          <th style={{ textAlign: "right" }}>{t("tbl_paid")}</th>
          <th style={{ textAlign: "right" }}>Face</th>
          <th style={{ textAlign: "right" }}>{t("tbl_profit")}</th>
          <th>{t("tbl_due")}</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--fg-3)" }}>
              {t("tbl_loading_positions")}
            </td>
          </tr>
        ) : positions.length === 0 ? (
          <tr>
            <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--fg-3)" }}>
              {t("tbl_no_positions")}
            </td>
          </tr>
        ) : (
          positions.map((p) => {
            const profit = p.faceValue - p.amountPaid;
            const s = statusMeta(p.status);
            return (
              <tr key={p.id}>
                <td><span className="mono">{shortId(p.id)}</span></td>
                <td style={{ fontWeight: 500 }}>{p.receivable?.debtorName ?? "—"}</td>
                <td className="num" style={{ textAlign: "right" }}>{fmtBRL(p.amountPaid)}</td>
                <td className="num" style={{ textAlign: "right" }}>{fmtBRL(p.faceValue)}</td>
                <td className="num t-green" style={{ textAlign: "right", fontWeight: 600 }}>
                  {fmtBRL(profit)}
                </td>
                <td style={{ fontSize: 13 }}>
                  {p.receivable ? fmtDate(p.receivable.dueDate) : "—"}
                </td>
                <td>
                  <span
                    className="badge neutral no-dot"
                    style={{ fontFamily: "var(--mono)", fontSize: 11, color: s.color }}
                  >
                    {t(s.key as Parameters<typeof t>[0])}
                  </span>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
