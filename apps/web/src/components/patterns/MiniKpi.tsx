import { Icon } from "@/components/primitives/Icon";
import type { IconName } from "@/components/primitives/Icon";

interface MiniKpiProps {
  label: string;
  value: string;
  sub: string;
  color: string;
  icon: IconName;
}

export function MiniKpi({ label, value, sub, color, icon }: MiniKpiProps) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <span className="eyebrow">{label}</span>
        <span style={{ color, display: "inline-flex" }}>
          <Icon name={icon} size={14} />
        </span>
      </div>
      <div className="kpi num" style={{ fontSize: 26 }}>
        {value}
      </div>
      <div className="t-2" style={{ fontSize: 12, marginTop: 6 }}>
        {sub}
      </div>
    </div>
  );
}
