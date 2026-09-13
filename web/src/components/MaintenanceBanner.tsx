import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Layers, Wrench } from 'lucide-react';
import { Component, MaintenanceWindow } from '../types.js';

interface Props {
  maintenances: MaintenanceWindow[];
  components: Component[];
}

export const MaintenanceBanner: React.FC<Props> = ({ maintenances, components }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (!maintenances || maintenances.length === 0) return null;

  const getComponentName = (id: string) => {
    const comp = components.find((c) => c.id === id);
    return comp ? comp.name : id;
  };

  const getCountdownString = (start: number, end: number) => {
    if (now < start) {
      const diffMs = start - now;
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `Starts in ${days}d ${hours % 24}h`;
      }
      return `Starts in ${hours}h ${minutes}m`;
    } else if (now >= start && now <= end) {
      const diffMs = end - now;
      const minutes = Math.max(1, Math.floor(diffMs / 60000));
      return `Active Now (Ends in ~${minutes}m)`;
    } else {
      return 'Concluding Maintenance';
    }
  };

  return (
    <div className="space-y-3">
      {maintenances.map((m) => {
        const isLive = now >= m.scheduledStart && now <= m.scheduledEnd;
        const countdown = getCountdownString(m.scheduledStart, m.scheduledEnd);

        return (
          <div
            key={m.id}
            className={`rounded-2xl border p-4 sm:p-5 relative overflow-hidden transition-all ${
              isLive
                ? 'bg-blue-950/20 border-blue-500/40 shadow-lg shadow-blue-500/10'
                : 'bg-zinc-900/70 border-zinc-800'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                  <Wrench className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 shrink-0">
                      Scheduled Maintenance
                    </span>
                    <span className="text-xs font-mono text-zinc-400 font-semibold flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-blue-400" />
                      {countdown}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-zinc-100 mt-1 truncate" title={m.title}>
                    {m.title}
                  </h3>
                </div>
              </div>

              <div className="text-xs text-zinc-400 font-mono flex items-center gap-1.5 self-start sm:self-center bg-zinc-800/60 px-2.5 py-1 rounded-lg shrink-0">
                <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>
                  {new Date(m.scheduledStart).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  {new Date(m.scheduledStart).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-300 mt-3 leading-relaxed">{m.description}</p>

            {m.affectedComponentIds.length > 0 && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800/70 text-xs text-zinc-400">
                <Layers className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>Affected Services:</span>
                <div className="flex flex-wrap gap-1.5">
                  {m.affectedComponentIds.map((cid) => (
                    <span
                      key={cid}
                      className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px] font-medium"
                    >
                      {getComponentName(cid)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
