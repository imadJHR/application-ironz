import Image from "next/image";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { requireUser } from "@/server/auth";
import { db, isPreview } from "@/server/db";
import { toggleUser } from "@/server/actions";
import { PageHeader, EmptyState } from "@/components/common";
import { ActionButton } from "@/components/action-button";
import { UserControls } from "@/components/user-controls";
import { shortDate } from "@/lib/utils";
export default async function Users() {
  const actor = await requireUser("admin"),
    users = isPreview()
      ? []
      : await db.user.findMany({
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            createdAt: true,
          },
        });
  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description="Les bonnes personnes. Les bons accès. Exclusivement IRONZ."
        action={{
          href: "/utilisateurs/nouveau",
          label: "Ajouter un collaborateur",
        }}
      />
      <div className="panel">
        {users.length ? (
          <div className="table-wrap responsive-table">
            <table>
              <thead>
                <tr>
                  <th>COLLABORATEUR</th>
                  <th>RÔLE</th>
                  <th>STATUT</th>
                  <th>DEPUIS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Collaborateur">
                      <div className="user-profile-cell">
                        <span className="user-profile-logo">
                          <Image
                            src="/ironz-logo.png"
                            alt="IRONZ"
                            width={28}
                            height={28}
                          />
                        </span>
                        <div>
                          <strong className="table-primary">{u.name}</strong>
                          <span className="table-secondary">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Rôle">
                      {u.role === "ADMIN"
                        ? "Administrateur"
                        : u.role === "COMMERCIAL"
                          ? "Commercial"
                          : "Comptabilité"}
                    </td>
                    <td data-label="Statut">
                      <span
                        className={
                          "status " +
                          (u.active ? "status-paid" : "status-cancelled")
                        }
                      >
                        {u.active ? "Actif" : "Désactivé"}
                      </span>
                    </td>
                    <td data-label="Créé le">{shortDate(u.createdAt)}</td>
                    <td>
                      <div className="record-actions">
                        <UserControls id={u.id} />
                        {u.id !== actor.id && (
                          <ActionButton
                            size="icon"
                            variant="ghost"
                            ariaLabel={
                              u.active
                                ? "Désactiver le compte"
                                : "Réactiver le compte"
                            }
                            action={toggleUser.bind(null, u.id)}
                            confirmation={
                              u.active
                                ? "Désactiver ce compte et fermer ses sessions ?"
                                : undefined
                            }
                            confirmationTitle="Désactiver le compte"
                            confirmLabel="Désactiver"
                            destructiveConfirmation
                          >
                            {u.active ? (
                              <Trash2 size={16} aria-hidden="true" />
                            ) : (
                              <ArchiveRestore size={16} aria-hidden="true" />
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
            title="Votre équipe, en toute sécurité"
            text="Seuls les administrateurs peuvent créer des comptes internes. Aucune inscription publique."
          />
        )}
      </div>
    </>
  );
}
