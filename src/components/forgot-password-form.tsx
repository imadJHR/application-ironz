"use client";
import { useActionState } from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { recoverAccount } from "@/server/actions";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(recoverAccount, {
    ok: false,
    message: "",
  });
  if (state.ok && state.recoveryCode) {
    return (
      <div className="recovery-once">
        <h3>Nouveau code de récupération</h3>
        <p className="form-description">
          Votre mot de passe a été mis à jour. Notez ce code dans un endroit
          sûr (papier, gestionnaire de mots de passe) : il remplace l’ancien
          code et il s’affiche <strong>une seule fois</strong>.
        </p>
        <div className="recovery-code-display" data-testid="recovery-code">
          {state.recoveryCode}
        </div>
        <p className="form-description">
          Il vous servira à retrouver l’accès si vous oubliez à nouveau votre
          mot de passe. Les autres sessions de votre compte ont été fermées.
        </p>
        <Button type="button" onClick={onBack}>
          Retour à la connexion
        </Button>
      </div>
    );
  }
  return (
    <>
      <form action={action}>
        <div className="field">
          <label htmlFor="recovery-email">Email du compte administrateur</label>
          <Input
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="recovery-code">Code de récupération</label>
          <Input
            id="recovery-code"
            name="code"
            autoComplete="off"
            placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="recovery-password">
            Nouveau mot de passe · 12 caractères minimum
          </label>
          <Input
            id="recovery-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </div>
        <div className="field">
          <label htmlFor="recovery-confirm">Confirmer le nouveau mot de passe</label>
          <Input
            id="recovery-confirm"
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
          {pending ? "Vérification…" : "Récupérer l’accès"}
        </Button>
      </form>
      <button type="button" className="login-link" onClick={onBack}>
        <ArrowLeft size={13} /> Retour à la connexion
      </button>
      <div className="login-footnote">
        <AlertTriangle size={14} />
        <span>
          La récupération exige le code affiché lors de la configuration
          initiale. Sans code valide, aucune réinitialisation n’est possible.
          Un code erroné 5 fois se bloque définitivement.
        </span>
      </div>
    </>
  );
}
