"use client";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { toast } from "sonner";
import { registerPayment } from "@/server/actions";
import { paymentSchema } from "@/server/validation";
import { money } from "@/lib/utils";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
export type InvoiceOption = {
  id: string;
  number: string;
  client: string;
  remaining: number;
  currency: string;
};
export function PaymentForm({
  invoices,
  selected,
  onDone,
}: {
  invoices: InvoiceOption[];
  selected?: string;
  onDone?: () => void;
}) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      idempotencyKey,
      invoiceId: selected || "",
      date: new Date().toISOString().slice(0, 10),
      amount: "",
      method: "Virement",
      reference: "",
      notes: "",
    },
  });
  const [pending, start] = useTransition(),
    router = useRouter(),
    selectedId = useWatch({ control, name: "invoiceId" }),
    invoice = invoices.find((i) => i.id === selectedId);
  const submit = handleSubmit((values) => {
    const parsed = paymentSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    start(async () => {
      const result = await registerPayment(values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onDone?.();
      router.refresh();
      if (!onDone) router.push("/factures/" + values.invoiceId);
    });
  });
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field field-full">
          <label htmlFor="invoiceId">Facture *</label>
          <select id="invoiceId" {...register("invoiceId")} required>
            <option value="">Sélectionnez une facture émise</option>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.number} · {i.client}
              </option>
            ))}
          </select>
        </div>
        {invoice && (
          <div className="info-banner field-full" style={{ margin: 0 }}>
            Reste à encaisser :{" "}
            <strong>{money(invoice.remaining, invoice.currency)}</strong>
          </div>
        )}
        <div className="field">
          <label htmlFor="payment-date">Date du paiement</label>
          <Input
            id="payment-date"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            {...register("date")}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="amount">Montant {invoice?.currency || "MAD"} *</label>
          <Input
            id="amount"
            type="number"
            min="0.01"
            step="0.01"
            max={invoice?.remaining}
            placeholder={invoice ? String(invoice.remaining) : "0.00"}
            {...register("amount")}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="method">Moyen de paiement</label>
          <select id="method" {...register("method")}>
            {["Espèces", "Virement", "Chèque", "Carte", "Autre"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="reference">Référence</label>
          <Input id="reference" {...register("reference")} />
        </div>
        <div className="field field-full">
          <label htmlFor="payment-notes">Notes</label>
          <textarea id="payment-notes" {...register("notes")} rows={3} />
        </div>
      </div>
      <div className="form-actions">
        {onDone && (
          <Button type="button" variant="outline" onClick={onDone}>
            Annuler
          </Button>
        )}
        <Button disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer le paiement"}
        </Button>
      </div>
    </form>
  );
}
