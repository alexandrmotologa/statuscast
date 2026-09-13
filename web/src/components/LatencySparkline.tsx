import React, { useState } from 'react';
import { LatencySample } from '../types.js';
import { Zap } from 'lucide-react';

interface Props {
  samples: LatencySample[];
  averageMs?: number;
}

export const LatencySparkline: React.FC<Props> = ({ samples, averageMs }) => {
  const [hoveredSample, setHoveredSample] = useState<LatencySample | null>(null);

  if (!samples || samples.length === 0) return null;

  const latencies = samples.map((s) => s.latencyMs);
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);
  const avg = averageMs || Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

  const width = 280;
  const height = 28;
  const range = max - min || 1;

  // Generate SVG points
  const points = samples.map((s, idx) => {
    const x = (idx / (samples.length - 1 || 1)) * width;
    const y = height - ((s.latencyMs - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  const getLatencyColor = (val: number) => {
    if (val < 60) return { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.15)' };
    if (val < 150) return { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.15)' };
    return { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.15)' };
  };

  const colors = getLatencyColor(avg);

  return (
    <div className="mt-2.5 pt-2.5 border-t border-zinc-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
        <Zap className="w-3 h-3 text-emerald-400" />
        <span>24h Avg:</span>
        <span className="font-bold text-zinc-200">{avg}ms</span>
        <span className="text-zinc-400">({min}ms – {max}ms)</span>
      </div>

      <div className="relative w-full sm:w-48 h-7">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <path d={areaD} fill={colors.fill} />
          <path
            d={pathD}
            fill="none"
            stroke={colors.stroke}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {samples.map((s, idx) => {
            const x = (idx / (samples.length - 1 || 1)) * width;
            const y = height - ((s.latencyMs - min) / range) * (height - 6) - 3;
            return (
              <circle
                key={s.id || idx}
                cx={x}
                cy={y}
                r={hoveredSample === s ? 3.5 : 1.5}
                fill={colors.stroke}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredSample(s)}
                onMouseLeave={() => setHoveredSample(null)}
              />
            );
          })}
        </svg>

        {hoveredSample && (
          <div className="absolute -top-7 right-0 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-700 text-[10px] font-mono text-zinc-200 shadow-md">
            {hoveredSample.latencyMs}ms ({new Date(hoveredSample.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
          </div>
        )}
      </div>
    </div>
  );
};
