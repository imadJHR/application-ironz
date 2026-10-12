"use client";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Save, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  saveClient,
  saveProduct,
  saveSettings,
  createUser,
} from "@/server/actions";
import {
  clientSchema,
  productSchema,
  settingsSchema,
  userSchema,
} from "@/server/validation";
import { Brand } from "./brand";
type Field = {
  name: string;
  label: string;
  type?: string;
  options?: string[];
  required?: boolean;
  full?: boolean;
};
const clientFields: Field[] = [
  {
    name: "type",
    label: "Type de client",
    options: ["Entreprise", "Particulier"],
  },
  { name: "name", label: "Raison sociale / Nom", required: true },
  { name: "contact", label: "Nom du contact" },
  { name: "phone", label: "Téléphone", type: "tel" },
  { name: "email", label: "Email", type: "email" },
  { name: "address", label: "Adresse", full: true },
  { name: "city", label: "Ville" },
  { name: "country", label: "Pays" },
  { name: "ice", label: "ICE" },
  { name: "taxId", label: "Identifiant fiscal (IF)" },
  { name: "rc", label: "Registre de commerce (RC)" },
  { name: "patente", label: "Taxe professionnelle (Patente)" },
  { name: "notes", label: "Notes internes", type: "textarea", full: true },
];
const productFields: Field[] = [
  { name: "reference", label: "Référence (facultative)" },
  { name: "type", label: "Type", options: ["Produit", "Service"] },
  { name: "name", label: "Désignation", required: true, full: true },
  { name: "description", label: "Description", type: "textarea", full: true },
  { name: "category", label: "Catégorie" },
  { name: "image", label: "Image (URL)", type: "url", full: true },
  {
    name: "unit",
    label: "Unité",
    options: ["unité", "pièce", "kg", "heure", "jour", "forfait", "m²", "mois"],
  },
  { name: "price", label: "Prix unitaire HT", type: "number", required: true },
  { name: "tax", label: "TVA (%)", type: "number", required: true },
];
const settingsFields: Field[] = [
  { name: "name", label: "Raison sociale", required: true },
  { name: "city", label: "Ville" },
  { name: "address", label: "Adresse", full: true },
  { name: "phone", label: "Téléphone", type: "tel" },
  { name: "email", label: "Email", type: "email" },
  { name: "website", label: "Site web" },
  { name: "ice", label: "ICE" },
  { name: "taxId", label: "Identifiant fiscal (IF)" },
  { name: "rc", label: "Registre de commerce (RC)" },
  { name: "patente", label: "Taxe professionnelle (Patente)" },
  { name: "currency", label: "Devise", options: ["MAD", "EUR", "USD"] },
  { name: "defaultTax", label: "TVA par défaut (%)", type: "number" },
  {
    name: "quoteValidity",
    label: "Validité des devis (jours)",
    type: "number",
  },
  { name: "bank", label: "Banque" },
  { name: "rib", label: "RIB" },
  { name: "iban", label: "IBAN" },
  {
    name: "paymentTerms",
    label: "Conditions de paiement",
    type: "textarea",
    full: true,
  },
  {
    name: "footer",
    label: "Pied de page des documents",
    type: "textarea",
    full: true,
  },
];
const userFields: Field[] = [
  { name: "name", label: "Nom complet", required: true },
  {
    name: "email",
    label: "Email professionnel",
    type: "email",
    required: true,
  },
  {
    name: "role",
    label: "Rôle",
    options: ["COMMERCIAL", "COMPTABILITE", "ADMIN"],
  },
  {
    name: "password",
    label: "Mot de passe initial (12 caractères minimum)",
    type: "password",
    required: true,
  },
];
export function RecordForm({
  resource,
  initial = {},
  id,
}: {
  resource: "clients" | "produits" | "parametres" | "utilisateurs";
  initial?: Record<string, unknown>;
  id?: string;
}) {
  const fields =
    resource === "clients"
      ? clientFields
      : resource === "produits"
        ? productFields
        : resource === "parametres"
          ? settingsFields
          : userFields;
  const defaults: Record<string, string> = {
    type: resource === "produits" ? "Produit" : "Entreprise",
    country: "Maroc",
    unit: "unité",
    price: "0",
    tax: "20",
    currency: "MAD",
    defaultTax: "20",
    quoteValidity: "30",
    role: "COMMERCIAL",
    logo: "",
    ...Object.fromEntries(
      Object.entries(initial).map(([key, value]) => [key, String(value ?? "")]),
    ),
  };
  const { register, handleSubmit, setValue, control } = useForm<
    Record<string, string>
  >({ defaultValues: defaults });
  const [pending, start] = useTransition(),
    [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter(),
    logo = useWatch({ control, name: "logo" });
  const submit = handleSubmit((values) => {
    const schema =
      resource === "clients"
        ? clientSchema
        : resource === "produits"
          ? productSchema
          : resource === "parametres"
            ? settingsSchema
            : userSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((e) => [e.path.join("."), e.message]),
        ),
      );
      toast.error("Vérifiez les informations saisies.");
      return;
    }
    setErrors({});
    start(async () => {
      const result =
        resource === "clients"
          ? await saveClient(values, id)
          : resource === "produits"
            ? await saveProduct(values, id)
            : resource === "parametres"
              ? await saveSettings(values)
              : await createUser(values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      if (resource !== "parametres")
        router.push(
          resource === "clients" ? "/clients/" + result.id : "/" + resource,
        );
      router.refresh();
    });
  });
  return (
    <form onSubmit={submit} className="panel form-panel">
      <h2>
        {resource === "parametres"
          ? "Profil de l’entreprise"
          : resource === "utilisateurs"
            ? "Compte employé"
            : resource === "produits"
              ? "Informations de l’article"
              : "Informations du client"}
      </h2>
      <p className="form-description">
        {resource === "parametres"
          ? "Un seul profil IRONZ. Ces informations seront utilisées dans les nouveaux documents."
          : "Les champs marqués d’un astérisque sont obligatoires."}
      </p>
      {resource === "parametres" && (
        <div className="form-section">
          <label className="field-label">Logo officiel IRONZ</label>
          <div className="logo-upload">
            {logo ? (
              <Image
                unoptimized
                width={150}
                height={50}
                className="company-logo"
                src={logo}
                alt="Logo IRONZ"
              />
            ) : (
              <Brand />
            )}
            <div>
              <label className="text-link">
                <Upload size={15} />
                Choisir un logo
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  aria-label="Choisir le logo officiel"
                  style={{ maxWidth: 190 }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 140000) {
                      toast.error("Choisissez un fichier de moins de 140 Ko.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      setValue("logo", String(reader.result));
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              <p className="form-description">PNG ou JPEG · 140 Ko maximum</p>
            </div>
          </div>
        </div>
      )}
      <div className="form-grid">
        {fields.map((f) => (
          <div key={f.name} className={"field " + (f.full ? "field-full" : "")}>
            <label htmlFor={f.name}>
              {f.label}
              {f.required ? " *" : ""}
            </label>
            {f.options ? (
              <select id={f.name} {...register(f.name)}>
                {f.options.map((v) => (
                  <option key={v} value={v}>
                    {v === "ADMIN"
                      ? "Administrateur"
                      : v === "COMMERCIAL"
                        ? "Commercial"
                        : v === "COMPTABILITE"
                          ? "Comptabilité"
                          : v}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea id={f.name} {...register(f.name)} rows={3} />
            ) : (
              <Input
                id={f.name}
                type={f.type || "text"}
                required={f.required}
                min={f.type === "number" ? 0 : undefined}
                step={f.type === "number" ? "0.01" : undefined}
                autoComplete={
                  f.type === "password" ? "new-password" : undefined
                }
                {...register(f.name)}
              />
            )}{" "}
            {errors[f.name] && (
              <span className="field-error" role="alert">
                {errors[f.name]}
              </span>
            )}
          </div>
        ))}
      </div>
      {resource === "utilisateurs" && (
        <p className="form-description">
          Commercial : clients, catalogue et documents de vente. Comptabilité :
          factures et paiements. Administrateur : accès complet.
        </p>
      )}
      <div className="form-actions">
        <Button asChild variant="outline">
          <Link href={resource === "parametres" ? "/" : "/" + resource}>
            Annuler
          </Link>
        </Button>
        <Button disabled={pending}>
          <Save size={16} />
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
