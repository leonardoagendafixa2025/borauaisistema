interface Props {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  fill?: boolean;
}

export default function Sparkline({ data, color = 'hsl(var(--primary))', height = 32, width = 96, fill = true }: Props) {
  if (!data.length) return <svg width={width} height={height} aria-hidden />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M ${points.join(' L ')}`;
  const area = `${path} L ${width},${height} L 0,${height} Z`;
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      {data.length > 0 && (
        <circle
          cx={(data.length - 1) * stepX}
          cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}
          r="2.5"
          fill={color}
        />
      )}
    </svg>
  );
}
