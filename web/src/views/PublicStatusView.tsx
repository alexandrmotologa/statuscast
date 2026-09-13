import React from 'react';
import { Shield, ExternalLink, SlidersHorizontal } from 'lucide-react';
import { ComponentUptimeBar } from '../components/ComponentUptimeBar.js';
import { IncidentTimeline } from '../components/IncidentTimeline.js';
import { OverallStatusBanner } from '../components/OverallStatusBanner.js';
import { StatusPageResponse } from '../types.js';

interface Props {
  data: StatusPageResponse;
  lastRefreshed: Date;
  onRefresh: () => void;
  loading: boolean;
  onOpenAdmin: () => void;
}

export const PublicStatusView: React.FC<Props> = ({
  data,
  lastRefreshed,
  onRefresh,
  loading,
  onOpenAdmin,
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

      {/* Services List Grouped */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            System Components
          </h2>
          <span className="text-xs text-zinc-500">90-Day Uptime History</span>
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
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>StatusCast Autonomous Status Engine</span>
        </div>

        <div className="flex items-center gap-4">
          {data.page.channelId && (
            <a
              href={`https://t.me/${data.page.channelId.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <span>Broadcast Channel</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Admin Cockpit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
