import { requireUser } from "@/server/auth";
import { RecordForm } from "@/components/record-form";
import { PageHeader } from "@/components/common";
export default async function NewClient() {
  await requireUser("sales");
  return (
    <>
      <PageHeader
        title="Nouveau client"
        description="Une fiche complète pour simplifier tous vos échanges."
      />
      <RecordForm resource="clients" />
    </>
  );
}
