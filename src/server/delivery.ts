import "server-only";
import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma";
import type { Kind } from "@/lib/business";

type DeliverySourceItem = {
  position: number;
  productId: string | null;
  reference: string;
  name: string;
  unit: string;
  quantity: string;
};

export function sameDeliveryItems(
  order: DeliverySourceItem[],
  invoice: DeliverySourceItem[],
) {
  const invoiceByPosition = new Map(
    invoice.map((item) => [item.position, item]),
  );
  return (
    order.length === invoice.length &&
    order.every((item) => {
      const invoiced = invoiceByPosition.get(item.position);
      return (
        invoiced &&
        item.productId === invoiced.productId &&
        item.reference === invoiced.reference &&
        item.name === invoiced.name &&
        item.unit === invoiced.unit &&
        new Decimal(item.quantity).eq(invoiced.quantity)
      );
    })
  );
}

export function remainingDeliveryQuantity(
  item: { id: string; quantity: string },
  deliveries: {
    kind: Kind;
    status: string;
    items: { sourceItemId: string | null; quantity: string }[];
  }[],
) {
  return deliveries
    .filter((doc) => doc.kind === "DELIVERY" && doc.status !== "CANCELLED")
    .flatMap((doc) => doc.items)
    .filter((line) => line.sourceItemId === item.id)
    .reduce(
      (remaining, line) => remaining.minus(line.quantity),
      new Decimal(item.quantity),
    );
}

export async function deliveryConflict(
  tx: Prisma.TransactionClient,
  source: {
    id: string;
    kind: Kind;
    sourceId: string | null;
    items: DeliverySourceItem[];
  },
): Promise<string | undefined> {
  if (source.kind === "ORDER") {
    const linkedDelivery = await tx.document.findFirst({
      where: {
        kind: "DELIVERY",
        status: { not: "CANCELLED" },
        source: { is: { kind: "INVOICE", sourceId: source.id } },
      },
      select: { id: true },
    });
    if (linkedDelivery)
      return "Une livraison est déjà en cours depuis la facture liée. Poursuivez depuis cette facture.";
    return;
  }
  if (source.kind !== "INVOICE" || !source.sourceId) return;

  const parent = await tx.document.findUniqueOrThrow({
    where: { id: source.sourceId },
    select: { kind: true, id: true, items: true },
  });
  if (parent.kind === "DELIVERY")
    return "Cette facture a été créée depuis un bon de livraison déjà lié.";
  if (parent.kind === "ORDER" || parent.kind === "QUOTE") {
    const linkedDocument = await tx.document.findFirst({
      where: {
        sourceId: parent.id,
        kind: parent.kind === "ORDER" ? "DELIVERY" : "ORDER",
        status: { not: "CANCELLED" },
      },
      select: { id: true },
    });
    if (linkedDocument)
      return "Une commande liée gère déjà la livraison. Poursuivez depuis cette commande.";
  }
  if (parent.kind === "ORDER" && !sameDeliveryItems(parent.items, source.items))
    return "Les lignes ou quantités de la facture diffèrent de la commande liée. Préparez la livraison depuis cette commande.";
}
