import { notFound } from "next/navigation";
import { getDocument, selectors, settings } from "@/server/queries";
import { requireUser } from "@/server/auth";
import { moduleFor, type DocumentInput } from "@/lib/business";
import { PageHeader } from "@/components/common";
import { DocumentEditor } from "@/components/document-editor";
export default async function EditDocument({
  params,
}: {
  params: Promise<{ module: string; id: string }>;
}) {
  const { module, id } = await params,
    doc = await getDocument(id);
  if (!doc || moduleFor(doc.kind) !== module) notFound();
  await requireUser(doc.kind === "INVOICE" ? "invoice" : "sales");
  if (doc.status !== "DRAFT" || doc.children.length)
    return (
      <div className="info-banner">
        Ce document est protégé. Seuls les brouillons sans documents dérivés
        peuvent être modifiés.
      </div>
    );
  const [options, company] = await Promise.all([selectors(), settings()]);
  const initial: DocumentInput = {
    kind: doc.kind,
    clientId: doc.clientId,
    date: new Date(doc.date).toISOString().slice(0, 10),
    dueDate: doc.dueDate
      ? new Date(doc.dueDate).toISOString().slice(0, 10)
      : "",
    notes: doc.notes,
    terms: doc.terms,
    leadTime: doc.leadTime,
    deliveryAddress: doc.deliveryAddress,
    items: doc.items.map((i) => ({
      reference: i.reference,
      name: i.name,
      description: i.description,
      unit: i.unit,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      discountRate: Number(i.discountRate),
      taxRate: Number(i.taxRate),
      sourceItemId: i.sourceItemId || undefined,
      productId: i.productId || undefined,
    })),
  };
  return (
    <>
      <PageHeader
        title={"Modifier " + doc.number}
        description="Les totaux sont recalculés à chaque modification."
      />
      <DocumentEditor
        kind={doc.kind}
        id={id}
        version={doc.version}
        initial={initial}
        clients={options.clients}
        products={options.products.map((p) => ({
          ...p,
          price: String(p.price),
          tax: String(p.tax),
        }))}
        company={{
          currency: company.currency,
          defaultTax: String(company.defaultTax),
          quoteValidity: company.quoteValidity,
          paymentTerms: company.paymentTerms,
        }}
      />
    </>
  );
}
