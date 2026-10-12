import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "IRONZ · Gestion commerciale", template: "%s · IRONZ" },
  description: "L’espace de gestion commerciale interne d’IRONZ.",
  robots: { index: false, follow: false },
  icons: { icon: "/ironz-logo.png", apple: "/ironz-logo.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        {children}
        <Toaster position="bottom-center" richColors closeButton />
      </body>
    </html>
  );
}
