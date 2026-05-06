import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  reactCompiler: true,
  outputFileTracingRoot: process.cwd(),
  turbopack: {},
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://29land-backend:3001/api/:path*", // Proxy to backend container inside Dokploy
      },
    ];
  },
};

export default withSerwist(nextConfig);
