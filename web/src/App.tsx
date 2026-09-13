import { useEffect, useState } from 'react';
import { Bell, Send, Shield, Sparkles } from 'lucide-react';
import { SubscribeModal } from './components/SubscribeModal.js';
import { useStatusData } from './hooks/useStatusData.js';
import { useTelegram } from './hooks/useTelegram.js';
import { AdminCockpitView } from './views/AdminCockpitView.js';
import { PublicStatusView } from './views/PublicStatusView.js';

export function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const pageId = urlParams.get('page') || 'demo';

  const { initData, isTelegramWebApp, hapticFeedback, user: telegramUser } = useTelegram();
  const [viewMode, setViewMode] = useState<'public' | 'admin'>('public');
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false);
  const [adminSecret, setAdminSecret] = useState<string>(
    localStorage.getItem('statuscast_admin_secret') || ''
  );

  const {
    data,
    loading,
    error,
    lastRefreshed,
    broadcastLogs,
    refetch,
    fetchBroadcastLogs,
    updateComponent,
    createComponent,
    deleteComponent,
    createNewIncident,
    updateIncident,
    scheduleMaintenance,
    updateMaintenance,
    fetchPostMortem,
    subscribeAlerts,
    unsubscribeAlerts,
    checkSubscription,
  } = useStatusData(pageId, initData, adminSecret);

  useEffect(() => {
    if (adminSecret) {
      localStorage.setItem('statuscast_admin_secret', adminSecret);
    }
  }, [adminSecret]);

  useEffect(() => {
    if (viewMode === 'admin') {
      fetchBroadcastLogs();
    }
  }, [viewMode, fetchBroadcastLogs]);

  const handleOpenAdmin = () => {
    hapticFeedback.impact('light');
    setViewMode('admin');
  };

  const handleBackToPublic = () => {
    hapticFeedback.impact('light');
    setViewMode('public');
  };

  const handleOpenSubscribe = () => {
    hapticFeedback.impact('light');
    setIsSubscribeModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center">
      {/* Top Navigation Bar */}
      <header className="w-full border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>StatusCast</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                  TMA
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                {data?.page.title || 'System Status'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenSubscribe}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all active:scale-95"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Alerts</span>
              {data?.subscribersCount !== undefined && data.subscribersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-[10px] font-mono">
                  {data.subscribersCount}
                </span>
              )}
            </button>

            {isTelegramWebApp ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                <Send className="w-3 h-3" />
                Telegram App
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-zinc-800/80 text-zinc-400 font-mono">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Standalone
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-4xl mx-auto px-4 py-6 md:py-8 flex-1">
        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            <div className="text-sm font-medium text-zinc-400">
              Loading real-time status data...
            </div>
          </div>
        ) : error && !data ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-6 text-center space-y-3">
            <h2 className="text-lg font-bold text-rose-400">Unable to Connect</h2>
            <p className="text-sm text-zinc-400">{error}</p>
            <button
              onClick={refetch}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all"
            >
              Retry Connection
            </button>
          </div>
        ) : data ? (
          viewMode === 'public' ? (
            <PublicStatusView
              data={data}
              lastRefreshed={lastRefreshed}
              onRefresh={refetch}
              loading={loading}
              onOpenAdmin={handleOpenAdmin}
              onOpenSubscribe={handleOpenSubscribe}
            />
          ) : (
            <AdminCockpitView
              components={data.components}
              incidents={data.incidents}
              maintenances={data.maintenances}
              broadcastLogs={broadcastLogs}
              subscribersCount={data.subscribersCount}
              adminSecret={adminSecret}
              onUpdateAdminSecret={setAdminSecret}
              onUpdateComponent={updateComponent}
              onCreateComponent={createComponent}
              onDeleteComponent={deleteComponent}
              onCreateIncident={createNewIncident}
              onUpdateIncident={updateIncident}
              onScheduleMaintenance={scheduleMaintenance}
              onUpdateMaintenance={updateMaintenance}
              onFetchPostMortem={fetchPostMortem}
              onBackToPublic={handleBackToPublic}
            />
          )
        ) : null}
      </main>

      {/* Subscriber Modal */}
      <SubscribeModal
        isOpen={isSubscribeModalOpen}
        onClose={() => setIsSubscribeModalOpen(false)}
        telegramUser={telegramUser}
        pageId={pageId}
        totalSubscribers={data?.subscribersCount}
        onSubscribe={subscribeAlerts}
        onUnsubscribe={unsubscribeAlerts}
        onCheckStatus={checkSubscription}
      />
    </div>
  );
}
export default App;
