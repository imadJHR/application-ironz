import { readFile } from "node:fs/promises";
import path from "node:path";
import { currentUser } from "@/server/auth";
import { getDocument } from "@/server/queries";
import { documentData } from "@/features/documents/document-data";
import { CommercialPdf } from "@/features/documents/pdf";
import { renderToBuffer } from "@react-pdf/renderer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function logoSrc(): Promise<string | null> {
  try {
    const file = await readFile(
      path.join(process.cwd(), "public", "ironz-logo.png"),
    );
    return "data:image/png;base64," + file.toString("base64");
  } catch {
    // En production serverless, public/ n'est pas sur le disque local.
  }
  try {
    const res = await fetch(
      new URL("/ironz-logo.png", process.env.APP_URL || "http://localhost:3000"),
    );
    if (!res.ok) return null;
    return (
      "data:image/png;base64," +
      Buffer.from(await res.arrayBuffer()).toString("base64")
    );
  } catch {
    return null;
  }
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await currentUser()))
      return new Response("Authentification requise.", { status: 401 });
    const { id } = await params,
      doc = await getDocument(id);
    if (!doc) return new Response("Document introuvable.", { status: 404 });
    const valued =
      new URL(request.url).searchParams.get("interne") === "1" &&
      doc.kind === "DELIVERY";
    const pdf = await renderToBuffer(
      <CommercialPdf
        doc={documentData(doc)}
        valued={valued}
        logo={await logoSrc()}
      />,
    );
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="' +
          doc.number +
          (valued ? "-interne" : "") +
          '.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error(
      "[IRONZ PDF]",
      error instanceof Error ? error.message : "Unknown",
    );
    return new Response("Impossible de générer ce document PDF.", {
      status: 500,
    });
  }
}
