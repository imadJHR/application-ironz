"use client";
import { useState } from "react";
import { RefreshCw, Download, CheckCircle2, Info } from "lucide-react";
import { checkUpdates } from "@/server/update-check";
import type { UpdateInfo } from "@/server/updates";
import { Button } from "./ui/button";

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Section Mises à jour : consultation volontaire (aucune vérification
// réseau au chargement). Aucune installation automatique : le bouton
// ouvre le lien officiel du téléchargement dans le navigateur.
export function UpdatePanel({ appVersion }: { appVersion: string }) {
  const [state, setState] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);

  async function runCheck() {
    setChecking(true);
    setState(null);
    try {
      setState(await checkUpdates());
    } catch {
      setState({
        status: "offline",
        currentVersion: appVersion,
        message: "Connexion Internet indisponible.",
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="panel form-panel">
      <h2>
        <RefreshCw size={18} /> Mises à jour
      </h2>
      <p className="form-description">
        Version installée&nbsp;: <strong>{appVersion}</strong>. La vérification
        est manuelle : aucune donnée de votre poste n&rsquo;est transmise et
        l&rsquo;application reste pleinement fonctionnelle hors ligne.
      </p>
      <div className="form-actions">
        <Button type="button" variant="outline" disabled={checking} onClick={runCheck}>
          <RefreshCw size={16} />
          {checking ? "Vérification…" : "Rechercher des mises à jour"}
        </Button>
      </div>
      {state?.status === "current" && (
        <p className="form-description">
          <CheckCircle2 size={15} style={{ marginRight: 4 }} />
          Vous utilisez la version la plus récente ({state.currentVersion}).
        </p>
      )}
      {state?.status === "offline" && (
        <p className="form-description">
          <Info size={15} style={{ marginRight: 4 }} />
          {state.message} Vous pouvez vérifier la connexion, puis relancer la
          recherche — l&rsquo;application continue de fonctionner hors ligne.
        </p>
      )}
      {state?.status === "error" && (
        <p className="form-description">
          <Info size={15} style={{ marginRight: 4 }} />
          {state.message}
        </p>
      )}
      {state?.status === "available" && (
        <div className="form-section">
          <p className="form-description">
            <strong>Nouvelle version {state.latestVersion}</strong>
            {state.publishedAt ? ` (${formatDate(state.publishedAt)})` : ""}.
            Votre version installée&nbsp;: {state.currentVersion}.
          </p>
          {state.notes && (
            <pre className="mises-a-jour-notes">{state.notes}</pre>
          )}
          <div className="form-actions">
            <a
              className="btn btn-primary"
              href={state.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download size={16} />
              Télécharger la mise à jour
            </a>
            {state.pageUrl !== state.downloadUrl && (
              <a
                className="btn btn-outline"
                href={state.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Voir les notes de version
              </a>
            )}
          </div>
          <p className="form-description">
            Le téléchargement s&rsquo;ouvre dans votre navigateur (site
            officiel GitHub). L&rsquo;application n&rsquo;exécute jamais un
            installateur elle-même&nbsp;: lancez-le quand vous le souhaitez
            (vos données sont conservées).
          </p>
        </div>
      )}
    </div>
  );
}
