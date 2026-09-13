import React, { useState } from 'react';
import { Component, ComponentStatus, DailyUptime } from '../types.js';
import { Activity, Globe } from 'lucide-react';
import { LatencySparkline } from './LatencySparkline.js';

interface Props {
  component: Component;
}

export const ComponentUptimeBar: React.FC<Props> = ({ component }) => {
  const [hoveredDay, setHoveredDay] = useState<DailyUptime | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const getStatusBadge = (status: ComponentStatus) => {
    switch (status) {
      case 'OPERATIONAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Operational
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Degraded
          </span>
        );
      case 'PARTIAL_OUTAGE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            Partial Outage
          </span>
        );
      case 'MAJOR_OUTAGE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Major Outage
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Maintenance
          </span>
        );
    }
  };

  const getPillColor = (day: DailyUptime) => {
    if (day.uptimePct >= 100) return 'bg-emerald-500 hover:bg-emerald-400';
    if (day.uptimePct >= 99) return 'bg-emerald-400/90 hover:bg-emerald-300';
    if (day.uptimePct >= 95) return 'bg-amber-400 hover:bg-amber-300';
    return 'bg-rose-500 hover:bg-rose-400';
  };

  // Pad history to 90 items if database returned fewer
  const history = component.uptimeHistory || [];
  const daysToRender = [...history];
  while (daysToRender.length < 90) {
    daysToRender.unshift({
      id: `pad-${daysToRender.length}`,
      componentId: component.id,
      date: 'N/A',
      uptimePct: 100,
      outageMinutes: 0,
      incidentCount: 0,
    });
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 md:p-5 transition-all hover:border-zinc-700/80">
      {/* Component Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-zinc-100">{component.name}</h3>
          {component.pingUrl && (
            <span
              className="inline-flex items-center text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded"
              title={`Automated HTTP monitoring enabled: ${component.pingUrl}`}
            >
              <Globe className="w-2.5 h-2.5 mr-1 text-emerald-400" />
              Ping
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-400 hidden sm:inline">
            {component.uptimePercentage.toFixed(2)}%
          </span>
          {getStatusBadge(component.status)}
        </div>
      </div>

      {/* 90-Day Segmented Pill Bar */}
      <div
        className="relative flex items-end gap-[2px] h-9 w-full py-1"
        onMouseLeave={() => setHoveredDay(null)}
      >
        {daysToRender.map((day, idx) => (
          <div
            key={day.id || idx}
            onMouseEnter={(e) => {
              setHoveredDay(day);
              setMousePos({ x: e.clientX, y: e.clientY });
            }}
            onClick={() => setHoveredDay(day)}
            className={`flex-1 h-full rounded-[2px] transition-all duration-150 cursor-pointer ${getPillColor(
              day
            )} ${hoveredDay === day ? 'scale-y-125 z-10 brightness-125' : 'opacity-90'}`}
          />
        ))}

        {/* Hover Tooltip */}
        {hoveredDay && hoveredDay.date !== 'N/A' && (
          <div
            className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 rounded-lg border border-zinc-700 bg-zinc-950/95 p-2.5 shadow-2xl backdrop-blur-md text-xs"
            style={{ left: mousePos.x, top: mousePos.y - 12 }}
          >
            <div className="font-semibold text-zinc-100">{hoveredDay.date}</div>
            <div className="mt-1 flex items-center gap-2 text-zinc-300">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>{hoveredDay.uptimePct.toFixed(2)}% Uptime</span>
            </div>
            {hoveredDay.outageMinutes > 0 ? (
              <div className="mt-0.5 text-rose-400 font-medium">
                {hoveredDay.outageMinutes} mins downtime ({hoveredDay.incidentCount} incidents)
              </div>
            ) : (
              <div className="mt-0.5 text-zinc-500">No recorded downtime</div>
            )}
          </div>
        )}
      </div>

      {/* Bar Subtitle */}
      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono mt-2">
        <span>90 days ago</span>
        <div className="h-[1px] flex-1 mx-3 bg-zinc-800" />
        <span>Today ({component.uptimePercentage.toFixed(2)}%)</span>
      </div>

      {/* 24-Hour Latency Sparkline */}
      {component.latencyHistory && component.latencyHistory.length > 0 && (
        <LatencySparkline
          samples={component.latencyHistory}
          averageMs={component.averageLatencyMs}
        />
      )}
    </div>
  );
};
