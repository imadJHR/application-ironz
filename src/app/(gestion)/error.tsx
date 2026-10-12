"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="error-state">
      <h1>Une interruption momentanée.</h1>
      <p>
        Impossible de charger vos données. Vérifiez la connexion à MongoDB Atlas ou
        contactez votre administrateur.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  );
}
