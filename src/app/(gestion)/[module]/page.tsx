import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import {
  modules,
  statusLabels,
  transitions,
  type Module,
} from "@/lib/business";
import {
  documents,
  pageNumber,
  selectors,
  type Filters,
} from "@/server/queries";
import { currentUser, allowed } from "@/server/auth";
import {
  PageHeader,
  FilterBar,
  EmptyState,
  Pagination,
} from "@/components/common";
import { money, shortDate } from "@/lib/utils";
import { Status } from "@/components/status";
import { DeleteChainButton } from "@/components/delete-chain-button";
export default async function Documents({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<Filters>;
}) {
  const { module } = await params;
  if (!(module in modules)) notFound();
  const config = modules[module as Module],
    filters = await searchParams,
    [data, user, options] = await Promise.all([
      documents(config.kind, filters),
      currentUser(),
      selectors(),
    ]);
  const permission = config.kind === "INVOICE" ? "invoice" : "sales";
  const statuses = Object.fromEntries(
    Object.keys(transitions[config.kind]).map((s) => [s, statusLabels[s]]),
  );
  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        action={
          user && allowed(user.role, permission)
            ? {
                href: "/" + module + "/nouveau",
                label: "Nouveau " + config.singular,
              }
            : undefined
        }
      />
      <div className="panel">
        <FilterBar
          filters={filters}
          statuses={statuses}
          dateFilters
          clients={options.clients}
        />
        {data.rows.length ? (
          <div className="table-wrap responsive-table">
            <table>
              <thead>
                <tr>
                  <th>DOCUMENT</th>
                  <th>CLIENT</th>
                  <th>DATE</th>
                  <th>STATUT</th>
                  <th className="align-right">
                    {config.kind === "DELIVERY" ? "COMMANDE LIÉE" : "TOTAL TTC"}
                  </th>
                  {config.kind === "INVOICE" && (
                    <th className="align-right">RESTE À PAYER</th>
                  )}
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((d) => {
                  const currency = String(
                    (d.companySnapshot as Record<string, unknown>).currency ||
                      "MAD",
                  );
                  return (
                    <tr key={d.id}>
                      <td data-label="Document">
                        <Link
                          href={"/" + module + "/" + d.id}
                          className="table-primary"
                        >
                          {d.number}
                        </Link>
                        {d.source && (
                          <span className="table-secondary">
                            {d.source.number}
                          </span>
                        )}
                      </td>
                      <td data-label="Client">
                        <Link href={"/clients/" + d.clientId}>
                          {d.client.name}
                        </Link>
                      </td>
                      <td data-label="Date">{shortDate(d.date)}</td>
                      <td data-label="Statut">
                        <Status status={d.status} />
                      </td>
                      <td
                        data-label={
                          config.kind === "DELIVERY" ? "Commande" : "Total TTC"
                        }
                        className="align-right table-amount"
                      >
                        {config.kind === "DELIVERY"
                          ? d.source?.number || "—"
                          : money(Number(d.totalTTC), currency)}
                      </td>
                      {config.kind === "INVOICE" && (
                        <td
                          data-label="Reste à payer"
                          className="align-right table-amount"
                        >
                          {money(
                            Number(d.totalTTC) -
                              d.payments.reduce(
                                (s, p) => s + Number(p.amount),
                                0,
                              ),
                            currency,
                          )}
                        </td>
                      )}
                      <td>
                        <div className="record-actions">
                          <Link
                            href={"/" + module + "/" + d.id}
                            aria-label={"Ouvrir " + d.number}
                          >
                            <ArrowUpRight size={17} />
                          </Link>
                          {user?.role === "ADMIN" && (
                            <DeleteChainButton id={d.id} number={d.number} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={
              filters.q || filters.status
                ? "Aucun document trouvé"
                : "Votre premier " + config.singular + " commence ici"
            }
            text="Créez un document ou convertissez une étape précédente pour conserver toutes les informations."
            href={
              user && allowed(user.role, permission)
                ? "/" + module + "/nouveau"
                : undefined
            }
            action={"Créer un " + config.singular}
          />
        )}
        <Pagination
          total={data.total}
          page={pageNumber(filters.page)}
          filters={filters}
        />
      </div>
    </>
  );
}
