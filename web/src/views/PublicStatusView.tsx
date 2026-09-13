import React from 'react';
import { Bell, ExternalLink, Shield, SlidersHorizontal } from 'lucide-react';
import { ComponentUptimeBar } from '../components/ComponentUptimeBar.js';
import { IncidentTimeline } from '../components/IncidentTimeline.js';
import { MaintenanceBanner } from '../components/MaintenanceBanner.js';
import { OverallStatusBanner } from '../components/OverallStatusBanner.js';
import { StatusPageResponse } from '../types.js';

interface Props {
  data: StatusPageResponse;
  lastRefreshed: Date;
  onRefresh: () => void;
  loading: boolean;
  onOpenAdmin: () => void;
  onOpenSubscribe: () => void;
}

export const PublicStatusView: React.FC<Props> = ({
  data,
  lastRefreshed,
  onRefresh,
  loading,
  onOpenAdmin,
  onOpenSubscribe,
}) => {
  // Group components by groupName
  const groupedComponents = data.components.reduce<Record<string, typeof data.components>>(
    (acc, comp) => {
      const group = comp.groupName || 'Services';
      if (!acc[group]) acc[group] = [];
      acc[group].push(comp);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner */}
      <OverallStatusBanner
        status={data.overallStatus}
        lastRefreshed={lastRefreshed}
        onRefresh={onRefresh}
        loading={loading}
      />

      {/* Scheduled Maintenance Banner (if any) */}
      {data.maintenances && data.maintenances.length > 0 && (
        <MaintenanceBanner maintenances={data.maintenances} components={data.components} />
      )}

      {/* Services List Grouped */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-zinc-400 truncate">
              System Components
            </h2>
            <span className="text-[10px] text-zinc-500 font-mono shrink-0 whitespace-nowrap">
              ({data.components.length})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSubscribe}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all active:scale-95"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Get Alerts</span>
              {data.subscribersCount !== undefined && data.subscribersCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-[10px]">
                  {data.subscribersCount}
                </span>
              )}
            </button>
            <span className="text-xs text-zinc-500 hidden sm:inline">90-Day Uptime</span>
          </div>
        </div>

        {Object.entries(groupedComponents).map(([groupName, comps]) => (
          <div key={groupName} className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider pl-1">
              {groupName}
            </h3>
            <div className="space-y-3">
              {comps.map((comp) => (
                <ComponentUptimeBar key={comp.id} component={comp} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Incident Timeline */}
      <IncidentTimeline incidents={data.incidents} components={data.components} />

      {/* Footer */}
      <div className="pt-8 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>StatusCast Autonomous Status Engine</span>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-4">
          <button
            onClick={onOpenSubscribe}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Bell className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Direct DM Alerts</span>
          </button>

          {data.page.channelId && (
            <a
              href={`https://t.me/${data.page.channelId.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <span>Broadcast Channel</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          )}

          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold border border-zinc-750 transition-all active:scale-95 shadow-sm shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Admin Cockpit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
