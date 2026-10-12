import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/demo-liga", destination: "/sindikato", permanent: true },
      {
        source: "/admin/demo-liga",
        destination: "/admin/sindikato",
        permanent: true,
      },
      {
        source: "/team/demo-liga",
        destination: "/team/sindikato",
        permanent: true,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
export default withNextIntl(nextConfig);
