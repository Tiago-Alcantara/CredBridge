import { Icon } from "@/components/primitives/Icon";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { fmtBRL } from "@/lib/format";
import type { ReceivableStatus } from "@/types";

export interface InvoiceRow {
  nfe: string;
  sacado: string;
  cnpj: string;
  valor: number;
  desagio: number;
  liquido: number;
  due: string;
  status: ReceivableStatus;
  days: number;
}

interface InvoiceTableProps {
  rows: InvoiceRow[];
  compact?: boolean;
}

export function InvoiceTable({ rows, compact = false }: InvoiceTableProps) {
  const visibleRows = compact ? rows.slice(0, 4) : rows;

  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>NF-e</th>
          <th>Sacado</th>
          <th style={{ textAlign: "right" }}>Valor</th>
          {!compact && <th style={{ textAlign: "right" }}>Deságio</th>}
          <th style={{ textAlign: "right" }}>Líquido</th>
          <th>Vencimento</th>
          <th>Status</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {visibleRows.map((r) => (
          <tr key={r.nfe}>
            <td>
              <span className="mono" style={{ fontSize: 13 }}>
                {r.nfe}
              </span>
            </td>
            <td>
              <div style={{ fontWeight: 500 }}>{r.sacado}</div>
              <div className="mono t-3" style={{ fontSize: 11 }}>
                {r.cnpj}
              </div>
            </td>
            <td className="num" style={{ textAlign: "right", fontWeight: 500 }}>
              {fmtBRL(r.valor)}
            </td>
            {!compact && (
              <td
                className="num"
                style={{ textAlign: "right", color: "var(--fg-2)" }}
              >
                {r.desagio.toFixed(2).replace(".", ",")}%
              </td>
            )}
            <td
              className="num"
              style={{
                textAlign: "right",
                fontWeight: 600,
                color:
                  r.status === "defaulted"
                    ? "var(--red)"
                    : r.status === "settled"
                    ? "var(--green)"
                    : "var(--fg)",
              }}
            >
              {fmtBRL(r.liquido)}
            </td>
            <td>
              <div style={{ fontSize: 13 }}>{r.due}</div>
              <div className="t-3" style={{ fontSize: 11 }}>
                {r.days > 0
                  ? `em ${r.days}d`
                  : r.days < 0
                  ? `${Math.abs(r.days)}d atraso`
                  : "hoje"}
              </div>
            </td>
            <td>
              <StatusBadge status={r.status} lang="pt" />
            </td>
            <td style={{ textAlign: "right" }}>
              <button
                className="btn btn-ghost btn-sm"
                aria-label="verify"
              >
                <Icon name="chain" size={12} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
