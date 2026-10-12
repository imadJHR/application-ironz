import { requireUser } from "@/server/auth";
import { clientDetail } from "@/server/queries";
import { notFound } from "next/navigation";
import { RecordForm } from "@/components/record-form";
import { PageHeader } from "@/components/common";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser("sales");
  const { id } = await params,
    client = await clientDetail(id);
  if (!client) notFound();
  return (
    <>
      <PageHeader title="Modifier le client" description={client.name} />
      <RecordForm resource="clients" id={id} initial={client} />
    </>
  );
}
