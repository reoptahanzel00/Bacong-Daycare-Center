'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/** Small floating banner shown while the browser is offline. */
export default function OfflineIndicator() {
  // Always render null on first paint so the server and client HTML match.
  // The real online/offline state is read after hydration (client-only).
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOffline(true);
    }
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-[2100] flex items-center gap-2 px-4 py-2.5 rounded-full bg-ink text-white text-xs font-bold shadow-lg"
      role="status"
      suppressHydrationWarning
    >
      <WifiOff size={15} className="shrink-0" />
      <span>You&apos;re offline — changes save locally and sync when you&apos;re back online.</span>
    </div>
  );
}
