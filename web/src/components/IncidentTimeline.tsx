import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
} from 'lucide-react';
import { Component, Incident, IncidentSeverity, IncidentStatus } from '../types.js';

interface Props {
  incidents: Incident[];
  components: Component[];
}

export const IncidentTimeline: React.FC<Props> = ({ incidents, components }) => {
  const [expandedIncidents, setExpandedIncidents] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIncidents((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getComponentName = (id: string) => {
    const comp = components.find((c) => c.id === id);
    return comp ? comp.name : id;
  };

  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED');

  const getSeverityBadge = (severity: IncidentSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            CRITICAL
          </span>
        );
      case 'MAJOR':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            MAJOR
          </span>
        );
      case 'MINOR':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            MINOR
          </span>
        );
    }
  };

  const getStatusBadge = (status: IncidentStatus) => {
    switch (status) {
      case 'INVESTIGATING':
        return <span className="text-amber-400 font-semibold">Investigating</span>;
      case 'IDENTIFIED':
        return <span className="text-blue-400 font-semibold">Identified</span>;
      case 'MONITORING':
        return <span className="text-indigo-400 font-semibold">Monitoring</span>;
      case 'RESOLVED':
        return <span className="text-emerald-400 font-semibold">Resolved</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Incidents Section */}
      {activeIncidents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-rose-400 text-sm font-semibold tracking-wide uppercase">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
            Active Incidents ({activeIncidents.length})
          </div>

          <div className="space-y-4">
            {activeIncidents.map((incident) => (
              <div
                key={incident.id}
                className="rounded-xl border border-rose-500/30 bg-rose-950/10 p-5 shadow-lg relative overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <h3 className="text-lg font-bold text-zinc-100">{incident.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(incident.severity)}
                    <span className="text-xs font-mono text-zinc-400">
                      {new Date(incident.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Affected Components */}
                {incident.affectedComponentIds.length > 0 && (
                  <div className="flex items-center gap-2 mt-3 text-xs text-zinc-400">
                    <Layers className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Affected:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {incident.affectedComponentIds.map((cid) => (
                        <span
                          key={cid}
                          className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium text-[11px]"
                        >
                          {getComponentName(cid)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Updates Stream */}
                <div className="mt-4 border-t border-zinc-800/80 pt-3 space-y-3">
                  {incident.updates.map((upd, idx) => (
                    <div key={upd.id || idx} className="relative pl-5 border-l-2 border-zinc-700 text-xs">
                      <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-amber-400" />
                      <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <div>{getStatusBadge(upd.status)}</div>
                        <span className="font-mono text-[11px]">
                          {new Date(upd.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-zinc-200 leading-relaxed text-sm">{upd.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Resolved Incidents */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-400">
          Past Incidents (Last 14 Days)
        </h2>

        {resolvedIncidents.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 text-center text-zinc-500 text-sm">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
            No incidents reported during the past 14 days.
          </div>
        ) : (
          <div className="space-y-3">
            {resolvedIncidents.map((incident) => {
              const isExpanded = expandedIncidents[incident.id] ?? false;
              const durationMinutes =
                incident.resolvedAt && incident.createdAt
                  ? Math.max(1, Math.round((incident.resolvedAt - incident.createdAt) / 60000))
                  : null;

              return (
                <div
                  key={incident.id}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition-all hover:border-zinc-700/60"
                >
                  <div
                    onClick={() => toggleExpand(incident.id)}
                    className="flex items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-sm font-semibold text-zinc-200">
                          {incident.title}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {new Date(incident.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {durationMinutes && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          {durationMinutes}m duration
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Updates */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-3 pl-2">
                      {incident.updates.map((upd, idx) => (
                        <div key={upd.id || idx} className="relative pl-5 border-l-2 border-emerald-500/40 text-xs">
                          <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-emerald-400" />
                          <div className="flex items-center justify-between text-zinc-400 mb-1">
                            <span className="font-semibold text-emerald-400 capitalize">
                              {upd.status.toLowerCase()}
                            </span>
                            <span className="font-mono text-[11px]">
                              {new Date(upd.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-zinc-300 leading-relaxed text-sm">{upd.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
