/// <reference lib="webworker" />
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

/**
 * Registered only for /score/: lets the scorer page reload without a
 * connection. Commissioner pages and Supabase API responses are never
 * cached; game data offline lives in the device store (IndexedDB) instead.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin &&
        request.mode === "navigate" &&
        url.pathname.startsWith("/score/"),
      handler: new NetworkFirst({
        cacheName: "scorebook-pages",
        networkTimeoutSeconds: 4,
        plugins: [
          new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 7 * 86_400 }),
        ],
      }),
    },
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "scorebook-static",
        plugins: [
          new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 30 * 86_400 }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();
