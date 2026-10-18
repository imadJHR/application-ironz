import { redirect } from "next/navigation";
import { db, isPreview, isDesktopDb } from "@/server/db";
import { FirstRunForm } from "@/components/first-run-form";
import { Brand } from "@/components/brand";
import { ShieldCheck, Building2, UserCog } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function FirstRunSetup() {
  if (isPreview()) {
    // Aperçu web (mode développement) : page affichée sans base.
  } else if (!isDesktopDb()) {
    // Version web (Atlas) : la configuration initiale n'existe pas ici.
    redirect("/connexion");
  } else {
    const admins = await db.user.count({ where: { role: "ADMIN" } });
    if (admins > 0) redirect("/connexion");
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand light />
        <h1>
          Bienvenue sur
          <br />
          <span>IRONZ Gestion.</span>
        </h1>
        <p>
          Configurez votre espace une seule fois : votre entreprise, votre
          compte administrateur, puis chaque collaborateur.
        </p>
        <footer>
          <ShieldCheck size={15} />
          Installation locale · 100 % hors ligne · Données sur ce poste
        </footer>
      </section>
      <section className="login-content">
        <div className="login-form">
          <div className="eyebrow">
            <Building2 size={14} /> CONFIGURATION INITIALE
          </div>
          <h2>Préparons votre espace.</h2>
          <p>
            Ce formulaire n’apparaît qu’une seule fois. Il crée le profil de
            votre entreprise et votre compte administrateur.
          </p>
          <FirstRunForm />
          <div className="login-footnote">
            <UserCog size={14} />
            <span>
              Mot de passe : 12 caractères minimum. Il est stocké chiffré
              (scrypt) et jamais en clair dans la base.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
