"use client";
import { useActionState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { login } from "@/server/actions";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
export function LoginForm() {
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
