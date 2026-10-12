import Link from "next/link";
import { ShieldCheck } from "lucide-react";
export default function Forbidden() {
  return (
    <div className="error-state">
      <ShieldCheck size={35} className="muted" />
      <h1>Un accès réservé.</h1>
      <p>
        Votre rôle ne permet pas d’accéder à cette page. Contactez un
        administrateur IRONZ si vous avez besoin d’une autorisation.
      </p>
      <Link href="/" className="btn btn-primary">
        Retour au tableau de bord
      </Link>
    </div>
  );
}
