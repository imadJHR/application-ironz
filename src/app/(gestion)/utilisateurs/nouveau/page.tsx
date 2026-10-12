import { requireUser } from "@/server/auth";
import { RecordForm } from "@/components/record-form";
import { PageHeader } from "@/components/common";
export default async function NewUser() {
  await requireUser("admin");
  return (
    <>
      <PageHeader
        title="Nouvel utilisateur"
        description="Un accès individuel pour un collaborateur IRONZ."
      />
      <RecordForm resource="utilisateurs" />
    </>
  );
}
