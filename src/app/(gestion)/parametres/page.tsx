import { requireUser } from "@/server/auth";
import { db, isDesktopDb, isPreview } from "@/server/db";
import { settings } from "@/server/queries";
import { latestBackupName } from "@/server/backup";
import { RecordForm } from "@/components/record-form";
import { BackupRestorePanel } from "@/components/backup-restore";
import { RecoveryCodePanel } from "@/components/recovery-code-panel";
import { PageHeader } from "@/components/common";
import { ensureRecoverySchema } from "@/server/recovery";
export default async function Settings() {
  const user = await requireUser("admin");
  const company = await settings();
  const lastBackup = latestBackupName();
  // Code de récupération : uniquement sur la base locale (desktop).
  let hasCode = false;
  let consumed = false;
  let codeCreatedAt: string | null = null;
  try {
    if (isDesktopDb() && !isPreview()) {
      await ensureRecoverySchema();
      const row = await db.recoveryCode.findUnique({
        where: { userId: user.id },
      });
      if (row) {
        hasCode = true;
        consumed = Boolean(row.consumedAt);
        codeCreatedAt = row.createdAt.toISOString().slice(0, 10);
      }
    }
  } catch {
    // La récupération reste silencieusement indisponible en cas d'erreur
    // de schéma : aucun blocage de la page de paramètres.
  }
  return (
    <>
      <PageHeader
        title="Paramètres"
        description="L’identité IRONZ, de votre espace de travail à vos documents."
      />
      <div className="info-banner">
        Les documents conservent une copie de vos informations à leur création.
        Une modification du profil n’altère jamais les anciens documents.
      </div>
      {isDesktopDb() && (
        <RecoveryCodePanel
          hasCode={hasCode}
          consumed={consumed}
          createdAt={codeCreatedAt}
        />
      )}
      <RecordForm resource="parametres" initial={company} />
      <BackupRestorePanel lastBackup={lastBackup} />
    </>
  );
}
