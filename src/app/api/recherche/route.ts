import { currentUser } from "@/server/auth";
import { globalSearch } from "@/server/queries";
import { moduleFor, statusLabels, type Kind } from "@/lib/business";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user)
    return Response.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  const q = new URL(req.url).searchParams.get("q") || "";
  const { clients, documents, products } = await globalSearch(
    q.slice(0, 200),
  );
  return Response.json({
    clients: clients.slice(0, 5).map((c) => ({
      label: String(c.name),
      sub: [c.city, c.phone].filter(Boolean).join(" · "),
      href: "/clients/" + String(c.id),
    })),
    documents: documents.slice(0, 5).map((d) => ({
      label: String(d.number),
      sub:
        String((d.client as { name?: string } | null)?.name || "") +
        " · " +
        (statusLabels[String(d.status)] || String(d.status)),
      href: "/" + moduleFor(String(d.kind) as Kind) + "/" + String(d.id),
    })),
    products: products.slice(0, 5).map((p) => ({
      label: (p.reference ? String(p.reference) + " · " : "") + String(p.name),
      sub: String(p.category || ""),
      href: "/produits/" + String(p.id) + "/modifier",
    })),
  });
}
