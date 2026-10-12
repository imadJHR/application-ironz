"use client";
import { Trash2 } from "lucide-react";
import { deleteChain } from "@/server/actions";
import { ActionButton } from "./action-button";
export function DeleteChainButton({
  id,
  number,
}: {
  id: string;
  number: string;
}) {
  return (
    <ActionButton
      size="icon"
      variant="ghost"
      ariaLabel={"Supprimer la chaîne de " + number}
      action={deleteChain.bind(null, id)}
      confirmationTitle="Supprimer toute la chaîne ?"
      confirmation={
        "Suppression définitive de " +
        number +
        " et de TOUS les documents liés (devis, commandes, livraisons, factures, paiements). Réservé aux chaînes en brouillon sans paiement. Irréversible."
      }
      confirmLabel="Supprimer définitivement"
      destructiveConfirmation
    >
      <Trash2 size={16} aria-hidden="true" />
    </ActionButton>
  );
}
