import React, { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2, Send, Users, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  telegramUser: any;
  pageId: string;
  totalSubscribers?: number;
  onSubscribe: (userId: number, username?: string) => Promise<any>;
  onUnsubscribe: (userId: number) => Promise<any>;
  onCheckStatus: (userId: number) => Promise<boolean>;
}

export const SubscribeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  telegramUser,
  pageId: _pageId,
  totalSubscribers = 0,
  onSubscribe,
  onUnsubscribe,
  onCheckStatus,
}) => {
  const [customUserId, setCustomUserId] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const effectiveUserId = telegramUser?.id || (customUserId ? parseInt(customUserId, 10) : null);

  useEffect(() => {
    if (isOpen && effectiveUserId) {
      onCheckStatus(effectiveUserId).then(setIsSubscribed);
    }
  }, [isOpen, effectiveUserId, onCheckStatus]);

  if (!isOpen) return null;

  const handleToggle = async () => {
    if (!effectiveUserId) {
      alert('Please provide your Telegram User ID');
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);
      if (isSubscribed) {
        await onUnsubscribe(effectiveUserId);
        setIsSubscribed(false);
        setFeedback('You have been unsubscribed from direct alerts.');
      } else {
        await onSubscribe(effectiveUserId, telegramUser?.username || customUsername);
        setIsSubscribed(true);
        setFeedback('Subscribed! You will receive instant DM alerts from the bot.');
      }
    } catch (err: any) {
      alert(err.message || 'Subscription failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Direct Telegram Alerts</h2>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                <Users className="w-3 h-3 text-emerald-400" />
                <span>{totalSubscribers} active subscribers</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-zinc-300">
          <p className="leading-relaxed">
            Get instant private messages (DM) in Telegram whenever an incident starts or updates,
            even if you have broadcast channels muted.
          </p>

          {telegramUser ? (
            <div className="p-3.5 rounded-xl bg-zinc-800/80 border border-zinc-700/80 flex items-center justify-between">
              <div>
                <div className="font-semibold text-zinc-100">
                  {telegramUser.first_name} {telegramUser.last_name || ''}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono">
                  ID: {telegramUser.id} {telegramUser.username ? `(@${telegramUser.username})` : ''}
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Connected
              </span>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Your Telegram User ID
                </label>
                <input
                  type="number"
                  placeholder="e.g. 123456789"
                  value={customUserId}
                  onChange={(e) => setCustomUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Find your ID by messaging @userinfobot on Telegram.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Telegram Username (Optional)
                </label>
                <input
                  type="text"
                  placeholder="@username"
                  value={customUsername}
                  onChange={(e) => setCustomUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>
            </div>
          )}

          {feedback && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={handleToggle}
              disabled={loading || !effectiveUserId}
              className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50 ${
                isSubscribed
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-rose-400 border border-zinc-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
              }`}
            >
              {loading ? (
                <span>Updating...</span>
              ) : isSubscribed ? (
                <>
                  <BellOff className="w-4 h-4" />
                  <span>Unsubscribe from Alerts</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Subscribe to Bot DM Alerts</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
