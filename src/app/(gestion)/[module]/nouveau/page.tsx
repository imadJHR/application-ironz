import { notFound } from "next/navigation";
import { modules, type Module } from "@/lib/business";
import { selectors, settings } from "@/server/queries";
import { requireUser } from "@/server/auth";
import { PageHeader } from "@/components/common";
import { DocumentEditor } from "@/components/document-editor";
export default async function NewDocument({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ client?: string }>;
}) {
  const { module } = await params;
  if (!(module in modules)) notFound();
  const config = modules[module as Module];
  await requireUser(config.kind === "INVOICE" ? "invoice" : "sales");
  const [options, company, filters] = await Promise.all([
    selectors(),
    settings(),
    searchParams,
  ]);
  return (
    <>
      <PageHeader
        eyebrow={config.title.toUpperCase()}
        title={"Nouveau " + config.singular}
        description="Sélectionnez un client. Ajoutez vos articles. Le reste suit."
      />
      <DocumentEditor
        kind={config.kind}
        clients={options.clients}
        products={options.products.map((p) => ({
          ...p,
          price: String(p.price),
          tax: String(p.tax),
        }))}
        company={{
          currency: company.currency,
          defaultTax: String(company.defaultTax),
          quoteValidity: company.quoteValidity,
          paymentTerms: company.paymentTerms,
        }}
        clientId={filters.client}
      />
    </>
  );
}
