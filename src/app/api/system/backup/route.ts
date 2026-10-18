import { currentUser } from "@/server/auth";
import { backupFilePath, createBackup, latestBackupName } from "@/server/backup";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/system/backup           -> télécharge la dernière sauvegarde
// GET /api/system/backup?create=1  -> crée une sauvegarde vérifiée puis la télécharge
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  if (user.role !== "ADMIN")
    return NextResponse.json(
      { error: "Réservé aux administrateurs." },
      { status: 403 },
    );
  try {
    const create = new URL(req.url).searchParams.get("create") === "1";
    if (create) {
      const result = await createBackup();
      if (!result.ok || !result.file)
        return NextResponse.json({ error: result.message }, { status: 500 });
    }
    const latest = latestBackupName();
    if (!latest)
      return NextResponse.json(
        { error: "Aucune sauvegarde disponible. Créez-en une d’abord." },
        { status: 404 },
      );
    const file = backupFilePath(latest);
    const bytes = await import("node:fs/promises").then((m) => m.readFile(file));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${latest}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Echec de la sauvegarde." },
      { status: 500 },
    );
  }
}
