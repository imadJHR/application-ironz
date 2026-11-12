"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Download, CheckCircle2, Info } from "lucide-react";
import { checkUpdates } from "@/server/update-check";
import type { UpdateInfo } from "@/server/updates";
import { Button } from "./ui/button";

type DesktopResult = { ok: true } | { ok: false; message: string };

declare global {
  interface Window {
    ironzUpdates?: {
      download: (version: string) => Promise<DesktopResult>;
      install: (
        version: string,
      ) => Promise<DesktopResult & { started?: boolean }>;
      onProgress: (listener: (percent: number) => void) => () => void;
    };
  }
}

type Transfer =
  | { status: "idle"; message?: string }
  | { status: "downloading"; percent: number }
  | { status: "ready" }
  | { status: "installing" };

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

export function UpdatePanel({ appVersion }: { appVersion: string }) {
  const [state, setState] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [transfer, setTransfer] = useState<Transfer>({ status: "idle" });
  const desktop =
    typeof window === "undefined" ? undefined : window.ironzUpdates;
  const busy =
    transfer.status === "downloading" || transfer.status === "installing";

  useEffect(() => {
    return desktop?.onProgress((percent) => {
      setTransfer((current) =>
        current.status === "downloading"
          ? { status: "downloading", percent }
          : current,
      );
    });
  }, [desktop]);

  async function runCheck() {
    setChecking(true);
    setState(null);
    setTransfer({ status: "idle" });
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

  async function download(version: string) {
    if (!desktop) return;
    setTransfer({ status: "downloading", percent: 0 });
    try {
      const result = await desktop.download(version);
      setTransfer(
        result.ok
          ? { status: "ready" }
          : { status: "idle", message: result.message },
      );
    } catch {
      setTransfer({
        status: "idle",
        message: "Le téléchargement a été interrompu. Réessayez.",
      });
    }
  }

  async function install(version: string) {
    if (!desktop) return;
    setTransfer({ status: "installing" });
    try {
      const result = await desktop.install(version);
      if (!result.ok) setTransfer({ status: "idle", message: result.message });
      else if (!result.started) setTransfer({ status: "ready" });
    } catch {
      setTransfer({
        status: "idle",
        message: "Impossible de lancer l’installation. Réessayez.",
      });
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
        <Button
          type="button"
          variant="outline"
          disabled={checking || busy}
          onClick={runCheck}
        >
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
            {desktop ? (
              transfer.status === "ready" ||
              transfer.status === "installing" ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => install(state.latestVersion)}
                >
                  {busy ? "Installation…" : "Installer et redémarrer"}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => download(state.latestVersion)}
                >
                  <Download size={16} />
                  {busy ? "Téléchargement…" : "Mettre à jour"}
                </Button>
              )
            ) : (
              <a
                className="btn btn-primary"
                href={state.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download size={16} />
                Télécharger la mise à jour
              </a>
            )}
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
          {transfer.status === "downloading" && (
            <div className="form-description" role="status">
              Téléchargement {transfer.percent} %
              <progress
                aria-label="Progression du téléchargement"
                className="w-full"
                max={100}
                value={transfer.percent}
              />
            </div>
          )}
          {transfer.status === "idle" && transfer.message && (
            <p className="form-description" role="alert">
              {transfer.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
