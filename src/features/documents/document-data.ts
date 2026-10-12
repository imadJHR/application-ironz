import type { getDocument } from "@/server/queries";
export type StoredDocument = NonNullable<
  Awaited<ReturnType<typeof getDocument>>
>;
export function documentData(doc: StoredDocument) {
  const company = doc.companySnapshot as Record<string, unknown>,
    client = doc.clientSnapshot as Record<string, unknown>;
  const paid = doc.payments.reduce((s, p) => s + Number(p.amount), 0);
  return {
    id: doc.id,
    kind: doc.kind,
    number: doc.number,
    status: doc.status,
    date: new Date(doc.date).toISOString(),
    dueDate: doc.dueDate ? new Date(doc.dueDate).toISOString() : null,
    company: Object.fromEntries(
      Object.entries(company).map(([k, v]) => [k, String(v ?? "")]),
    ),
    client: Object.fromEntries(
      Object.entries(client).map(([k, v]) => [k, String(v ?? "")]),
    ),
    references: doc.ancestors.map((a) => a.number),
    items: doc.items.map((i) => ({
      id: i.id,
      reference: i.reference,
      name: i.name,
      description: i.description,
      unit: i.unit,
      orderedQuantity: Number(i.sourceItem?.quantity || i.quantity),
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      discountRate: Number(i.discountRate),
      taxRate: Number(i.taxRate),
      totalHT: Number(i.totalHT),
      totalTax: Number(i.totalTax),
      totalTTC: Number(i.totalTTC),
    })),
    subtotal: Number(doc.subtotal),
    discount: Number(doc.discount),
    totalHT: Number(doc.totalHT),
    totalTax: Number(doc.totalTax),
    totalTTC: Number(doc.totalTTC),
    paid,
    remaining: Number(doc.totalTTC) - paid,
    notes: doc.notes,
    terms: doc.terms,
    leadTime: doc.leadTime,
    deliveryAddress: doc.deliveryAddress,
  };
}
export type PrintDocument = ReturnType<typeof documentData>;
