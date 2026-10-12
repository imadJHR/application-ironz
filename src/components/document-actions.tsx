"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileDown,
  Printer,
  Copy,
  ArrowRight,
  Wallet,
  Truck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  setDocumentStatus,
  convertDocument,
  duplicateDocument,
  deleteChain,
} from "@/server/actions";
import {
  transitions,
  statusLabels,
  moduleFor,
  type Kind,
} from "@/lib/business";
import { ActionButton } from "./action-button";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Modal } from "./modal";
import { PaymentForm, type InvoiceOption } from "./payment-form";
import { allowed, type AccessRole } from "@/lib/permissions";
export function DocumentActions({
  id,
  kind,
  status,
  role,
  invoice,
  remainingLines,
}: {
  id: string;
  kind: Kind;
  status: string;
  role: AccessRole;
  invoice?: InvoiceOption;
  remainingLines?: {
    id: string;
    name: string;
    unit: string;
    remaining: number;
  }[];
}) {
  const [payment, setPayment] = useState(false),
    [delivery, setDelivery] = useState(false),
    [busy, setBusy] = useState(false),
    [quantities, setQuantities] = useState<Record<string, number>>({}),
    router = useRouter(),
    documentModule = moduleFor(kind);
  const write = allowed(role, kind === "INVOICE" ? "invoice" : "sales"),
    finance = allowed(role, "finance"),
    invoicing = allowed(role, "invoice"),
    sales = allowed(role, "sales");
  const deliver = async () => {
    setBusy(true);
    try {
      const result = await convertDocument(id, "DELIVERY", quantities);
      if (result.ok) {
        toast.success(result.message);
        setDelivery(false);
        router.push("/livraisons/" + result.id);
        router.refresh();
      } else toast.error(result.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="document-actions">
        <Button asChild variant="outline">
          <a href={"/api/documents/" + id + "/pdf"}>
            <FileDown size={15} />
            Télécharger PDF
          </a>
        </Button>
        {kind === "DELIVERY" && (
          <Button asChild variant="outline">
            <a href={"/api/documents/" + id + "/pdf?interne=1"}>
              <FileDown size={15} />
              PDF interne
            </a>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href={"/" + documentModule + "/" + id + "/imprimer"}>
            <Printer size={15} />
            Imprimer
          </Link>
        </Button>
        {write && (
          <ActionButton
            action={duplicateDocument.bind(null, id)}
            redirectTo={"/" + documentModule + "/:id"}
          >
            <Copy size={15} />
            Dupliquer
          </ActionButton>
        )}
      </div>
      <div className="panel action-stack">
        <h2 style={{ marginBottom: 8 }}>Prochaine étape</h2>
        {write &&
          (transitions[kind][status] || []).map((next) => (
            <ActionButton
              key={next}
              action={setDocumentStatus.bind(null, id, next)}
              confirmation={
                next === "CANCELLED"
                  ? "Annuler ce document ? Cette action est définitive."
                  : next === "SENT"
                    ? "Émettre ce document ? Les factures émises ne peuvent plus être modifiées."
                    : undefined
              }
            >
              {statusLabels[next]}
              <ArrowRight size={14} />
            </ActionButton>
          ))}
        {kind === "QUOTE" && status === "ACCEPTED" && (
          <>
            {sales && (
              <ActionButton
                variant="default"
                action={convertDocument.bind(null, id, "ORDER", undefined)}
                redirectTo="/commandes/:id"
              >
                Créer la commande
                <ArrowRight size={14} />
              </ActionButton>
            )}
            {invoicing && (
              <ActionButton
                action={convertDocument.bind(null, id, "INVOICE", undefined)}
                redirectTo="/factures/:id"
              >
                Créer une facture
                <ArrowRight size={14} />
              </ActionButton>
            )}
          </>
        )}
        {kind === "ORDER" &&
          ["CONFIRMED", "PREPARING", "DELIVERED"].includes(status) && (
            <>
              {sales && remainingLines?.some((l) => l.remaining > 0) && (
                <Button
                  onClick={() => {
                    setQuantities(
                      Object.fromEntries(
                        remainingLines.map((l) => [l.id, l.remaining]),
                      ),
                    );
                    setDelivery(true);
                  }}
                >
                  <Truck size={15} />
                  Préparer une livraison
                </Button>
              )}
              {invoicing && (
                <ActionButton
                  action={convertDocument.bind(null, id, "INVOICE", undefined)}
                  redirectTo="/factures/:id"
                >
                  Créer une facture
                  <ArrowRight size={14} />
                </ActionButton>
              )}
            </>
          )}
        {kind === "DELIVERY" &&
          ["DELIVERED", "RECEIVED"].includes(status) &&
          invoicing && (
            <ActionButton
              variant="default"
              action={convertDocument.bind(null, id, "INVOICE", undefined)}
              redirectTo="/factures/:id"
            >
              Créer une facture
              <ArrowRight size={14} />
            </ActionButton>
          )}
        {invoice &&
          finance &&
          !["DRAFT", "CANCELLED", "PAID"].includes(status) && (
            <Button onClick={() => setPayment(true)}>
              <Wallet size={15} />
              Enregistrer un paiement
            </Button>
          )}
        {(!write || (transitions[kind][status] || []).length === 0) && (
          <p className="form-description" style={{ margin: 0 }}>
            Les informations de ce document sont conservées dans votre
            historique.
          </p>
        )}
        {role === "ADMIN" && (
          <ActionButton
            variant="destructive"
            action={deleteChain.bind(null, id)}
            redirectTo={"/" + documentModule}
            confirmationTitle="Supprimer toute la chaîne ?"
            confirmation="Suppression définitive : ce document et TOUS les documents liés (devis, commandes, livraisons, factures, paiements) seront effacés de la base. Réservé aux chaînes en brouillon sans paiement. Irréversible."
            confirmLabel="Supprimer définitivement"
            destructiveConfirmation
          >
            <Trash2 size={14} />
            Supprimer la chaîne
          </ActionButton>
        )}
      </div>
      {payment && invoice && (
        <Modal
          title="Enregistrer un paiement"
          onClose={() => setPayment(false)}
        >
          <PaymentForm
            invoices={[invoice]}
            selected={invoice.id}
            onDone={() => setPayment(false)}
          />
        </Modal>
      )}
      {delivery && remainingLines && (
        <Modal
          title="Préparer une livraison"
          onClose={() => setDelivery(false)}
        >
          <p>
            Choisissez les quantités à livrer. Les brouillons existants sont
            déjà réservés pour éviter les doubles livraisons.
          </p>
          {remainingLines
            .filter((l) => l.remaining > 0)
            .map((l) => (
              <div key={l.id} className="delivery-quantity">
                <div>
                  <strong>{l.name}</strong>
                  <small>
                    Reste à livrer : {l.remaining} {l.unit}
                  </small>
                </div>
                <Input
                  type="number"
                  min="0"
                  max={l.remaining}
                  step="0.001"
                  value={quantities[l.id] ?? 0}
                  aria-label={"Quantité à livrer " + l.name}
                  onChange={(e) =>
                    setQuantities({
                      ...quantities,
                      [l.id]: Number(e.target.value),
                    })
                  }
                />
              </div>
            ))}
          <div className="form-actions">
            <Button variant="outline" onClick={() => setDelivery(false)}>
              Annuler
            </Button>
            <Button disabled={busy} onClick={deliver}>
              {busy ? "Création…" : "Créer le bon de livraison"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
