"use client";

export type PoolView = "pool" | "mine";

interface PoolToggleProps {
  value: PoolView;
  onChange: (next: PoolView) => void;
}

const OPTIONS: { value: PoolView; label: string }[] = [
  { value: "pool", label: "Pool" },
  { value: "mine", label: "Minhas cotas" },
];

export function PoolToggle({ value, onChange }: PoolToggleProps) {
  return (
    <div
      className="row"
      style={{
        gap: 4,
        padding: 4,
        border: "1px solid var(--line)",
        borderRadius: 10,
        background: "var(--surface-2)",
      }}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="btn btn-sm"
            style={{
              background: active ? "var(--surface)" : "transparent",
              borderColor: active ? "var(--line-2)" : "transparent",
              color: active ? "var(--fg-1)" : "var(--fg-2)",
              fontWeight: active ? 600 : 500,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
