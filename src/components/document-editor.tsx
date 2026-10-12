"use client";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Save,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  documentSchema,
  calculate,
  moduleFor,
  type DocumentInput,
  type Kind,
} from "@/lib/business";
import { money } from "@/lib/utils";
import { saveDocument } from "@/server/actions";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
type ProductOption = {
  id: string;
  reference: string | null;
  type: string;
  name: string;
  description: string;
  unit: string;
  price: string;
  tax: string;
};
type FormInput = z.input<typeof documentSchema>;
export function DocumentEditor({
  kind,
  clients,
  products,
  company,
  initial,
  id,
  version,
  clientId,
}: {
  kind: Kind;
  clients: { id: string; name: string }[];
  products: ProductOption[];
  company: {
    currency: string;
    defaultTax: string;
    quoteValidity: number;
    paymentTerms: string;
  };
  initial?: DocumentInput;
  id?: string;
  version?: number;
  clientId?: string;
}) {
  const router = useRouter(),
    [pending, start] = useTransition(),
    [query, setQuery] = useState("");
  const blank = {
    reference: "",
    name: "",
    description: "",
    unit: "unité",
    quantity: 1,
    unitPrice: 0,
    discountRate: 0,
    taxRate: Number(company.defaultTax),
  };
  const [dates] = useState(() => {
    const now = new Date();
    return {
      today: now.toISOString().slice(0, 10),
      due: new Date(
        now.getTime() +
          (kind === "QUOTE" ? company.quoteValidity : 30) * 86400000,
      )
        .toISOString()
        .slice(0, 10),
    };
  });
  const { today, due } = dates;
  const emptyValues = {
    kind,
    clientId: clientId || "",
    date: today,
    dueDate: kind === "QUOTE" || kind === "INVOICE" ? due : "",
    notes: "",
    terms: company.paymentTerms,
    leadTime: "",
    deliveryAddress: "",
    items: [blank],
  };
  const draftKey = "ironz-draft-" + kind + "-" + (id || "new");
  const [restored] = useState<FormInput | null>(() => {
    // La clé contient l'id : un brouillon existant et un nouveau
    // ne se mélangent jamais. Les modifications non enregistrées
    // (plus récentes que la base) gagnent à la réouverture.
    if (typeof window === "undefined") return null;
    try {
      const parsed: unknown = JSON.parse(
        window.localStorage.getItem(draftKey) || "null",
      );
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray((parsed as { items?: unknown }).items) &&
        (parsed as { items: unknown[] }).items.length > 0
      )
        return parsed as FormInput;
    } catch {
      /* stockage local indisponible */
    }
    return null;
  });
  const [draftReady, setDraftReady] = useState(() => restored !== null);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, DocumentInput>({
    resolver: zodResolver(documentSchema),
    defaultValues: restored || initial || emptyValues,
  });
  const { fields, append, remove, move, insert, update } = useFieldArray({
      control,
      name: "items",
    }),
    watched = useWatch({ control, name: "items" }) || [];
  const totals = calculate(
    watched.map((i) => ({
      quantity: Number(i.quantity) || 0,
      unitPrice: Number(i.unitPrice) || 0,
      discountRate: Number(i.discountRate) || 0,
      taxRate: Number(i.taxRate) || 0,
    })),
  );
  const allValues = useWatch({ control }) as unknown as {
    items?: unknown[];
  } | null;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (restored) toast.info("Brouillon local restauré.");
  }, [restored]);
  useEffect(() => {
    // Nouveaux brouillons comme modifications : tout changement
    // est auto-sauvegardé localement 600ms après la frappe.
    if (!allValues || !allValues.items?.length) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(allValues));
        setDraftReady(true);
      } catch {
        setDraftReady((current) => current);
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [allValues, draftKey]);
  const discardDraft = () => {
    window.localStorage.removeItem(draftKey);
    reset(initial || emptyValues);
    setDraftReady(false);
    toast.info("Brouillon local effacé.");
  };
  const submit = handleSubmit(
    (values) =>
      start(async () => {
        const result = await saveDocument(values, id, version);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        window.localStorage.removeItem(draftKey);
        toast.success(result.message);
        router.push("/" + moduleFor(kind) + "/" + result.id);
        router.refresh();
      }),
    () => toast.error("Vérifiez le client et les lignes du document."),
  );
  const addProduct = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const item = {
      ...blank,
      productId: product.id,
      reference: product.reference || "",
      name: product.name,
      description: product.description,
      unit: product.unit,
      unitPrice: Number(product.price),
      taxRate: Number(product.tax),
    };
    const emptyIndex = watched.findIndex(
      (line) =>
        !line.name?.trim() &&
        !line.reference &&
        !line.description &&
        !Number(line.unitPrice),
    );
    if (emptyIndex >= 0) update(emptyIndex, item);
    else append(item);
  };
  const filtered = products.filter((p) =>
    (p.name + " " + (p.reference || ""))
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <form onSubmit={submit}>
      <div className="editor-layout">
        <div className="panel form-panel">
          <div className="form-section">
            <h2>01 · Client & document</h2>
            <div className="form-grid">
              <div className="field field-full">
                <label htmlFor="clientId">Client *</label>
                <select id="clientId" {...register("clientId")}>
                  <option value="">Sélectionner un client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.clientId && (
                  <span className="field-error">{errors.clientId.message}</span>
                )}
                {!clients.length && (
                  <Link className="text-link" href="/clients/nouveau">
                    Ajouter votre premier client
                  </Link>
                )}
              </div>
              <div className="field">
                <label htmlFor="date">Date du document</label>
                <Input id="date" type="date" {...register("date")} />
                {errors.date && (
                  <span className="field-error">{errors.date.message}</span>
                )}
              </div>
              <div className="field">
                <label htmlFor="dueDate">
                  {kind === "QUOTE" ? "Valable jusqu’au" : "Date d’échéance"}
                </label>
                <Input id="dueDate" type="date" {...register("dueDate")} />
                {errors.dueDate && (
                  <span className="field-error">{errors.dueDate.message}</span>
                )}
              </div>
            </div>
          </div>
          <div className="form-section">
            <h2>02 · Articles & prestations</h2>
            <div className="catalog-select">
              <Search size={16} className="muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom ou référence du catalogue…"
                aria-label="Rechercher dans le catalogue"
              />
              <select
                aria-label="Ajouter un article du catalogue"
                value=""
                onChange={(e) => addProduct(e.target.value)}
              >
                <option value="">Ajouter depuis le catalogue</option>
                {(["Produit", "Service"] as const).map(
                  (t) =>
                    filtered.some((p) => (p.type || "Produit") === t) && (
                      <optgroup
                        key={t}
                        label={t === "Service" ? "Services" : "Produits"}
                      >
                        {filtered
                          .filter((p) => (p.type || "Produit") === t)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.reference ? p.reference + " · " : ""}
                              {p.name}
                            </option>
                          ))}
                      </optgroup>
                    ),
                )}
              </select>
            </div>
            <div className="editor-lines">
              <table>
                <thead>
                  <tr>
                    <th>DÉSIGNATION</th>
                    <th>QTÉ</th>
                    <th>UNITÉ</th>
                    {kind !== "DELIVERY" && (
                      <>
                        <th>PRIX HT</th>
                        <th>REMISE %</th>
                        <th>TVA %</th>
                        <th className="align-right">TOTAL HT</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, n) => (
                    <tr key={field.id}>
                      <td
                        className="item-name"
                        data-label="Article / prestation"
                      >
                        <Input
                          aria-label={"Désignation ligne " + (n + 1)}
                          placeholder="Désignation *"
                          {...register(`items.${n}.name`)}
                        />
                        {errors.items?.[n]?.name && (
                          <span className="field-error">
                            {errors.items[n]?.name?.message}
                          </span>
                        )}
                        <Input
                          aria-label={"Référence ligne " + (n + 1)}
                          placeholder="Référence"
                          style={{ marginTop: 5 }}
                          {...register(`items.${n}.reference`)}
                        />
                        <textarea
                          aria-label={"Description ligne " + (n + 1)}
                          placeholder="Description complémentaire…"
                          {...register(`items.${n}.description`)}
                        />
                        <div className="line-tools">
                          <button
                            type="button"
                            aria-label={"Supprimer la ligne " + (n + 1)}
                            disabled={fields.length <= 1}
                            onClick={() => remove(n)}
                          >
                            <Trash2 size={13} />
                          </button>
                          <button
                            type="button"
                            aria-label={"Dupliquer la ligne " + (n + 1)}
                            onClick={() => insert(n + 1, { ...watched[n] })}
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
                            aria-label="Monter la ligne"
                            disabled={n === 0}
                            onClick={() => move(n, n - 1)}
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            aria-label="Descendre la ligne"
                            disabled={n === fields.length - 1}
                            onClick={() => move(n, n + 1)}
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>
                      </td>
                      <td data-label="Quantité">
                        <Input
                          type="number"
                          step="0.001"
                          min="0.001"
                          className="num-input"
                          aria-label={"Quantité ligne " + (n + 1)}
                          {...register(`items.${n}.quantity`, {
                            valueAsNumber: true,
                          })}
                        />
                        {errors.items?.[n]?.quantity && (
                          <span className="field-error">Quantité invalide</span>
                        )}
                      </td>
                      <td data-label="Unité">
                        <Input
                          className="num-input"
                          aria-label={"Unité ligne " + (n + 1)}
                          {...register(`items.${n}.unit`)}
                        />
                      </td>
                      {kind !== "DELIVERY" && (
                        <>
                          <td data-label="Prix unitaire HT">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="price-input"
                              aria-label={"Prix HT ligne " + (n + 1)}
                              {...register(`items.${n}.unitPrice`, {
                                valueAsNumber: true,
                              })}
                            />
                          </td>
                          <td data-label="Remise (%)">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              className="num-input"
                              aria-label={"Remise ligne " + (n + 1)}
                              {...register(`items.${n}.discountRate`, {
                                valueAsNumber: true,
                              })}
                            />
                          </td>
                          <td data-label="TVA (%)">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              className="num-input"
                              aria-label={"TVA ligne " + (n + 1)}
                              {...register(`items.${n}.taxRate`, {
                                valueAsNumber: true,
                              })}
                            />
                          </td>
                          <td
                            className="align-right"
                            style={{ whiteSpace: "nowrap", paddingTop: 18 }}
                          >
                            {money(
                              totals.lines[n]?.totalHT || 0,
                              company.currency,
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append(blank)}
              style={{ marginTop: 15 }}
            >
              <Plus size={14} />
              Ajouter une ligne libre
            </Button>
          </div>
          <div className="form-section">
            <h2>03 · Conditions & informations</h2>
            <div className="form-grid">
              <div className="field field-full">
                <label htmlFor="terms">
                  Conditions / modalités de paiement
                </label>
                <textarea id="terms" {...register("terms")} rows={3} />
              </div>
              <div className="field">
                <label htmlFor="leadTime">
                  Délai de réalisation / livraison
                </label>
                <Input id="leadTime" {...register("leadTime")} />
              </div>
              <div className="field">
                <label htmlFor="deliveryAddress">Adresse de livraison</label>
                <Input id="deliveryAddress" {...register("deliveryAddress")} />
              </div>
              <div className="field field-full">
                <label htmlFor="notes">Notes du document</label>
                <textarea id="notes" {...register("notes")} rows={3} />
              </div>
            </div>
          </div>
        </div>
        <aside className="editor-sidebar">
          <div className="panel totals-card">
            <h2>{kind === "DELIVERY" ? "Votre livraison" : "Récapitulatif"}</h2>
            {kind === "DELIVERY" ? (
              <div className="totals-row">
                <span>Quantité totale</span>
                <strong>
                  {watched.reduce((s, i) => s + (Number(i.quantity) || 0), 0)}
                </strong>
              </div>
            ) : (
              <>
                {[
                  ["Sous-total", totals.subtotal],
                  ["Remise", totals.discount],
                  ["Total HT", totals.totalHT],
                  ["TVA", totals.totalTax],
                ].map(([label, value]) => (
                  <div className="totals-row" key={label}>
                    <span>{label}</span>
                    <strong>{money(value, company.currency)}</strong>
                  </div>
                ))}
                <div className="totals-row totals-grand">
                  <span>Total TTC</span>
                  <strong>{money(totals.totalTTC, company.currency)}</strong>
                </div>
              </>
            )}
            <Button disabled={pending} style={{ width: "100%", marginTop: 20 }}>
              <Save size={15} />
              {pending ? "Enregistrement…" : "Enregistrer le brouillon"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              asChild
              style={{ width: "100%", marginTop: 8 }}
            >
              <Link href={"/" + moduleFor(kind)}>Annuler</Link>
            </Button>
            {draftReady && (
              <Button
                type="button"
                variant="ghost"
                style={{ width: "100%", marginTop: 8 }}
                onClick={discardDraft}
              >
                <Trash2 size={15} />
                Jeter le brouillon local
              </Button>
            )}
          </div>
          <div className="editor-note">
            <ShieldCheck size={15} />
            <span>
              Le numéro sera attribué automatiquement à l’enregistrement. Les
              prix et informations seront conservés dans le document.
            </span>
          </div>
        </aside>
      </div>
    </form>
  );
}
