"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HardDriveDownload, DatabaseBackup, AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";
import { Modal } from "./modal";

export function BackupRestorePanel({ lastBackup }: { lastBackup: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  async function downloadBackup() {
    setBusy(true);
    try {
      const res = await fetch("/api/system/backup?create=1");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "La sauvegarde a échoué.");
        return;
      }
      const blob = await res.blob();
      const name =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ||
        "ironz-sauvegarde.db";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Sauvegarde créée et téléchargée.", {
        description: "Une copie est aussi conservée dans le dossier de données.",
      });
      router.refresh();
    } catch {
      toast.error("La sauvegarde a échoué.");
    } finally {
      setBusy(false);
    }
  }

  function chooseRestore() {
    const file = fileRef.current?.files?.[0] || null;
    if (!file) {
      toast.error("Choisissez d’abord un fichier de sauvegarde (.db).");
      return;
    }
    setPendingFile(file);
  }

  async function confirmRestore() {
    const file = pendingFile;
    if (!file) return;
    setPendingFile(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/system/restore", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || "La restauration a échoué.");
        return;
      }
      toast.success(data.message || "Restauration réussie.");
      // Les sessions vivaient dans l'ancienne base : retour à la connexion.
      router.push("/connexion");
      router.refresh();
    } catch {
      toast.error("La restauration a échoué.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="panel form-panel">
      <h2>Sauvegarde et restauration</h2>
      <p className="form-description">
        La sauvegarde est un fichier SQLite complet de vos données. Une copie reste dans le
        dossier «&nbsp;sauvegardes&nbsp;» du dossier de données, le téléchargement vous permet de
        la garder hors du poste (clé USB, disque externe).
      </p>
      {lastBackup && (
        <p className="form-description">
          Dernière sauvegarde du poste&nbsp;: <strong>{lastBackup}</strong>
        </p>
      )}
      <div className="form-actions">
        <Button type="button" variant="outline" disabled={busy} onClick={downloadBackup}>
          <DatabaseBackup size={16} />
          {busy ? "Sauvegarde…" : "Sauvegarder mes données"}
        </Button>
      </div>
      <div className="form-section">
        <label className="field-label">Restaurer une sauvegarde</label>
        <p className="form-description">
          Communique avec le compte actif&nbsp;: les données actuelles deviennent la sauvegarde
          de sécurité datée, la sauvegarde choisie vient à leur place.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".db"
          aria-label="Fichier de sauvegarde (.db)"
          className="input"
        />
        <div className="form-actions">
          <Button type="button" variant="outline" disabled={busy} onClick={chooseRestore}>
            <HardDriveDownload size={16} />
            {busy ? "Restauration…" : "Restaurer…"}
          </Button>
        </div>
      </div>
      {pendingFile && (
        <Modal
          title="Confirmer la restauration"
          onClose={() => {
            setPendingFile(null);
            if (fileRef.current) fileRef.current.value = "";
          }}
        >
          <div className="modal-body">
            <p className="form-description" style={{ display: "flex", gap: 8 }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>
                La sauvegarde choisie <strong>{pendingFile.name}</strong> remplacera les données
                actuelles. Les données présentes à cet instant seront conservées sous la forme
                d’une sauvegarde datée. Les comptes seront déconnectés&nbsp;: reconnectez-vous
                avec les identifiants présents dans la sauvegarde.
              </span>
            </p>
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPendingFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                Annuler
              </Button>
              <Button type="button" onClick={confirmRestore}>
                Restaurer cette sauvegarde
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
