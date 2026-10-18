import { requireUser } from "@/server/auth";
import { settings } from "@/server/queries";
import { latestBackupName } from "@/server/backup";
import { RecordForm } from "@/components/record-form";
import { BackupRestorePanel } from "@/components/backup-restore";
import { PageHeader } from "@/components/common";
export default async function Settings() {
  await requireUser("admin");
  const company = await settings();
  const lastBackup = latestBackupName();
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
      <RecordForm resource="parametres" initial={company} />
      <BackupRestorePanel lastBackup={lastBackup} />
    </>
  );
}
