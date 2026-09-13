import React, { useState } from 'react';
import { AlertCircle, Eye, Send, X } from 'lucide-react';
import { Component, IncidentSeverity } from '../types.js';

interface Props {
  isOpen: boolean;
  components: Component[];
  onClose: () => void;
  onSubmit: (params: {
    title: string;
    severity: IncidentSeverity;
    initialMessage: string;
    affectedComponentIds: string[];
  }) => Promise<void>;
}

export const CreateIncidentModal: React.FC<Props> = ({
  isOpen,
  components,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('MAJOR');
  const [initialMessage, setInitialMessage] = useState('');
  const [affectedIds, setAffectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  if (!isOpen) return null;

  const toggleComponent = (id: string) => {
    setAffectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !initialMessage.trim()) return;

    try {
      setSubmitting(true);
      await onSubmit({
        title,
        severity,
        initialMessage,
        affectedComponentIds: affectedIds,
      });
      setTitle('');
      setInitialMessage('');
      setAffectedIds([]);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to create incident');
    } finally {
      setSubmitting(false);
    }
  };

  const affectedNames = components
    .filter((c) => affectedIds.includes(c.id))
    .map((c) => c.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-zinc-100">Report & Broadcast Incident</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Incident Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. API Gateway Latency Spike & 504 Errors"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Severity Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['MINOR', 'MAJOR', 'CRITICAL'] as IncidentSeverity[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={`py-2 px-2 text-xs font-bold rounded-lg border transition-all ${
                      severity === s
                        ? s === 'CRITICAL'
                          ? 'bg-rose-500 text-white border-rose-500'
                          : s === 'MAJOR'
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-yellow-500 text-black border-yellow-500'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Affected Components
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                {components.map((c) => {
                  const isSelected = affectedIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleComponent(c.id)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-medium'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Initial Remediation Message
            </label>
            <textarea
              required
              rows={3}
              placeholder="Describe current observations, impacted endpoints, and immediate action steps..."
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          {/* Telegram Channel Live Preview Toggle */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showPreview ? 'Hide' : 'Show'} Telegram Channel Message Preview</span>
            </button>

            {showPreview && (
              <div className="mt-2 rounded-xl border border-blue-500/30 bg-[#17212b] p-3.5 text-xs shadow-inner">
                <div className="text-[10px] uppercase font-mono text-blue-400 mb-2">
                  Telegram Channel Broadcast Preview
                </div>
                <div className="text-zinc-100 font-sans space-y-1.5">
                  <div className="font-bold text-sm text-white">
                    🚨 [INCIDENT] {title || 'API Latency Spike'}
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-300">Severity: </span>
                    {severity === 'CRITICAL' ? '🔴 CRITICAL' : severity === 'MAJOR' ? '🟠 MAJOR' : '🟡 MINOR'}
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-300">Status: </span>
                    🔍 INVESTIGATING
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-300">Affected Components: </span>
                    {affectedNames.length > 0 ? affectedNames.join(', ') : 'All Systems'}
                  </div>
                  <div className="pt-1 text-zinc-300 italic border-t border-zinc-700/60">
                    "{initialMessage || 'Remediation is underway.'}"
                  </div>
                </div>

                <div className="mt-3 pt-2">
                  <div className="w-full py-1.5 rounded-lg bg-[#2b5278] hover:bg-[#32618e] text-white text-center font-medium text-xs">
                    📊 View Live Status Page
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !initialMessage.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-rose-600/20"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Broadcasting...' : 'Publish & Broadcast'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
