import type { NextConfig } from "next";
// Build desktop (.exe) : DESKTOP_BUILD=1 produit un serveur autonome.
// Le client Prisma SQLite est mis en place par échange de fichiers
// (desktop/build.mjs) avant ce build. Sans cette variable, la config web
// est inchangée.
const isDesktop = process.env.DESKTOP_BUILD === "1";
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["@prisma/client"],
  poweredByHeader: false,
  ...(isDesktop
    ? {
        output: "standalone" as const,
        // Pas de sharp dans l'installeur : images servies telles quelles.
        images: { unoptimized: true },
      }
    : {}),
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
