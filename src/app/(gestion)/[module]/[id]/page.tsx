import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ArrowUpRight, ShieldCheck, Clock3 } from "lucide-react";
import { getDocument } from "@/server/queries";
import { requireUser, allowed } from "@/server/auth";
import { modules, moduleFor, type Module } from "@/lib/business";
import { PageHeader } from "@/components/common";
import { Status } from "@/components/status";
import { DocumentActions } from "@/components/document-actions";
import { Button } from "@/components/ui/button";
import { money, shortDate } from "@/lib/utils";
export default async function DocumentDetail({
  params,
}: {
  params: Promise<{ module: string; id: string }>;
}) {
  const { module, id } = await params,
    [doc, user] = await Promise.all([getDocument(id), requireUser()]);
  if (!doc || moduleFor(doc.kind) !== module) notFound();
  const company = doc.companySnapshot as Record<string, unknown>,
    client = doc.clientSnapshot as Record<string, unknown>,
    currency = String(company.currency || "MAD"),
    paid = doc.payments.reduce((s, p) => s + Number(p.amount), 0),
    remaining = Number(doc.totalTTC) - paid;
  const remainingLines =
    doc.kind === "ORDER"
      ? doc.items.map((i) => ({
          id: i.id,
          name: i.name,
          unit: i.unit,
          remaining: Math.max(
            0,
            Number(i.quantity) -
              doc.children
                .filter((d) => d.kind === "DELIVERY")
                .flatMap((d) => d.items)
                .filter((l) => l.sourceItemId === i.id)
                .reduce((s, l) => s + Number(l.quantity), 0),
          ),
        }))
      : undefined;
  return (
    <>
      <PageHeader
        eyebrow={modules[module as Module].title.toUpperCase()}
        title={doc.number}
        description={
          "Créé par " + doc.createdBy.name + " · " + shortDate(doc.date)
        }
      >
        <Status status={doc.status} />
        {doc.status === "DRAFT" &&
          !doc.children.length &&
          allowed(user.role, doc.kind === "INVOICE" ? "invoice" : "sales") && (
            <Button asChild variant="outline">
              <Link href={"/" + module + "/" + id + "/modifier"}>Modifier</Link>
            </Button>
          )}
      </PageHeader>
      <div className="detail-layout">
        <div>
          <section className="panel detail-panel">
            <div className="detail-top">
              <div>
                <span className="detail-label">
                  {doc.kind === "DELIVERY" ? "DESTINATAIRE" : "CLIENT"}
                </span>
                <h2>{String(client.name || doc.client.name)}</h2>
                <p>{String(client.contact || "")}</p>
              </div>
              <Link className="text-link" href={"/clients/" + doc.clientId}>
                Fiche client <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="detail-meta">
              <div>
                <span className="detail-label">Adresse</span>
                <div className="detail-value">
                  {[client.address, client.city, client.country]
                    .filter(Boolean)
                    .join("\n") || "—"}
                </div>
              </div>
              <div>
                <span className="detail-label">Contact</span>
                <div className="detail-value">
                  {[client.phone, client.email].filter(Boolean).join("\n") ||
                    "—"}
                </div>
              </div>
              <div>
                <span className="detail-label">
                  {doc.kind === "QUOTE" ? "Date de validité" : "Échéance"}
                </span>
                <div className="detail-value">
                  {doc.dueDate ? shortDate(doc.dueDate) : "—"}
                </div>
              </div>
              <div>
                <span className="detail-label">ICE / IF</span>
                <div className="detail-value">
                  {[client.ice, client.taxId].filter(Boolean).join(" / ") ||
                    "—"}
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ARTICLE / PRESTATION</th>
                    {doc.kind === "DELIVERY" && <th>QTÉ COMMANDÉE</th>}
                    <th>{doc.kind === "DELIVERY" ? "QTÉ LIVRÉE" : "QTÉ"}</th>
                    <th>UNITÉ</th>
                    {doc.kind !== "DELIVERY" && (
                      <>
                        <th className="align-right">P.U. HT</th>
                        <th>REMISE</th>
                        <th>TVA</th>
                        <th className="align-right">TOTAL HT</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <strong className="table-primary">{i.name}</strong>
                        <span className="table-secondary">{i.reference}</span>
                        {i.description && (
                          <p
                            className="detail-value"
                            style={{ fontSize: 10, marginTop: 7 }}
                          >
                            {i.description}
                          </p>
                        )}
                      </td>
                      {doc.kind === "DELIVERY" && (
                        <td>{Number(i.sourceItem?.quantity || i.quantity)}</td>
                      )}
                      <td>{Number(i.quantity)}</td>
                      <td>{i.unit}</td>
                      {doc.kind !== "DELIVERY" && (
                        <>
                          <td className="align-right">
                            {money(Number(i.unitPrice), currency)}
                          </td>
                          <td>{Number(i.discountRate)} %</td>
                          <td>{Number(i.taxRate)} %</td>
                          <td className="align-right">
                            {money(Number(i.totalHT), currency)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {doc.kind !== "DELIVERY" && (
              <div className="print-totals">
                {[
                  ["Sous-total", doc.subtotal],
                  ["Remise", doc.discount],
                  ["Total HT", doc.totalHT],
                  ["TVA", doc.totalTax],
                ].map(([label, value]) => (
                  <div className="totals-row" key={String(label)}>
                    <span>{String(label)}</span>
                    <strong>{money(String(value), currency)}</strong>
                  </div>
                ))}
                <div className="totals-row totals-grand">
                  <span>Total TTC</span>
                  <strong>{money(Number(doc.totalTTC), currency)}</strong>
                </div>
                {doc.kind === "INVOICE" && (
                  <>
                    <div className="totals-row">
                      <span>Montant payé</span>
                      <strong>{money(paid, currency)}</strong>
                    </div>
                    <div className="totals-row">
                      <span>Reste à payer</span>
                      <strong>{money(remaining, currency)}</strong>
                    </div>
                  </>
                )}
              </div>
            )}
            {doc.deliveryAddress && (
              <div className="detail-note">
                <span className="detail-label">Adresse de livraison</span>
                {doc.deliveryAddress}
              </div>
            )}
            {doc.leadTime && (
              <div className="detail-note">
                <span className="detail-label">Délai</span>
                {doc.leadTime}
              </div>
            )}
            {doc.terms && (
              <div className="detail-note">
                <span className="detail-label">Conditions & modalités</span>
                {doc.terms}
              </div>
            )}
            {doc.notes && (
              <div className="detail-note">
                <span className="detail-label">Notes</span>
                {doc.notes}
              </div>
            )}
            {doc.kind === "DELIVERY" && (
              <div className="signature">
                Signature / Cachet client
                <br />
                <br />
                Bon pour réception
              </div>
            )}
          </section>
          {doc.kind === "ORDER" && remainingLines && (
            <section className="panel detail-panel" style={{ marginTop: 20 }}>
              <h2 style={{ marginBottom: 20 }}>Suivi des quantités</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ARTICLE</th>
                      <th>COMMANDÉ</th>
                      <th>LIVRÉ</th>
                      <th>RÉSERVÉ</th>
                      <th>DISPONIBLE À LIVRER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.items.map((i) => {
                      const deliveries = doc.children.filter(
                          (d) => d.kind === "DELIVERY",
                        ),
                        quantity = (status: string[]) =>
                          deliveries
                            .filter((d) => status.includes(d.status))
                            .flatMap((d) => d.items)
                            .filter((l) => l.sourceItemId === i.id)
                            .reduce((s, l) => s + Number(l.quantity), 0);
                      return (
                        <tr key={i.id}>
                          <td>{i.name}</td>
                          <td>
                            {Number(i.quantity)} {i.unit}
                          </td>
                          <td>{quantity(["DELIVERED", "RECEIVED"])}</td>
                          <td>{quantity(["DRAFT", "PREPARED"])}</td>
                          <td>
                            {
                              remainingLines.find((l) => l.id === i.id)
                                ?.remaining
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {doc.payments.length > 0 && (
            <section className="panel detail-panel" style={{ marginTop: 20 }}>
              <h2 style={{ marginBottom: 20 }}>Paiements enregistrés</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>PAIEMENT</th>
                      <th>DATE</th>
                      <th>MOYEN / RÉFÉRENCE</th>
                      <th className="align-right">MONTANT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.payments.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.number}
                          <span className="table-secondary">
                            {p.createdBy.name}
                          </span>
                        </td>
                        <td>{shortDate(p.date)}</td>
                        <td>
                          {p.method}
                          <span className="table-secondary">{p.reference}</span>
                        </td>
                        <td className="align-right">
                          {money(Number(p.amount), currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <section className="panel detail-panel" style={{ marginTop: 20 }}>
            <h2 style={{ marginBottom: 15 }}>Historique du document</h2>
            {doc.history.map((a) => (
              <div className="activity-item" key={a.id}>
                <span className="activity-icon">
                  <Clock3 size={15} />
                </span>
                <div>
                  <strong>{a.action}</strong>
                  <p>{a.detail}</p>
                  <small>
                    {a.user.name} · {shortDate(a.createdAt)}
                  </small>
                </div>
              </div>
            ))}
          </section>
        </div>
        <aside>
          <div className="panel chain-panel">
            <h2>Documents liés</h2>
            {[...doc.ancestors, doc, ...doc.descendants].map((d) => (
              <Link
                key={d.id}
                href={"/" + moduleFor(d.kind) + "/" + d.id}
                className={"chain-link " + (d.id === id ? "chain-current" : "")}
              >
                <span className="chain-link-icon">
                  <FileText size={15} />
                </span>
                <div>
                  <strong>{d.number}</strong>
                  <small>
                    {modules[moduleFor(d.kind)].title}
                    {d.id === id ? " · Document actuel" : ""}
                  </small>
                </div>
              </Link>
            ))}
          </div>
          <DocumentActions
            id={id}
            kind={doc.kind}
            status={doc.status}
            role={user.role}
            remainingLines={remainingLines}
            invoice={
              doc.kind === "INVOICE"
                ? {
                    id,
                    number: doc.number,
                    client: String(client.name),
                    remaining,
                    currency,
                  }
                : undefined
            }
          />
          <div className="editor-note">
            <ShieldCheck size={14} />
            <span>
              Les informations sont conservées dans ce document, même si le
              client ou le catalogue est modifié.
            </span>
          </div>
        </aside>
      </div>
    </>
  );
}
