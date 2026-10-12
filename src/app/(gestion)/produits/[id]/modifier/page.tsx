import { requireUser } from "@/server/auth";
import { db, isPreview } from "@/server/db";
import { serialize } from "@/server/queries";
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
    product = isPreview()
      ? null
      : await db.product.findUnique({ where: { id } });
  if (!product) notFound();
  return (
    <>
      <PageHeader
        title="Modifier l’article"
        description={
          (product.reference ? product.reference + " · " : "") + product.name
        }
      />
      <RecordForm resource="produits" id={id} initial={serialize(product)} />
    </>
  );
}
