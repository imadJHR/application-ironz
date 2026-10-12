import Link from "next/link";
import { ArchiveRestore, Package, Trash2 } from "lucide-react";
import { products, pageNumber, settings, productTypeCounts, type Filters } from "@/server/queries";
import { currentUser, allowed } from "@/server/auth";
import { toggleProduct } from "@/server/actions";
import { ActionButton } from "@/components/action-button";
import {
  PageHeader,
  FilterBar,
  EmptyState,
  Pagination,
} from "@/components/common";
import { money } from "@/lib/utils";
export default async function Products({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const filters = await searchParams,
    [data, company, user, counts] = await Promise.all([
      products({ ...filters, type: filters.type === "service" ? "service" : "produit" }),
      settings(),
      currentUser(),
      productTypeCounts(filters.archived === "true"),
    ]);
  const write = user && allowed(user.role, "sales");
  const tabHref = (type: string) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.archived) params.set("archived", filters.archived);
    params.set("type", type);
    return "/produits?" + params.toString();
  };
  const activeTab = filters.type === "service" ? "service" : "produit";
  return (
    <>
      <PageHeader
        title="Produits & services"
        description="Catalogue importé depuis votre base produits."
      />
      <div className="panel">
        <nav className="section-tabs" aria-label="Type de catalogue">
          <Link
            href={tabHref("produit")}
            className={activeTab === "produit" ? "active" : undefined}
          >
            Produits ({counts.produit})
          </Link>
          <Link
            href={tabHref("service")}
            className={activeTab === "service" ? "active" : undefined}
          >
            Services ({counts.service})
          </Link>
        </nav>
        <FilterBar filters={filters} archive />
        {data.rows.length ? (
          <div className="table-wrap responsive-table">
            <table>
              <thead>
                <tr>
                  <th>RÉFÉRENCE / DÉSIGNATION</th>
                  <th>TYPE / CATÉGORIE</th>
                  <th>UNITÉ</th>
                  <th className="align-right">PRIX HT</th>
                  <th>TVA</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Article">
                      <span className="table-media">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image}
                            alt=""
                            width={40}
                            height={40}
                            loading="lazy"
                          />
                        ) : null}
                        <span>
                          <Link
                            className="table-primary"
                            href={"/produits/" + p.id + "/modifier"}
                          >
                            {p.reference || "—"}
                          </Link>
                          <span className="table-secondary">{p.name}</span>
                        </span>
                      </span>
                    </td>
                    <td data-label="Type">
                      {p.type}
                      <span className="table-secondary">{p.category}</span>
                    </td>
                    <td data-label="Unité">{p.unit}</td>
                    <td data-label="Prix HT" className="align-right">
                      {money(Number(p.price), company.currency)}
                    </td>
                    <td data-label="TVA">{Number(p.tax)} %</td>
                    <td>
                      {write && (
                        <div className="record-actions">
                          <Link
                            href={"/produits/" + p.id + "/modifier"}
                            className="btn btn-outline btn-sm"
                          >
                            Modifier
                          </Link>
                          <ActionButton
                            size="icon"
                            variant="ghost"
                            ariaLabel={
                              p.active
                                ? "Désactiver l’article"
                                : "Réactiver l’article"
                            }
                            action={toggleProduct.bind(null, p.id)}
                            confirmation={
                              p.active
                                ? "Désactiver cet article ? Les documents existants restent inchangés."
                                : undefined
                            }
                            confirmationTitle="Désactiver l’article"
                            confirmLabel="Désactiver"
                            destructiveConfirmation
                          >
                            {p.active ? (
                              <Trash2 size={16} aria-hidden="true" />
                            ) : (
                              <ArchiveRestore size={16} aria-hidden="true" />
                            )}
                          </ActionButton>
                        </div>
                      )}
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
                ? "Aucun article trouvé"
                : "Catalogue importé depuis votre base produits"
            }
            text="Les articles sont importés depuis votre base produits et restent modifiables ici."
          />
        )}
        <Pagination
          total={data.total}
          page={pageNumber(filters.page)}
          filters={filters}
        />
      </div>
      <div className="editor-note">
        <Package size={14} />
        Les prix peuvent être adaptés dans chaque document sans modifier le
        catalogue.
      </div>
    </>
  );
}
