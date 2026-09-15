'use client';

import { useEffect } from 'react';

/**
 * Removes the service worker and every cache it created.
 *
 * The app used to register an offline worker that cached each page it served,
 * including the server-rendered roster, and served that copy when the network
 * dropped — after sign-out too. The capstone paper scopes offline use out
 * ("offline functionality and local data synchronization are not supported"),
 * so this undoes it on every phone that installed the old worker. /sw.js is a
 * matching self-removing worker for browsers that update it before this runs.
 */
export default function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
      .catch(() => {});
    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch(() => {});
    }
  }, []);

  return null;
}
