"use client";
import { useActionState, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { login } from "@/server/actions";
import { ForgotPasswordForm } from "./forgot-password-form";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
export function LoginForm() {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  if (mode === "forgot")
    return <ForgotPasswordForm onBack={() => setMode("login")} />;
  return <LoginFields onForgot={() => setMode("forgot")} />;
}
function LoginFields({ onForgot }: { onForgot: () => void }) {
  const [state, action, pending] = useActionState(login, {
    ok: false,
    message: "",
  });
  return (
    <>
      <form action={action}>
        <div className="field">
          <label htmlFor="email">Email professionnel</label>
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
          <label htmlFor="password">Mot de passe</label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {state.message && (
          <p className="login-error" role="alert">
            {state.message}
          </p>
        )}
        <Button disabled={pending}>
          {pending ? "Connexion…" : "Se connecter"}
          <ArrowRight size={16} />
        </Button>
      </form>
      <button type="button" className="login-link" onClick={onForgot}>
        Mot de passe oublié ?
      </button>
      <div className="login-footnote">
        <LockKeyhole size={14} />
        <span>
          Accès réservé aux collaborateurs IRONZ.
          <br />
          Pour obtenir un accès, contactez votre administrateur.
        </span>
      </div>
    </>
  );
}
