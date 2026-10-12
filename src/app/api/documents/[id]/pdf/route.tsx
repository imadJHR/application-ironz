import { currentUser } from "@/server/auth";
import { getDocument } from "@/server/queries";
import { documentData } from "@/features/documents/document-data";
import { CommercialPdf } from "@/features/documents/pdf";
import { renderToBuffer } from "@react-pdf/renderer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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
      <CommercialPdf doc={documentData(doc)} valued={valued} />,
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
