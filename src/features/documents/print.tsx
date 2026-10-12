import { Brand } from "@/components/brand";
import { money, shortDate } from "@/lib/utils";
import { montantEnLettres } from "@/lib/lettres";
import type { PrintDocument } from "./document-data";
const titles = {
  QUOTE: "Devis",
  ORDER: "Bon de commande",
  DELIVERY: "Bon de livraison",
  INVOICE: "Facture",
};
export function CommercialPrint({
  doc,
  valued,
}: {
  doc: PrintDocument;
  valued?: boolean;
}) {
  const c = doc.company,
    client = doc.client,
    currency = c.currency || "MAD",
    delivery = doc.kind === "DELIVERY",
    valuedDelivery = delivery && valued,
    order = doc.kind === "ORDER";
  const individual = client.type === "Particulier";
  const clientDetails = [
    client.contact &&
      (individual ? "Contact : " : "À l’attention de : ") + client.contact,
    client.address,
    client.city,
    client.country,
    client.phone,
    client.email,
    !individual && client.ice && "ICE " + client.ice,
    !individual && client.taxId && "IF " + client.taxId,
    !individual && client.rc && "RC " + client.rc,
    !individual && client.patente && "TP " + client.patente,
  ].filter(Boolean);
  return (
    <article
      className={
        "commercial-print " +
        (individual
          ? "commercial-print--individual"
          : "commercial-print--business")
      }
    >
      <div className="print-header">
        <div>
          <Brand compact />
          <div className="print-company">
            <strong>{c.name}</strong>
            <br />
            {[c.address, c.city, c.phone, c.email, c.website]
              .filter(Boolean)
              .map((v, n) => (
                <div key={n}>{v}</div>
              ))}
            {[
              c.ice && "ICE " + c.ice,
              c.taxId && "IF " + c.taxId,
              c.rc && "RC " + c.rc,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <div>
          <h1>{titles[doc.kind]}</h1>
          <div className="print-meta">
            {order ? "N° de commande : " + doc.number : doc.number}
            <br />
            {order && "Date de la commande : "}
            {shortDate(doc.date)}
            {doc.status === "DRAFT" && (
              <>
                <br />
                BROUILLON
              </>
            )}
            {doc.dueDate && (
              <>
                <br />
                {doc.kind === "QUOTE" ? "Validité" : "Échéance"} :{" "}
                {shortDate(doc.dueDate)}
              </>
            )}
          </div>
        </div>
      </div>
      <div className="detail-meta">
        <div
          className={
            "client-card " +
            (individual ? "client-card--individual" : "client-card--business")
          }
        >
          <span className="detail-label">
            {delivery
              ? individual
                ? "Destinataire · particulier"
                : "Destinataire · entreprise"
              : order
                ? doc.deliveryAddress
                  ? individual
                    ? "Client · particulier"
                    : "Client · entreprise"
                  : individual
                    ? "Expédier à · particulier"
                    : "Expédier à · entreprise"
                : individual
                  ? "Client particulier"
                  : "Client entreprise"}
          </span>
          <strong>{client.name}</strong>
          <div className="print-company">
            {clientDetails.map((v, n) => (
              <div key={n}>{v}</div>
            ))}
          </div>
        </div>
        <div>
          <span className="detail-label">Documents liés</span>
          <div className="print-meta">{doc.references.join("\n") || "—"}</div>
          {doc.deliveryAddress && (
            <>
              <br />
              <span className="detail-label">
                {order ? "Expédier à" : "Livraison"}
              </span>
              <div className="print-meta">{doc.deliveryAddress}</div>
            </>
          )}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>N°</th>
            <th>{order ? "ARTICLE / RÉFÉRENCE" : "ARTICLE"}</th>
            {order ? (
              <>
                <th>QUANTITÉ</th>
                <th>P.U. HT</th>
                <th>MONTANT HT</th>
              </>
            ) : (
              <>
                {delivery && <th>COMMANDÉE</th>}
                <th>{delivery ? "LIVRÉE" : "QTÉ"}</th>
                <th>UNITÉ</th>
                {valuedDelivery && (
                  <>
                    <th>P.U. HT</th>
                    <th className="align-right">TOTAL HT</th>
                  </>
                )}
                {!delivery && (
                  <>
                    <th>P.U. HT</th>
                    <th>REMISE</th>
                    <th>TVA</th>
                    <th className="align-right">TOTAL HT</th>
                  </>
                )}
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {doc.items.map((i, index) => (
            <tr key={i.id}>
              <td className="document-line-number">
                {String(index + 1).padStart(2, "0")}
              </td>
              <td>
                <strong>{i.name}</strong>
                <div className="print-company">
                  {order ? "SKU : " + i.reference : i.reference}
                  {order && (
                    <>
                      <br />
                      {i.discountRate > 0 && `Remise ${i.discountRate} % · `}
                      TVA {i.taxRate} %
                    </>
                  )}
                </div>
              </td>
              {order ? (
                <>
                  <td>
                    {i.quantity} {i.unit}
                  </td>
                  <td>{money(i.unitPrice, currency)}</td>
                  <td className="align-right">{money(i.totalHT, currency)}</td>
                </>
              ) : (
                <>
                  {delivery && <td>{i.orderedQuantity}</td>}
                  <td>{i.quantity}</td>
                  <td>{i.unit}</td>
                  {valuedDelivery && (
                    <>
                      <td>{money(i.unitPrice, currency)}</td>
                      <td className="align-right">
                        {money(i.totalHT, currency)}
                      </td>
                    </>
                  )}
                  {!delivery && (
                    <>
                      <td>{money(i.unitPrice, currency)}</td>
                      <td>{i.discountRate} %</td>
                      <td>{i.taxRate} %</td>
                      <td className="align-right">
                        {money(i.totalHT, currency)}
                      </td>
                    </>
                  )}
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {(!delivery || valuedDelivery) && (
        <div className="print-totals">
          {[
            ["Sous-total", doc.subtotal],
            ["Remise", doc.discount],
            ["Total HT", doc.totalHT],
            ["TVA", doc.totalTax],
          ].map(([l, v]) => (
            <div className="totals-row" key={String(l)}>
              <span>{l}</span>
              <strong>{money(Number(v), currency)}</strong>
            </div>
          ))}
          <div className="totals-row totals-grand">
            <span>Total TTC</span>
            <strong>{money(doc.totalTTC, currency)}</strong>
          </div>
          {doc.kind === "INVOICE" && (
            <div className="totals-words">
              Net à payer : {montantEnLettres(doc.totalTTC)}.
            </div>
          )}
          {doc.kind === "INVOICE" && (
            <>
              <div className="totals-row">
                <span>Montant payé</span>
                <strong>{money(doc.paid, currency)}</strong>
              </div>
              <div className="totals-row">
                <span>Reste à payer</span>
                <strong>{money(doc.remaining, currency)}</strong>
              </div>
            </>
          )}
        </div>
      )}
      {doc.leadTime && (
        <div className="detail-note">Délai : {doc.leadTime}</div>
      )}
      {doc.terms && (
        <div className="detail-note">
          <strong>Conditions & modalités de paiement *</strong>
          <br />
          {doc.terms}
        </div>
      )}
      {doc.notes && (
        <div className="detail-note">
          <strong>Notes *</strong>
          <br />
          {doc.notes}
        </div>
      )}
      {delivery && (
        <div className="signature">
          Signature / Cachet client
          <br />
          <br />
          Bon pour réception
        </div>
      )}
      <footer className="print-footer">
        {[
          c.footer,
          c.bank,
          c.rib && "RIB : " + c.rib,
          c.iban && "IBAN : " + c.iban,
          [
            c.name,
            c.ice && "ICE " + c.ice,
            c.taxId && "IF " + c.taxId,
            c.rc && "RC " + c.rc,
            c.patente && "TP " + c.patente,
          ]
            .filter(Boolean)
            .join(" · "),
        ]
          .filter(Boolean)
          .join("\n")}
      </footer>
    </article>
  );
}
