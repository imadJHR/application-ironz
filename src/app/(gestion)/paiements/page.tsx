import Link from "next/link";
import { db, isPreview } from "@/server/db";
import { requireUser, allowed } from "@/server/auth";
import { pageNumber, serialize, type Filters } from "@/server/queries";
import {
  PageHeader,
  FilterBar,
  EmptyState,
  Pagination,
} from "@/components/common";
import { money, shortDate } from "@/lib/utils";
import { Prisma } from "@/generated/prisma";
export default async function Payments({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const filters = await searchParams,
    user = await requireUser();
  const parse = (s?: string) =>
    s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime())
      ? new Date(s)
      : undefined;
  const where: Prisma.PaymentWhereInput = {
    date: {
      gte: parse(filters.from),
      lte: parse(filters.to)
        ? new Date(parse(filters.to)!.getTime() + 86399999)
        : undefined,
    },
    ...(filters.q
      ? {
          OR: [
            { number: { contains: filters.q, mode: "insensitive" } },
            { reference: { contains: filters.q, mode: "insensitive" } },
            {
              invoice: { number: { contains: filters.q, mode: "insensitive" } },
            },
            { client: { name: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [rows, total] = isPreview()
    ? [[], 0]
    : await Promise.all([
        db.payment.findMany({
          where,
          orderBy: { date: "desc" },
          take: 12,
          skip: (pageNumber(filters.page) - 1) * 12,
          include: {
            invoice: true,
            client: true,
            createdBy: { select: { name: true } },
          },
        }),
        db.payment.count({ where }),
      ]);
  const payments = serialize(rows);
  return (
    <>
      <PageHeader
        title="Paiements"
        description="Chaque encaissement, chaque référence, chaque solde."
        action={
          allowed(user.role, "finance")
            ? { href: "/paiements/nouveau", label: "Enregistrer un paiement" }
            : undefined
        }
      />
      <div className="panel">
        <FilterBar filters={filters} dateFilters />
        {payments.length ? (
          <div className="table-wrap responsive-table">
            <table>
              <thead>
                <tr>
                  <th>PAIEMENT / CLIENT</th>
                  <th>FACTURE</th>
                  <th>DATE</th>
                  <th>MOYEN / RÉFÉRENCE</th>
                  <th className="align-right">MONTANT</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Paiement">
                      <strong className="table-primary">{p.number}</strong>
                      <Link
                        className="table-secondary"
                        href={"/clients/" + p.clientId}
                      >
                        {p.client.name}
                      </Link>
                    </td>
                    <td data-label="Facture">
                      <Link
                        href={"/factures/" + p.invoiceId}
                        className="table-primary"
                      >
                        {p.invoice.number}
                      </Link>
                    </td>
                    <td data-label="Date">{shortDate(p.date)}</td>
                    <td data-label="Moyen">
                      {p.method}
                      <span className="table-secondary">
                        {p.reference || "—"} · {p.createdBy.name}
                      </span>
                    </td>
                    <td
                      data-label="Montant"
                      className="align-right table-amount"
                    >
                      {money(
                        Number(p.amount),
                        String(
                          (p.invoice.companySnapshot as Record<string, unknown>)
                            .currency || "MAD",
                        ),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="La trésorerie commence ici"
            text="Enregistrez un paiement sur une facture émise. Les paiements partiels et multiples sont pris en charge."
            href={
              allowed(user.role, "finance") ? "/paiements/nouveau" : undefined
            }
            action="Enregistrer un paiement"
          />
        )}
        <Pagination
          total={total}
          page={pageNumber(filters.page)}
          filters={filters}
        />
      </div>
    </>
  );
}
