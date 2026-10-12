import { createSerwistRoute } from "@serwist/turbopack";

// Serves the scorer page's service worker at /serwist/sw.js, built at build time.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({ swSrc: "src/app/sw.ts", useNativeEsbuild: true });
