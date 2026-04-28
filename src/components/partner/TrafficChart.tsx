const data = [
  0.72, 0.85, 0.63, 0.91, 0.78, 0.54, 0.88, 0.67, 0.95, 0.71, 0.83, 0.60,
  0.89, 0.74, 0.56, 0.92, 0.68, 0.80, 0.65, 0.93, 0.77, 0.59, 0.87, 0.70,
  0.82, 0.61, 0.90, 0.75, 0.57, 0.94, 0.69, 0.81, 0.64, 0.91, 0.76, 0.58,
  0.86, 0.71, 0.83, 0.62, 0.89, 0.73, 0.55, 0.92, 0.66, 0.79, 0.63, 0.88,
];

export function TrafficChart() {
  const width = 576;
  const height = 120;
  const barWidth = 10;
  const gap = 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.85} />
          <stop offset="100%" stopColor="#00D4FF" stopOpacity={0.25} />
        </linearGradient>
      </defs>
      {data.map((v, i) => {
        const barHeight = Math.round(v * height);
        const x = i * (barWidth + gap);
        const y = height - barHeight;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={2}
            fill="url(#tg)"
          />
        );
      })}
    </svg>
  );
}
