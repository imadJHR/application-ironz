import Link from "next/link";
export default function NotFound() {
  return (
    <div className="error-state">
      <div className="eyebrow">IRONZ · 404</div>
      <h1>Cette page est introuvable.</h1>
      <p>Le document n’existe pas ou son adresse a changé.</p>
      <Link href="/" className="btn btn-primary">
        Retour au tableau de bord
      </Link>
    </div>
  );
}
