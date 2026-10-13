import type { NextConfig } from "next";
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["@prisma/client"],
  poweredByHeader: false,
  // pdfkit charge ses polices/données via des imports dynamiques que le
  // file-tracing Vercel ne détecte pas. Sans ceci, la route PDF échoue en
  // production avec "Cannot find module .../pdfkit/js/standard-fonts/...".
  outputFileTracingIncludes: {
    "/api/documents/[id]/pdf": [
      "./node_modules/pdfkit/js/standard-fonts/**/*",
      "./node_modules/pdfkit/js/data/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
