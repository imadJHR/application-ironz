import { currentUser } from "@/server/auth";
import { restoreFromUpload } from "@/server/backup";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/system/restore : multipart/form-data, champ "file" (.db SQLite).
// Réservé aux administrateurs. Les sessions sont invalidées de fait :
// elles vivaient dans l'ancienne base -> retour à la connexion.
export async function POST(req: Request) {
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
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json(
        { error: "Aucun fichier fourni (champ « file »)." },
        { status: 400 },
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await restoreFromUpload(bytes);
    if (!result.ok)
      return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: result.message });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Echec de la restauration.",
      },
      { status: 500 },
    );
  }
}
