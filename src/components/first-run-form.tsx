"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";
import { configureFirstAdmin } from "@/server/actions";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
export function FirstRunForm() {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [state, action, pending] = useActionState(configureFirstAdmin, {
    ok: false,
    message: "",
  });
  // Affichage unique du code de récupération : après la configuration,
  // l'utilisateur doit le noter avant de rejoindre la page de connexion.
  if (state.ok && state.recoveryCode && !saved) {
    return (
      <div className="recovery-once">
        <h3>
          <KeyRound size={16} /> Code de récupération
        </h3>
        <p className="form-description">
          Notez ce code dans un endroit sûr (papier, gestionnaire de mots de
          passe). Il vous permettra de retrouver l’accès à ce compte si vous
          oubliez votre mot de passe. Il s’affiche{" "}
          <strong>une seule fois</strong> et il n’est jamais conservé
          ailleurs : seule une copie chiffrée (hash) est enregistrée.
        </p>
        <div className="recovery-code-display" data-testid="recovery-code">
          {state.recoveryCode}
        </div>
        <p className="form-description">
          Sans ce code, un mot de passe oublié ne peut pas être réinitialisé.
        </p>
        <Button type="button" onClick={() => setSaved(true)}>
          J’ai sauvegardé mon code
        </Button>
      </div>
    );
  }
  if (state.ok)
    return (
      <>
        <p className="login-error" role="status">
          {state.message}
        </p>
        <Button type="button" onClick={() => router.replace("/connexion")}>
          Aller à la connexion <ArrowRight size={16} />
        </Button>
      </>
    );
  return (
    <>
      <form action={action}>
        <div className="field">
          <label htmlFor="company">Nom de l’entreprise</label>
          <Input
            id="company"
            name="company"
            autoComplete="organization"
            placeholder="IRONZ"
            required
            minLength={2}
            maxLength={120}
          />
        </div>
        <div className="field">
          <label htmlFor="adminName">Nom de l’administrateur</label>
          <Input
            id="adminName"
            name="adminName"
            autoComplete="name"
            placeholder="Prénom Nom"
            required
            minLength={2}
            maxLength={100}
          />
        </div>
        <div className="field">
          <label htmlFor="email">Adresse email administrateur</label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="vous@ironz.ma"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Mot de passe · 12 caractères minimum</label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">Confirmer le mot de passe</label>
          <Input
            id="confirm-password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </div>
        {state.message && (
          <p className="login-error" role="alert">
            {state.message}
          </p>
        )}
        <Button disabled={pending}>
          {pending ? "Configuration…" : "Configurer IRONZ Gestion"}
          {!pending && <ArrowRight size={16} />}
        </Button>
      </form>
    </>
  );
}
