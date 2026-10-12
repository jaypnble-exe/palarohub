"use client";
import { SerwistProvider } from "@serwist/turbopack/react";

/**
 * Registers the service worker for /score/ only, so the scorebook reloads
 * offline. It never reloads the page on reconnect: that would interrupt scoring.
 */
export function OfflineShell({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      options={{ scope: "/score/" }}
      disable={process.env.NODE_ENV === "development"}
      reloadOnOnline={false}
      cacheOnNavigation={false}
    >
      {children}
    </SerwistProvider>
  );
}
