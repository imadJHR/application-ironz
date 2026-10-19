import Link from "next/link";
import { ShieldCheck } from "lucide-react";
export default function Forbidden() {
  return (
    <div className="error-state">
      <ShieldCheck size={35} className="muted" />
      <h1>Un accès réservé.</h1>
      <p>
        Cette page est réservée au compte administrateur de l’installation.
        IRONZ Gestion est monoposte : un seul compte, accès complet.
      </p>
      <Link href="/" className="btn btn-primary">
        Retour au tableau de bord
      </Link>
    </div>
  );
}
