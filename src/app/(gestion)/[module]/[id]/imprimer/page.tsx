import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocument } from "@/server/queries";
import { moduleFor } from "@/lib/business";
import { documentData } from "@/features/documents/document-data";
import { CommercialPrint } from "@/features/documents/print";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";
export default async function Print({
  params,
  searchParams,
}: {
  params: Promise<{ module: string; id: string }>;
  searchParams: Promise<{ interne?: string }>;
}) {
  const { module, id } = await params,
    doc = await getDocument(id);
  if (!doc || moduleFor(doc.kind) !== module) notFound();
  const valued =
    (await searchParams).interne === "1" && doc.kind === "DELIVERY";
  return (
    <div className="print-page">
      <div className="document-actions">
        <Button asChild variant="outline">
          <Link href={"/" + module + "/" + id}>Retour au document</Link>
        </Button>
        <PrintButton />
        <Button asChild variant="outline">
          <a href={"/api/documents/" + id + "/pdf"}>Télécharger PDF</a>
        </Button>
        {valued ? (
          <Button asChild variant="outline">
            <Link href={"/" + module + "/" + id + "/imprimer"}>
              Version client
            </Link>
          </Button>
        ) : (
          doc.kind === "DELIVERY" && (
            <Button asChild variant="outline">
              <Link href={"/" + module + "/" + id + "/imprimer?interne=1"}>
                Version interne
              </Link>
            </Button>
          )
        )}
      </div>
      <CommercialPrint doc={documentData(doc)} valued={valued} />
    </div>
  );
}
