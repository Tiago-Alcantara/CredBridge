import { Skeleton } from "@/components/primitives/Skeleton";

const ROWS = 5;

const COLS: { width: string | number; subWidth?: string | number }[] = [
  { width: 88 },
  { width: 140, subWidth: 80 },
  { width: 72 },
  { width: 56 },
  { width: 72 },
  { width: 60, subWidth: 44 },
  { width: 64 },
  { width: 24 },
];

export function InvoiceTableSkeleton() {
  return (
    <table className="tbl">
      <thead>
        <tr>
          {["NF-e", "Sacado", "Valor", "Deságio", "Líquido", "Vencimento", "Status", ""].map(
            (h) => (
              <th key={h}>{h}</th>
            )
          )}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: ROWS }).map((_, i) => (
          <tr key={i}>
            {COLS.map((col, j) => (
              <td key={j}>
                <Skeleton width={col.width} height={13} />
                {col.subWidth && (
                  <Skeleton
                    width={col.subWidth}
                    height={11}
                    style={{ marginTop: 5 }}
                  />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
