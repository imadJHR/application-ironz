import { db, isPreview } from "@/server/db";
import { requireUser } from "@/server/auth";
import { PageHeader, EmptyState } from "@/components/common";
import { PaymentForm } from "@/components/payment-form";
export default async function NewPayment() {
  await requireUser("finance");
  const invoices = isPreview()
    ? []
    : await db.document.findMany({
        where: {
          kind: "INVOICE",
          status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
        },
        orderBy: { date: "desc" },
        include: { client: true, payments: true },
      });
  const options = invoices
    .map((i) => ({
      id: i.id,
      number: i.number,
      client: i.client.name,
      remaining:
        Number(i.totalTTC) -
        i.payments.reduce((s, p) => s + Number(p.amount), 0),
      currency: String(
        (i.companySnapshot as Record<string, unknown>).currency || "MAD",
      ),
    }))
    .filter((i) => i.remaining > 0);
  return (
    <>
      <PageHeader
        title="Nouveau paiement"
        description="Un encaissement enregistré, un solde immédiatement actualisé."
      />
      <div className="panel form-panel">
        {options.length ? (
          <PaymentForm invoices={options} />
        ) : (
          <EmptyState
            title="Aucune facture à encaisser"
            text="Émettez une facture avant d’enregistrer un paiement."
            href="/factures"
            action="Consulter les factures"
          />
        )}
      </div>
    </>
  );
}
