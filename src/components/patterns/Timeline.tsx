type TimelineItemKind = "green" | "blue" | "violet";

export interface TimelineItem {
  time: string;
  label: string;
  value: string;
  kind: TimelineItemKind;
}

interface TimelineProps {
  items: TimelineItem[];
}

const kindColorMap: Record<TimelineItemKind, string> = {
  green:  "var(--green)",
  blue:   "var(--blue)",
  violet: "var(--violet)",
};

const kindTextClassMap: Record<TimelineItemKind, string> = {
  green:  "t-green",
  blue:   "t-blue",
  violet: "t-violet",
};

export function Timeline({ items }: TimelineProps) {
  return (
    <div style={{ padding: "4px 4px" }}>
      {items.map((item, index) => {
        const dotColor = kindColorMap[item.kind];
        const textClass = kindTextClassMap[item.kind];
        const isLast = index === items.length - 1;

        return (
          <div
            key={index}
            className="row"
            style={{
              gap: 14,
              padding: "14px 20px",
              borderBottom: isLast ? "none" : "1px solid var(--line)",
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                marginTop: 6,
                flexShrink: 0,
                background: dotColor,
                boxShadow: `0 0 8px ${dotColor}`,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: "var(--fg-1)" }}>
                {item.label}
              </div>
              <div className="t-3" style={{ fontSize: 11, marginTop: 2 }}>
                {item.time}
              </div>
            </div>
            <span
              className={`num ${textClass}`}
              style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}
            >
              {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
