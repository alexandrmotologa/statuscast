import React, { useState } from 'react';
import { Layers, Plus, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    name: string;
    groupName: string;
    pingUrl?: string;
    heartbeatToken?: string;
  }) => Promise<any>;
}

export const CreateComponentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('Core Services');
  const [pingUrl, setPingUrl] = useState('');
  const [heartbeatToken, setHeartbeatToken] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      await onSubmit({
        name,
        groupName: groupName || 'Services',
        pingUrl: pingUrl.trim() || undefined,
        heartbeatToken: heartbeatToken.trim() || undefined,
      });
      setName('');
      setPingUrl('');
      setHeartbeatToken('');
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to create component');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-zinc-100">Add Monitored Component</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              Component Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Authentication Service"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-800/90 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              Category / Group Name
            </label>
            <input
              type="text"
              placeholder="e.g. Microservices"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-800/90 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              HTTP Health Ping URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://api.example.com/health"
              value={pingUrl}
              onChange={(e) => setPingUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-800/90 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 font-mono"
            />
            <span className="text-[10px] text-zinc-500 mt-1 block">
              Background worker will probe this URL every minute and record response latency.
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              Heartbeat Token (Optional)
            </label>
            <input
              type="text"
              placeholder="Custom secret for /api/heartbeat/:id"
              value={heartbeatToken}
              onChange={(e) => setHeartbeatToken(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-800/90 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{loading ? 'Creating...' : 'Add Component'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
