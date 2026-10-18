"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { configureFirstAdmin } from "@/server/actions";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
export function FirstRunForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(configureFirstAdmin, {
    ok: false,
    message: "",
  });
  useEffect(() => {
    if (state.ok) router.replace("/connexion");
  }, [state.ok, router]);
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
