'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker. Extracted from an inline <script> in the
 * root layout so the app never relies on dangerouslySetInnerHTML for it.
 * Uses next/script semantics via a client component: registers only on HTTPS
 * so local dev / non-secure deploys stay functional.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.log('ServiceWorker registration failed: ', err));
    }
  }, []);

  return null;
}
