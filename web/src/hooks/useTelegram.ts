import { useEffect, useMemo, useState } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

export function useTelegram() {
  const [isReady, setIsReady] = useState(false);

  const tg = useMemo(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      return window.Telegram.WebApp;
    }
    return null;
  }, []);

  const isTelegramWebApp = Boolean(tg && tg.initData && tg.initData.length > 0);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      try {
        tg.setHeaderColor('#0d1117');
        tg.setBackgroundColor('#0d1117');
      } catch (err) {
        // Ignore unsupported platforms
      }
      setIsReady(true);
    }
  }, [tg]);

  const hapticFeedback = useMemo(() => {
    return {
      impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
        try {
          tg?.HapticFeedback?.impactOccurred(style);
        } catch {}
      },
      notification: (type: 'error' | 'success' | 'warning' = 'success') => {
        try {
          tg?.HapticFeedback?.notificationOccurred(type);
        } catch {}
      },
      selection: () => {
        try {
          tg?.HapticFeedback?.selectionChanged();
        } catch {}
      },
    };
  }, [tg]);

  return {
    tg,
    isReady,
    isTelegramWebApp,
    user: tg?.initDataUnsafe?.user || null,
    initData: tg?.initData || '',
    hapticFeedback,
    colorScheme: tg?.colorScheme || 'dark',
  };
}
