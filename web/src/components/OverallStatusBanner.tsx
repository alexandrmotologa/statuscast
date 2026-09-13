import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Wrench,
  RotateCw,
} from 'lucide-react';
import { ComponentStatus } from '../types.js';

interface Props {
  status: ComponentStatus;
  lastRefreshed: Date;
  onRefresh: () => void;
  loading: boolean;
}

export const OverallStatusBanner: React.FC<Props> = ({
  status,
  lastRefreshed,
  onRefresh,
  loading,
}) => {
  const config = {
    OPERATIONAL: {
      title: 'All Systems Operational',
      subtitle: 'All monitored infrastructure and services are running smoothly.',
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      glow: 'shadow-glow',
      icon: CheckCircle2,
      dot: 'bg-emerald-400',
    },
    DEGRADED: {
      title: 'Degraded System Performance',
      subtitle: 'Some components are experiencing elevated latency or minor errors.',
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      glow: 'shadow-glow-amber',
      icon: AlertTriangle,
      dot: 'bg-amber-400',
    },
    PARTIAL_OUTAGE: {
      title: 'Partial System Outage',
      subtitle: 'Disruptions detected in one or more core services.',
      bg: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
      glow: 'shadow-glow-amber',
      icon: AlertTriangle,
      dot: 'bg-orange-400',
    },
    MAJOR_OUTAGE: {
      title: 'Major Outage Detected',
      subtitle: 'Critical infrastructure disruption. Engineering team is responding.',
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
      glow: 'shadow-glow-rose',
      icon: AlertOctagon,
      dot: 'bg-rose-400',
    },
    MAINTENANCE: {
      title: 'Scheduled Maintenance in Progress',
      subtitle: 'Routine maintenance is active. Temporary degradation may occur.',
      bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
      glow: 'shadow-blue-500/20',
      icon: Wrench,
      dot: 'bg-blue-400',
    },
  }[status] || {
    title: 'System Status Unknown',
    subtitle: 'Connecting to monitoring nodes...',
    bg: 'bg-zinc-800 border-zinc-700 text-zinc-300',
    glow: '',
    icon: CheckCircle2,
    dot: 'bg-zinc-400',
  };

  const Icon = config.icon;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 md:p-6 transition-all duration-300 ${config.bg} ${config.glow}`}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <Icon className="w-8 h-8" />
            <span
              className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${config.dot} animate-pulse-subtle`}
            />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              {config.title}
            </h1>
            <p className="text-sm opacity-90 mt-0.5 max-w-xl">
              {config.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center text-xs opacity-75">
          <span>
            Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 transition-all"
            title="Refresh status"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
