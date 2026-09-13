import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Plus,
  Radio,
  Terminal,
  Trash2,
  Users,
  Wrench,
} from 'lucide-react';
import { CreateComponentModal } from '../components/CreateComponentModal.js';
import { CreateIncidentModal } from '../components/CreateIncidentModal.js';
import { PostMortemModal } from '../components/PostMortemModal.js';
import {
  BroadcastLogItem,
  Component,
  ComponentStatus,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  MaintenanceStatus,
  MaintenanceWindow,
} from '../types.js';

interface Props {
  components: Component[];
  incidents: Incident[];
  maintenances?: MaintenanceWindow[];
  broadcastLogs: BroadcastLogItem[];
  subscribersCount?: number;
  adminSecret: string;
  onUpdateAdminSecret: (secret: string) => void;
  onUpdateComponent: (id: string, status: ComponentStatus) => Promise<any>;
  onCreateComponent: (params: {
    name: string;
    groupName: string;
    pingUrl?: string;
    heartbeatToken?: string;
  }) => Promise<any>;
  onDeleteComponent: (id: string) => Promise<any>;
  onCreateIncident: (params: {
    title: string;
    severity: IncidentSeverity;
    initialMessage: string;
    affectedComponentIds: string[];
  }) => Promise<any>;
  onUpdateIncident: (
    id: string,
    params: { status: IncidentStatus; message?: string; resolved?: boolean }
  ) => Promise<any>;
  onScheduleMaintenance: (params: {
    title: string;
    description: string;
    scheduledStart: number;
    scheduledEnd: number;
    affectedComponentIds?: string[];
  }) => Promise<any>;
  onUpdateMaintenance: (id: string, status: MaintenanceStatus) => Promise<any>;
  onFetchPostMortem: (id: string) => Promise<{ markdown: string }>;
  onBackToPublic: () => void;
}

export const AdminCockpitView: React.FC<Props> = ({
  components,
  incidents,
  maintenances = [],
  broadcastLogs,
  subscribersCount = 0,
  adminSecret,
  onUpdateAdminSecret,
  onUpdateComponent,
  onCreateComponent,
  onDeleteComponent,
  onCreateIncident,
  onUpdateIncident,
  onScheduleMaintenance,
  onUpdateMaintenance,
  onFetchPostMortem,
  onBackToPublic,
}) => {
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
  const [postMortemModalData, setPostMortemModalData] = useState<{
    isOpen: boolean;
    title: string;
    markdown: string;
  }>({ isOpen: false, title: '', markdown: '' });

  // Maintenance form states
  const [maintTitle, setMaintTitle] = useState('');
  const [maintDesc, setMaintDesc] = useState('');
  const [maintStartHours, setMaintStartHours] = useState('24');
  const [maintDurationHours, setMaintDurationHours] = useState('2');
  const [maintAffectedIds, setMaintAffectedIds] = useState<string[]>([]);
  const [isSchedulingMaint, setIsSchedulingMaint] = useState(false);

  const [updateMessages, setUpdateMessages] = useState<Record<string, string>>({});
  const [updateStatuses, setUpdateStatuses] = useState<Record<string, IncidentStatus>>({});
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED');

  const handlePostUpdate = async (incidentId: string) => {
    const message = updateMessages[incidentId];
    const status = updateStatuses[incidentId] || 'IDENTIFIED';
    if (!message || !message.trim()) return;

    try {
      await onUpdateIncident(incidentId, { status, message });
      setUpdateMessages((prev) => ({ ...prev, [incidentId]: '' }));
    } catch (err: any) {
      alert(err.message || 'Failed to post update');
    }
  };

  const handleResolve = async (incidentId: string) => {
    const finalMsg = prompt('Resolution message for Telegram channel edit:');
    if (finalMsg === null) return;

    try {
      await onUpdateIncident(incidentId, {
        status: 'RESOLVED',
        message: finalMsg || 'Incident resolved. All systems nominal.',
        resolved: true,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to resolve incident');
    }
  };

  const handleOpenPostMortem = async (incident: Incident) => {
    try {
      const res = await onFetchPostMortem(incident.id);
      setPostMortemModalData({
        isOpen: true,
        title: incident.title,
        markdown: res.markdown,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to fetch post-mortem');
    }
  };

  const handleScheduleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintTitle.trim()) return;

    try {
      setIsSchedulingMaint(true);
      const now = Date.now();
      const start = now + parseFloat(maintStartHours) * 3600000;
      const end = start + parseFloat(maintDurationHours) * 3600000;

      await onScheduleMaintenance({
        title: maintTitle,
        description: maintDesc,
        scheduledStart: start,
        scheduledEnd: end,
        affectedComponentIds: maintAffectedIds,
      });

      setMaintTitle('');
      setMaintDesc('');
      setMaintAffectedIds([]);
      alert('Maintenance window scheduled & broadcast to Telegram!');
    } catch (err: any) {
      alert(err.message || 'Failed to schedule maintenance');
    } finally {
      setIsSchedulingMaint(false);
    }
  };

  const copyHeartbeatCurl = (compId: string, token?: string) => {
    const curl = `curl -X POST "${window.location.origin}/api/heartbeat/${compId}?token=${token || 'demo_token'}"`;
    navigator.clipboard.writeText(curl);
    setCopiedToken(compId);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleDeleteComponentConfirm = async (compId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete component "${name}"?`)) return;
    try {
      await onDeleteComponent(compId);
    } catch (err: any) {
      alert(err.message || 'Failed to delete component');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Cockpit Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToPublic}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-xs font-semibold text-zinc-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Public Status</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span>Admin Cockpit</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                LIVE
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-xs text-zinc-300 font-mono">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>{subscribersCount} DM Subscribers</span>
          </div>

          <input
            type="password"
            placeholder="Admin Secret (if not owner)"
            value={adminSecret}
            onChange={(e) => onUpdateAdminSecret(e.target.value)}
            className="w-full sm:w-48 px-3 py-1.5 text-xs rounded-xl bg-zinc-800/80 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
          />

          <button
            onClick={() => setIsComponentModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Component</span>
          </button>

          <button
            onClick={() => setIsIncidentModalOpen(true)}
            className="flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all active:scale-95"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Report Incident</span>
          </button>
        </div>
      </div>

      {/* 1. Component Status Toggles & CRUD */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Monitored Components ({components.length})
          </h2>
          <span className="text-xs text-zinc-500">1-Tap instant status switch</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {components.map((comp) => {
            const statusOptions: ComponentStatus[] = [
              'OPERATIONAL',
              'DEGRADED',
              'PARTIAL_OUTAGE',
              'MAJOR_OUTAGE',
              'MAINTENANCE',
            ];

            return (
              <div
                key={comp.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-zinc-200 text-sm">{comp.name}</span>
                    <span className="text-xs text-zinc-500 ml-2">({comp.groupName})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-400">
                      {comp.uptimePercentage.toFixed(2)}%
                    </span>
                    <button
                      onClick={() => handleDeleteComponentConfirm(comp.id, comp.name)}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors opacity-60 hover:opacity-100"
                      title="Delete Component"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {statusOptions.map((st) => {
                    const isCurrent = comp.status === st;
                    return (
                      <button
                        key={st}
                        onClick={() => onUpdateComponent(comp.id, st)}
                        className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all ${
                          isCurrent
                            ? st === 'OPERATIONAL'
                              ? 'bg-emerald-500 text-white border-emerald-500'
                              : st === 'DEGRADED'
                              ? 'bg-amber-500 text-black border-amber-500'
                              : st === 'PARTIAL_OUTAGE'
                              ? 'bg-orange-500 text-white border-orange-500'
                              : st === 'MAJOR_OUTAGE'
                              ? 'bg-rose-500 text-white border-rose-500'
                              : 'bg-blue-500 text-white border-blue-500'
                            : 'bg-zinc-800 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-750'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Active Incidents Remediation */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Active Incidents & Telegram Channel In-Place Updates
        </h2>

        {activeIncidents.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
            No active incidents. Use "Report Incident" above to trigger a broadcast.
          </div>
        ) : (
          <div className="space-y-4">
            {activeIncidents.map((incident) => (
              <div
                key={incident.id}
                className="rounded-xl border border-rose-500/30 bg-zinc-900/80 p-5 space-y-4 shadow-xl"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                  <div>
                    <h3 className="font-bold text-zinc-100 text-base">{incident.title}</h3>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Severity: <span className="text-rose-400 font-semibold">{incident.severity}</span> | Status:{' '}
                      <span className="text-amber-400 font-semibold">{incident.status}</span>
                      {incident.channelMessageId && (
                        <span className="ml-2 font-mono text-blue-400">
                          (Telegram Msg #{incident.channelMessageId})
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleResolve(incident.id)}
                    className="flex items-center gap-1.5 self-start sm:self-auto px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark as Resolved (Edits Channel)</span>
                  </button>
                </div>

                {/* Append Update Form */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                    <span>Append In-Place Status Update:</span>
                    <div className="flex gap-2">
                      {(['IDENTIFIED', 'MONITORING'] as IncidentStatus[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() =>
                            setUpdateStatuses((prev) => ({ ...prev, [incident.id]: st }))
                          }
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            (updateStatuses[incident.id] || 'IDENTIFIED') === st
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Traffic rerouted. Latency dropping..."
                      value={updateMessages[incident.id] || ''}
                      onChange={(e) =>
                        setUpdateMessages((prev) => ({
                          ...prev,
                          [incident.id]: e.target.value,
                        }))
                      }
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => handlePostUpdate(incident.id)}
                      disabled={!updateMessages[incident.id]?.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-all"
                    >
                      Post Update
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Resolved Incidents & Post-Mortem Generator */}
      {resolvedIncidents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Resolved Incidents & Post-Mortem Reports
          </h2>
          <div className="space-y-2">
            {resolvedIncidents.map((inc) => (
              <div
                key={inc.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs"
              >
                <div>
                  <span className="font-semibold text-zinc-200">{inc.title}</span>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Resolved at {new Date(inc.resolvedAt || inc.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleOpenPostMortem(inc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 font-medium transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Generate Post-Mortem</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Scheduled Maintenance Manager */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-blue-400" />
          <span>Schedule Maintenance Window</span>
        </h2>

        {/* Existing Maintenances */}
        {maintenances.length > 0 && (
          <div className="space-y-2">
            {maintenances.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/30 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-200">{m.title}</span>
                    <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300">
                      {m.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1">
                    Start: {new Date(m.scheduledStart).toUTCString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.status === 'SCHEDULED' && (
                    <button
                      onClick={() => onUpdateMaintenance(m.id, 'IN_PROGRESS')}
                      className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px]"
                    >
                      Start Now
                    </button>
                  )}
                  {m.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => onUpdateMaintenance(m.id, 'COMPLETED')}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Schedule Form */}
        <form
          onSubmit={handleScheduleMaintenanceSubmit}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-semibold mb-1">Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Database Cluster Migration"
                value={maintTitle}
                onChange={(e) => setMaintTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Starts In (Hours)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={maintStartHours}
                  onChange={(e) => setMaintStartHours(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Duration (Hours)</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={maintDurationHours}
                  onChange={(e) => setMaintDurationHours(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 font-semibold mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Expected scope of work and impact..."
              value={maintDesc}
              onChange={(e) => setMaintDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Will broadcast announcement card to Telegram channel</span>
            </div>
            <button
              type="submit"
              disabled={isSchedulingMaint || !maintTitle.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-blue-600/20"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{isSchedulingMaint ? 'Scheduling...' : 'Schedule & Broadcast'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 5. Heartbeat & Webhooks Guide */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400" />
          <span>Automated Heartbeat Webhooks (Cron / Keepalive)</span>
        </h2>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <p className="text-xs text-zinc-400">
            Have your background scripts or servers send periodic keepalive pings. If pings stop,
            StatusCast can flag degradation automatically:
          </p>

          <div className="space-y-2">
            {components.map((comp) => (
              <div
                key={comp.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-xs font-mono"
              >
                <div className="flex items-center gap-2 truncate mr-3">
                  <Terminal className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="text-zinc-300 font-semibold">{comp.name}:</span>
                  <span className="text-zinc-400 truncate">
                    POST /api/heartbeat/{comp.id}?token={comp.heartbeatToken || 'token'}
                  </span>
                </div>
                <button
                  onClick={() => copyHeartbeatCurl(comp.id, comp.heartbeatToken)}
                  className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedToken === comp.id ? 'Copied!' : 'Copy cURL'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Telegram Channel Broadcast Audit Trail */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Telegram Channel Broadcast Logs
        </h2>

        {broadcastLogs.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 text-center text-xs text-zinc-500">
            No broadcast events recorded in this session.
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3 max-h-72 overflow-y-auto font-mono text-xs">
            {broadcastLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/60 space-y-1"
              >
                <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold ${
                        log.action === 'POST'
                          ? 'bg-rose-500/20 text-rose-300'
                          : log.action === 'RESOLVE'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : log.action === 'MAINTENANCE'
                          ? 'bg-purple-500/20 text-purple-300'
                          : log.action === 'DM_ALERT'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-blue-500/20 text-blue-300'
                      }`}
                    >
                      {log.action}
                    </span>
                    <span>Channel: {log.channelId}</span>
                    <span>(Msg #{log.messageId})</span>
                  </div>
                  {log.simulated && (
                    <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px]">
                      SIMULATED
                    </span>
                  )}
                </div>
                <pre className="text-zinc-300 text-[11px] whitespace-pre-wrap font-sans mt-1">
                  {log.text.replace(/<[^>]*>/g, '')}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateIncidentModal
        isOpen={isIncidentModalOpen}
        components={components}
        onClose={() => setIsIncidentModalOpen(false)}
        onSubmit={onCreateIncident}
      />

      <CreateComponentModal
        isOpen={isComponentModalOpen}
        onClose={() => setIsComponentModalOpen(false)}
        onSubmit={onCreateComponent}
      />

      <PostMortemModal
        isOpen={postMortemModalData.isOpen}
        onClose={() => setPostMortemModalData((prev) => ({ ...prev, isOpen: false }))}
        incidentTitle={postMortemModalData.title}
        markdown={postMortemModalData.markdown}
      />
    </div>
  );
};
