import {
  Document,
  Page,
  View,
  Text,
  Image as PdfImage,
  StyleSheet,
} from "@react-pdf/renderer";
import type { PrintDocument } from "./document-data";
import { statusLabels } from "@/lib/business";
import { montantEnLettres } from "@/lib/lettres";
import { money, shortDate } from "@/lib/utils";
import path from "node:path";
import { pathToFileURL } from "node:url";
const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#111111",
    paddingTop: 0,
    paddingHorizontal: 36,
    paddingBottom: 68,
  },
  header: {
    position: "absolute",
    top: 27,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderColor: "#f2ce00",
    paddingBottom: 14,
  },
  brand: { fontSize: 28, fontFamily: "Helvetica-Bold", letterSpacing: 2 },
  subBrand: { fontSize: 7, color: "#111111", letterSpacing: 1.5, marginTop: 5 },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold", textAlign: "right" },
  meta: { fontSize: 8, color: "#111111", marginTop: 5, textAlign: "right" },
  partyRow: { flexDirection: "row", gap: 22, marginBottom: 22 },
  party: { width: "50%", lineHeight: 1.5 },
  companyParty: {
    borderLeftWidth: 3,
    borderLeftColor: "#f2ce00",
    paddingLeft: 10,
  },
  individualParty: {
    backgroundColor: "#fff9d9",
    borderLeftWidth: 3,
    borderLeftColor: "#f2ce00",
    paddingLeft: 10,
  },
  label: { fontSize: 7, letterSpacing: 1, color: "#111111", marginBottom: 7 },
  name: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  individualName: { fontSize: 14 },
  small: { fontSize: 8, color: "#111111", lineHeight: 1.5 },
  info: { padding: 12, backgroundColor: "#fff6c4", marginBottom: 18 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f2ce00",
    color: "#111111",
    paddingVertical: 10,
    paddingHorizontal: 7,
    fontSize: 7,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 7,
    borderBottomWidth: 0.5,
    borderColor: "#eee3b8",
  },
  rowAlt: { backgroundColor: "#fffdf2" },
  itemName: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 2 },
  description: { fontSize: 8, color: "#111111", lineHeight: 1.5 },
  totals: {
    width: 230,
    alignSelf: "flex-end",
    marginTop: 23,
    marginBottom: 20,
    backgroundColor: "#f2ce00",
    color: "#111111",
    padding: 12,
    borderRadius: 3,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    fontSize: 9,
  },
  grand: {
    borderTopWidth: 1,
    borderColor: "#111111",
    paddingTop: 10,
    marginTop: 7,
    color: "#111111",
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
  },
  notes: {
    marginTop: 12,
    marginBottom: 8,
    lineHeight: 1.6,
    fontSize: 8,
    color: "#111111",
  },
  signature: {
    width: 230,
    height: 100,
    alignSelf: "flex-end",
    borderWidth: 0.7,
    borderColor: "#111111",
    marginTop: 25,
    padding: 13,
    fontSize: 9,
  },
  footer: {
    position: "absolute",
    bottom: 25,
    height: 30,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderColor: "#111111",
    paddingTop: 8,
    fontSize: 7,
    color: "#111111",
    lineHeight: 1.5,
  },
  pageNumber: {
    position: "absolute",
    bottom: 13,
    right: 36,
    fontSize: 7,
    color: "#111111",
  },
});
const titles = {
  QUOTE: "DEVIS",
  ORDER: "BON DE COMMANDE",
  DELIVERY: "BON DE LIVRAISON",
  INVOICE: "FACTURE",
};
export function CommercialPdf({
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
    [client.city, client.country].filter(Boolean).join(" · "),
    client.phone,
    client.email,
    !individual && client.ice && "ICE : " + client.ice,
    !individual && client.taxId && "IF : " + client.taxId,
    !individual && client.rc && "RC : " + client.rc,
    !individual && client.patente && "TP : " + client.patente,
  ]
    .filter(Boolean)
    .join("\n");
  const columns = delivery
    ? valued
      ? [
          { label: "N°", width: "5%" },
          { label: "ARTICLE / DÉSIGNATION", width: "28%" },
          { label: "QTÉ COMMANDÉE", width: "10%" },
          { label: "QTÉ LIVRÉE", width: "10%" },
          { label: "UNITÉ", width: "8%" },
          { label: "P.U. HT", width: "17%" },
          { label: "TOTAL HT", width: "22%" },
        ]
      : [
          { label: "N°", width: "6%" },
          { label: "ARTICLE / DÉSIGNATION", width: "44%" },
          { label: "QTÉ COMMANDÉE", width: "18%" },
          { label: "QTÉ LIVRÉE", width: "20%" },
          { label: "UNITÉ", width: "12%" },
        ]
    : order
      ? [
          { label: "N°", width: "5%" },
          { label: "ARTICLE / RÉFÉRENCE", width: "43%" },
          { label: "QUANTITÉ", width: "12%" },
          { label: "P.U. HT", width: "18%" },
          { label: "MONTANT HT", width: "22%" },
        ]
      : [
          { label: "N°", width: "5%" },
          { label: "ARTICLE / DÉSIGNATION", width: "30%" },
          { label: "QTÉ", width: "8%" },
          { label: "UNITÉ", width: "8%" },
          { label: "P.U. HT", width: "18%" },
          { label: "REM. %", width: "7%" },
          { label: "TVA %", width: "6%" },
          { label: "TOTAL HT", width: "18%" },
        ];
  const col = columns.map((column) => column.width);
  return (
    <Document
      title={titles[doc.kind] + " " + doc.number}
      author={c.name || "IRONZ"}
    >
      <Page size="A4" style={styles.page} wrap>
        <View fixed wrap={false} style={{ height: 118 }} />
        <PdfImage
          fixed
          src={
            pathToFileURL(path.join(process.cwd(), "public", "ironz-logo.png"))
              .href
          }
          style={{
            position: "absolute",
            top: 27,
            left: 36,
            width: 100,
            height: 40,
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
        <Text
          fixed
          style={{ ...styles.title, position: "absolute", top: 28, right: 36 }}
          render={() => titles[doc.kind]}
        />
        <Text
          fixed
          style={{ ...styles.meta, position: "absolute", top: 49, right: 36 }}
          render={() => (order ? "N° de commande : " : "") + doc.number}
        />
        <Text
          fixed
          style={{ ...styles.meta, position: "absolute", top: 62, right: 36 }}
          render={() =>
            (order ? "Date de la commande : " : "") +
            shortDate(doc.date) +
            " · " +
            statusLabels[doc.status]
          }
        />
        <View
          fixed
          wrap={false}
          style={{
            position: "absolute",
            left: 36,
            right: 36,
            top: 88,
            height: 1.5,
            backgroundColor: "#f2ce00",
          }}
        />
        {columns.map(({ label }, n) => {
          const left =
            43 +
            col
              .slice(0, n)
              .reduce((s, width) => s + (parseFloat(width) / 100) * 509, 0);
          return (
            <Text
              fixed
              key={"repeat-" + label}
              style={{
                position: "absolute",
                top: 100,
                left,
                width: (parseFloat(col[n]) / 100) * 509 - 5,
                fontSize: 7,
                color: "#111111",
                textAlign:
                  n === 0
                    ? "center"
                    : n >= (delivery ? 2 : order ? 3 : 4)
                      ? "right"
                      : "left",
              }}
              render={({ pageNumber }) => (pageNumber > 1 ? label : "")}
            />
          );
        })}
        <View style={styles.partyRow}>
          <View style={styles.party}>
            <Text style={styles.label}>ÉMETTEUR</Text>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.small}>
              {[c.address, c.city].filter(Boolean).join("\n")}
            </Text>
            <Text style={styles.small}>
              {[c.phone, c.email, c.website].filter(Boolean).join("\n")}
            </Text>
            <Text style={styles.small}>
              {[
                c.ice && "ICE : " + c.ice,
                c.taxId && "IF : " + c.taxId,
                c.rc && "RC : " + c.rc,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <View
            style={[
              styles.party,
              individual ? styles.individualParty : styles.companyParty,
            ]}
          >
            <Text style={styles.label}>
              {delivery
                ? individual
                  ? "DESTINATAIRE · PARTICULIER"
                  : "DESTINATAIRE · ENTREPRISE"
                : order
                  ? doc.deliveryAddress
                    ? individual
                      ? "CLIENT · PARTICULIER"
                      : "CLIENT · ENTREPRISE"
                    : individual
                      ? "EXPÉDIER À · PARTICULIER"
                      : "EXPÉDIER À · ENTREPRISE"
                  : individual
                    ? "CLIENT PARTICULIER"
                    : "CLIENT ENTREPRISE"}
            </Text>
            <Text
              style={[
                styles.name,
                individual ? styles.individualName : undefined,
              ]}
            >
              {client.name}
            </Text>
            <Text style={styles.small}>{clientDetails}</Text>
          </View>
        </View>
        {(doc.dueDate ||
          doc.references.length ||
          doc.deliveryAddress ||
          doc.leadTime) && (
          <View style={styles.info}>
            <Text style={styles.small}>
              {[
                doc.dueDate &&
                  (doc.kind === "QUOTE" ? "Validité : " : "Échéance : ") +
                    shortDate(doc.dueDate),
                doc.references.length &&
                  "Documents liés : " + doc.references.join(" / "),
                doc.deliveryAddress &&
                  (order ? "Expédier à : " : "Livraison : ") +
                    doc.deliveryAddress,
                doc.leadTime && "Délai : " + doc.leadTime,
              ]
                .filter(Boolean)
                .join("\n")}
            </Text>
          </View>
        )}
        <View style={styles.tableHead} wrap={false}>
          {columns.map(({ label, width }, n) => (
            <Text
              key={label}
              style={{
                width,
                textAlign:
                  n === 0
                    ? "center"
                    : n >= (delivery ? 2 : 4)
                      ? "right"
                      : "left",
                paddingRight: 5,
              }}
            >
              {label}
            </Text>
          ))}
        </View>
        {doc.items.map((item, index) => (
          <View
            key={item.id}
            style={[styles.row, index % 2 === 1 ? styles.rowAlt : undefined]}
            wrap={false}
          >
            <Text
              style={{ width: col[0], textAlign: "center", color: "#8a7600" }}
            >
              {String(index + 1).padStart(2, "0")}
            </Text>
            <View style={{ width: col[1], paddingRight: 10 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.description}>
                {order ? "SKU : " : ""}
                {item.reference}
              </Text>
              {order && (
                <Text style={styles.description}>
                  {[
                    item.discountRate
                      ? "Remise " + item.discountRate + "%"
                      : "",
                    "TVA " + item.taxRate + "%",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              )}
            </View>
            {delivery && (
              <Text style={{ width: col[2] }}>{item.orderedQuantity}</Text>
            )}
            {order ? (
              <Text
                style={{ width: col[2], textAlign: "right", paddingRight: 5 }}
              >
                {item.quantity} {item.unit}
              </Text>
            ) : (
              <>
                <Text style={{ width: col[delivery ? 3 : 2] }}>
                  {item.quantity}
                </Text>
                <Text style={{ width: col[delivery ? 4 : 3] }}>
                  {item.unit}
                </Text>
              </>
            )}
            {valuedDelivery && (
              <>
                <Text
                  style={{
                    width: col[5],
                    textAlign: "right",
                    paddingRight: 5,
                  }}
                >
                  {money(item.unitPrice, currency)}
                </Text>
                <Text style={{ width: col[6], textAlign: "right" }}>
                  {money(item.totalHT, currency)}
                </Text>
              </>
            )}
            {!delivery &&
              (order ? (
                <>
                  <Text
                    style={{
                      width: col[3],
                      textAlign: "right",
                      paddingRight: 5,
                    }}
                  >
                    {money(item.unitPrice, currency)}
                  </Text>
                  <Text style={{ width: col[4], textAlign: "right" }}>
                    {money(item.totalHT, currency)}
                  </Text>
                </>
              ) : (
                <>
                  <Text
                    style={{
                      width: col[4],
                      textAlign: "right",
                      paddingRight: 5,
                    }}
                  >
                    {money(item.unitPrice, currency)}
                  </Text>
                  <Text
                    style={{
                      width: col[5],
                      textAlign: "right",
                      paddingRight: 5,
                    }}
                  >
                    {item.discountRate}
                  </Text>
                  <Text
                    style={{
                      width: col[6],
                      textAlign: "right",
                      paddingRight: 5,
                    }}
                  >
                    {item.taxRate}
                  </Text>
                  <Text style={{ width: col[7], textAlign: "right" }}>
                    {money(item.totalHT, currency)}
                  </Text>
                </>
              ))}
          </View>
        ))}
        {(!delivery || valuedDelivery) && (
          <View style={styles.totals} wrap={false}>
            {[
              ["Sous-total", doc.subtotal],
              ["Remise", doc.discount],
              ["Total HT", doc.totalHT],
              ["TVA", doc.totalTax],
            ].map(([label, value]) => (
              <View key={String(label)} style={styles.totalRow}>
                <Text>{String(label)}</Text>
                <Text>{money(Number(value), currency)}</Text>
              </View>
            ))}
            <View style={[styles.totalRow, styles.grand]}>
              <Text>Total TTC</Text>
              <Text>{money(doc.totalTTC, currency)}</Text>
            </View>
            {doc.kind === "INVOICE" && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.label}>NET À PAYER EN LETTRES</Text>
                <Text style={{ fontSize: 8, lineHeight: 1.5 }}>
                  {montantEnLettres(doc.totalTTC)}
                </Text>
              </View>
            )}
            {doc.kind === "INVOICE" && (
              <>
                <View style={styles.totalRow}>
                  <Text>Montant payé</Text>
                  <Text>{money(doc.paid, currency)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text>Reste à payer</Text>
                  <Text>{money(doc.remaining, currency)}</Text>
                </View>
              </>
            )}
          </View>
        )}
        {doc.terms && (
          <View style={styles.notes}>
            <Text style={styles.label}>
              CONDITIONS & MODALITÉS DE PAIEMENT *
            </Text>
            <Text>{doc.terms}</Text>
          </View>
        )}
        {doc.notes && (
          <View style={styles.notes}>
            <Text style={styles.label}>NOTES *</Text>
            <Text>{doc.notes}</Text>
          </View>
        )}
        {c.footer && (
          <View style={styles.notes}>
            <Text>{c.footer}</Text>
          </View>
        )}
        {delivery && (
          <View style={styles.signature} wrap={false}>
            <Text>Signature / Cachet client</Text>
            <Text style={{ marginTop: 12, fontSize: 8, color: "#111111" }}>
              Bon pour réception
            </Text>
          </View>
        )}
        <Text
          fixed
          style={styles.footer}
          render={() =>
            [
              [
                c.name,
                c.ice && "ICE " + c.ice,
                c.taxId && "IF " + c.taxId,
                c.rc && "RC " + c.rc,
                c.patente && "TP " + c.patente,
              ]
                .filter(Boolean)
                .join(" · "),
              [c.bank, c.rib && "RIB : " + c.rib, c.iban && "IBAN : " + c.iban]
                .filter(Boolean)
                .join(" · "),
            ]
              .filter(Boolean)
              .join("\n")
          }
        />
        <Text
          fixed
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            doc.number + " · " + pageNumber + " / " + totalPages
          }
        />
      </Page>
    </Document>
  );
}
