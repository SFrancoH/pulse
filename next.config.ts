import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/boleta",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://javiertoyotas.com https://*.javiertoyotas.com https://*.gohighlevel.com https://*.leadconnectorhq.com",
          },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
