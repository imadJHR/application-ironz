import Link from "next/link";
import { ArchiveRestore, ArrowUpRight, Trash2, UsersRound } from "lucide-react";
import { clients, pageNumber, type Filters } from "@/server/queries";
import { currentUser, allowed } from "@/server/auth";
import { setClientArchived } from "@/server/actions";
import { ActionButton } from "@/components/action-button";
import {
  PageHeader,
  FilterBar,
  EmptyState,
  Pagination,
} from "@/components/common";
export default async function Clients({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const filters = await searchParams,
    [data, user] = await Promise.all([clients(filters), currentUser()]);
  const write = user && allowed(user.role, "sales");
  return (
    <>
      <PageHeader
        title="Clients"
        description="Les bonnes relations commencent par une information claire."
        action={
          write
            ? { href: "/clients/nouveau", label: "Ajouter un client" }
            : undefined
        }
      />
      <div className="panel">
        <FilterBar filters={filters} archive />
        {data.rows.length ? (
          <div className="table-wrap responsive-table">
            <table>
              <thead>
                <tr>
                  <th>CLIENT</th>
                  <th>CONTACT</th>
                  <th>TÉLÉPHONE</th>
                  <th>VILLE</th>
                  <th>ICE</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Client">
                      <Link href={"/clients/" + c.id} className="table-primary">
                        {c.name}
                      </Link>
                      <span className="table-secondary">{c.type}</span>
                    </td>
                    <td data-label="Contact">
                      {c.contact || "—"}
                      <span className="table-secondary">{c.email}</span>
                    </td>
                    <td data-label="Téléphone">{c.phone || "—"}</td>
                    <td data-label="Ville">{c.city || "—"}</td>
                    <td data-label="ICE">{c.ice || "—"}</td>
                    <td>
                      <div className="record-actions">
                        <Link
                          href={"/clients/" + c.id}
                          aria-label={"Consulter " + c.name}
                          title="Consulter la fiche client"
                        >
                          <ArrowUpRight size={17} />
                        </Link>
                        {write && (
                          <ActionButton
                            size="icon"
                            variant="ghost"
                            ariaLabel={
                              c.archived
                                ? "Restaurer le client"
                                : "Archiver le client"
                            }
                            action={setClientArchived.bind(
                              null,
                              c.id,
                              !c.archived,
                            )}
                            confirmation={
                              c.archived
                                ? undefined
                                : "Archiver ce client ? Ses documents et son historique seront conservés."
                            }
                            confirmationTitle="Archiver le client"
                            confirmLabel="Archiver"
                            destructiveConfirmation
                          >
                            {c.archived ? (
                              <ArchiveRestore size={16} aria-hidden="true" />
                            ) : (
                              <Trash2 size={16} aria-hidden="true" />
                            )}
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={
              filters.q
                ? "Aucun client trouvé"
                : "Vos relations clients, réunies ici"
            }
            text={
              filters.q
                ? "Essayez un autre nom, contact, téléphone ou ICE."
                : "Ajoutez votre premier client pour commencer à créer des documents commerciaux."
            }
            href={write ? "/clients/nouveau" : undefined}
            action="Ajouter un client"
          />
        )}
        <Pagination
          total={data.total}
          page={pageNumber(filters.page)}
          filters={filters}
        />
      </div>
      <div className="editor-note">
        <UsersRound size={14} />
        Les clients archivés conservent tout leur historique commercial.
      </div>
    </>
  );
}
