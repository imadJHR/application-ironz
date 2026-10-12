import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveRestore, ArrowUpRight, Trash2 } from "lucide-react";
import { clientDetail, settings } from "@/server/queries";
import { currentUser, allowed } from "@/server/auth";
import { setClientArchived } from "@/server/actions";
import { PageHeader, EmptyState } from "@/components/common";
import { ActionButton } from "@/components/action-button";
import { Status } from "@/components/status";
import { money, shortDate } from "@/lib/utils";
import { moduleFor, modules } from "@/lib/business";
import { Button } from "@/components/ui/button";
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params,
    [client, company, user, filter] = await Promise.all([
      clientDetail(id),
      settings(),
      currentUser(),
      searchParams,
    ]);
  if (!client) notFound();
  const issued = client.documents.filter(
      (d) => d.kind === "INVOICE" && !["DRAFT", "CANCELLED"].includes(d.status),
    ),
    invoiced = issued.reduce((s, i) => s + Number(i.totalTTC), 0),
    paid = client.payments.reduce((s, p) => s + Number(p.amount), 0);
  const tab = filter.tab || "informations";
  const selected = client.documents.filter((d) => moduleFor(d.kind) === tab);
  return (
    <>
      <PageHeader
        eyebrow="FICHE CLIENT"
        title={client.name}
        description={
          client.type +
          " · " +
          (client.city || "Maroc") +
          (client.archived ? " · Archivé" : "")
        }
      >
        {user && allowed(user.role, "sales") && (
          <>
            <Button variant="outline" asChild>
              <Link href={"/clients/" + id + "/modifier"}>Modifier</Link>
            </Button>
            <ActionButton
              action={setClientArchived.bind(null, id, !client.archived)}
              confirmation={
                client.archived
                  ? undefined
                  : "Archiver ce client ? Ses documents et son historique seront conservés."
              }
              confirmationTitle="Archiver le client"
              confirmLabel="Archiver"
              destructiveConfirmation={!client.archived}
            >
              {client.archived ? (
                <>
                  <ArchiveRestore size={14} /> Restaurer
                </>
              ) : (
                <>
                  <Trash2 size={14} /> Archiver
                </>
              )}
            </ActionButton>
            {!client.archived && (
              <Button asChild>
                <Link href={"/devis/nouveau?client=" + id}>Créer un devis</Link>
              </Button>
            )}
          </>
        )}
      </PageHeader>
      <div className="summary-grid">
        {[
          ["Total facturé", invoiced],
          ["Total encaissé", paid],
          ["Solde restant", invoiced - paid],
        ].map(([label, value]) => (
          <div className="summary-card" key={String(label)}>
            <span>{label}</span>
            <strong>{money(Number(value), company.currency)}</strong>
          </div>
        ))}
      </div>
      <div className="section-tabs">
        {[
          ["informations", "Informations"],
          ["devis", "Devis"],
          ["commandes", "Commandes"],
          ["livraisons", "Livraisons"],
          ["factures", "Factures"],
          ["paiements", "Paiements"],
        ].map(([t, label]) => (
          <Link
            key={t}
            className={tab === t ? "active" : ""}
            href={"?tab=" + t}
          >
            {label}
          </Link>
        ))}
      </div>
      {tab === "informations" ? (
        <div className="panel detail-panel">
          <h2 style={{ marginBottom: 25 }}>Informations générales</h2>
          <div className="client-info">
            {[
              ["Contact", client.contact],
              ["Téléphone", client.phone],
              ["Email", client.email],
              [
                "Adresse",
                [client.address, client.city, client.country]
                  .filter(Boolean)
                  .join("\n"),
              ],
              ["ICE", client.ice],
              ["Identifiant fiscal", client.taxId],
              ["Registre de commerce", client.rc],
              ["Notes", client.notes],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="detail-label">{label}</span>
                <div className="detail-value">{value || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      ) : tab === "paiements" ? (
        <div className="panel">
          {client.payments.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>PAIEMENT</th>
                    <th>FACTURE</th>
                    <th>DATE</th>
                    <th>MOYEN</th>
                    <th className="align-right">MONTANT</th>
                  </tr>
                </thead>
                <tbody>
                  {client.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.number}</td>
                      <td>
                        <Link
                          className="table-primary"
                          href={"/factures/" + p.invoiceId}
                        >
                          {p.invoice.number}
                        </Link>
                      </td>
                      <td>{shortDate(p.date)}</td>
                      <td>{p.method}</td>
                      <td className="align-right">
                        {money(Number(p.amount), company.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Aucun paiement enregistré"
              text="Les paiements de ce client apparaîtront ici."
            />
          )}
        </div>
      ) : (
        <div className="panel">
          {selected.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>DOCUMENT</th>
                    <th>DATE</th>
                    <th>STATUT</th>
                    <th className="align-right">TOTAL TTC</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {selected.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <Link
                          className="table-primary"
                          href={"/" + moduleFor(d.kind) + "/" + d.id}
                        >
                          {d.number}
                        </Link>
                      </td>
                      <td>{shortDate(d.date)}</td>
                      <td>
                        <Status status={d.status} />
                      </td>
                      <td className="align-right">
                        {d.kind === "DELIVERY"
                          ? "—"
                          : money(Number(d.totalTTC), company.currency)}
                      </td>
                      <td>
                        <Link href={"/" + moduleFor(d.kind) + "/" + d.id}>
                          <ArrowUpRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Aucun document pour le moment"
              text="Chaque nouveau document lié à ce client sera accessible ici."
              href={
                "/" + (tab in modules ? tab : "devis") + "/nouveau?client=" + id
              }
              action="Créer un document"
            />
          )}
        </div>
      )}
    </>
  );
}
