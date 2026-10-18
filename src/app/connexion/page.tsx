import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { db, isPreview, isDesktopDb } from "@/server/db";
export const dynamic = "force-dynamic";
export default async function Login() {
  // Desktop : si aucun administrateur n'existe encore (installation fraîche),
  // la connexion n'a aucun sens -> Afficher directement la configuration
  // initiale. redirect() lève une exception : il doit rester hors du try.
  if (!isPreview() && isDesktopDb()) {
    let emptyAdmins = false;
    try {
      emptyAdmins = (await db.user.count({ where: { role: "ADMIN" } })) === 0;
    } catch {
      // Base indisponible : afficher la connexion normale.
    }
    if (emptyAdmins) redirect("/premiere-installation");
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand light />
        <h1>
          Votre activité.
          <br />
          Vos équipes.
          <br />
          <span>Une seule vision.</span>
        </h1>
        <p>
          Du devis au paiement, chaque étape de votre gestion commerciale prend
          sa place.
        </p>
        <footer>
          <ShieldCheck size={15} />
          L’espace de travail privé d’IRONZ
        </footer>
      </section>
      <section className="login-content">
        <div className="login-form">
          <div className="eyebrow">BIENVENUE CHEZ IRONZ</div>
          <h2>Reprenons le fil.</h2>
          <p>Connectez-vous à votre espace de gestion commerciale.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
