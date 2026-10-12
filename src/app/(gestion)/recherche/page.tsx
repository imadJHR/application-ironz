import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { globalSearch } from "@/server/queries";
import { PageHeader, EmptyState } from "@/components/common";
import { moduleFor } from "@/lib/business";
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams,
    data = await globalSearch(q.slice(0, 200));
  return (
    <>
      <PageHeader
        title="Recherche"
        description={
          q
            ? "Résultats pour « " + q + " »"
            : "Retrouvez un client, un article ou un document."
        }
      />
      <form className="panel filterbar" action="/recherche">
        <div className="module-search">
          <input
            name="q"
            defaultValue={q}
            placeholder="Un nom, une référence, un numéro…"
            minLength={2}
            required
            aria-label="Recherche globale"
          />
        </div>
        <button className="btn btn-primary">Rechercher</button>
      </form>
      {q.length >= 2 ? (
        <div className="search-results" style={{ marginTop: 20 }}>
          <section className="panel search-section">
            <h2>Clients · {data.clients.length}</h2>
            {data.clients.length ? (
              data.clients.map((c) => (
                <Link
                  className="search-result"
                  key={c.id}
                  href={"/clients/" + c.id}
                >
                  <span>
                    {c.name}
                    <small>
                      {c.contact} · {c.city}
                    </small>
                  </span>
                  <ArrowUpRight size={15} />
                </Link>
              ))
            ) : (
              <EmptyState
                compact
                title="Aucun client trouvé"
                text="Essayez un autre terme."
              />
            )}
          </section>
          <section className="panel search-section">
            <h2>Documents · {data.documents.length}</h2>
            {data.documents.length ? (
              data.documents.map((d) => (
                <Link
                  className="search-result"
                  key={d.id}
                  href={"/" + moduleFor(d.kind) + "/" + d.id}
                >
                  <span>
                    {d.number}
                    <small>{d.client.name}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </Link>
              ))
            ) : (
              <EmptyState
                compact
                title="Aucun document trouvé"
                text="Recherchez un numéro ou un client."
              />
            )}
          </section>
          <section className="panel search-section">
            <h2>Catalogue · {data.products.length}</h2>
            {data.products.length ? (
              data.products.map((p) => (
                <Link
                  className="search-result"
                  key={p.id}
                  href={"/produits/" + p.id + "/modifier"}
                >
                  <span>
                    {p.reference}
                    <small>{p.name}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </Link>
              ))
            ) : (
              <EmptyState
                compact
                title="Aucun article trouvé"
                text="Recherchez une référence ou une désignation."
              />
            )}
          </section>
        </div>
      ) : (
        <EmptyState
          title="Que recherchez-vous ?"
          text="Saisissez au moins deux caractères pour lancer la recherche."
        />
      )}
    </>
  );
}
