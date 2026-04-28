import type { ReactNode } from "react";

interface PipelineColProps {
  title: string;
  count: number;
  color: string;
  children: ReactNode;
}

export function PipelineCol({ title, count, color, children }: PipelineColProps) {
  return (
    <div
      className="card"
      style={{
        padding: 0,
        borderColor: `${color}25`,
        background: `linear-gradient(180deg, ${color}08, rgba(255,255,255,0.01))`,
        overflow: "hidden",
      }}
    >
      <div
        className="row between"
        style={{
          padding: "14px 16px",
          borderBottom: `1px solid ${color}20`,
        }}
      >
        <span
          className="eyebrow"
          style={{ color, letterSpacing: "0.14em" }}
        >
          {title}
        </span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            color: "var(--fg-2)",
          }}
        >
          {count}
        </span>
      </div>
      <div
        style={{
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 180,
        }}
      >
        {children}
      </div>
    </div>
  );
}
