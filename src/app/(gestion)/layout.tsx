import { requireUser } from "@/server/auth";
import { isPreview } from "@/server/db";
import { settings } from "@/server/queries";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function GestionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const company = await settings();
  return (
    <Shell user={user} preview={isPreview()} logo={company.logo}>
      {children}
    </Shell>
  );
}
