import { currentUser } from "@/server/auth";
import {
  backupFilePath,
  createBackup,
  latestBackupName,
} from "@/server/backup";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
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
    let file;
    if (create) {
      const result = await createBackup();
      if (!result.ok || !result.file)
        return NextResponse.json({ error: result.message }, { status: 500 });
      file = result.file;
    } else {
      const latest = latestBackupName();
      if (!latest)
        return NextResponse.json(
          { error: "Aucune sauvegarde disponible. Créez-en une d’abord." },
          { status: 404 },
        );
      file = backupFilePath(latest);
    }
    const bytes = await readFile(file);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${basename(file)}"`,
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
