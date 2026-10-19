"use client";
import { useState } from "react";
import { UserCog } from "lucide-react";
import { resolveAccountConflict } from "@/server/actions";
import { toast } from "sonner";
import { Modal } from "./modal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export type ExtraAccountPanel = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
  documents: number;
  payments: number;
  activities: number;
};

const roleLabel = (role: string) =>
  role === "ADMIN"
    ? "Administrateur (hérité)"
    : role === "COMMERCIAL"
      ? "Commercial"
      : role === "COMPTABILITE"
        ? "Comptabilité"
        : role;

// Comptes hérités d'essais antérieurs : jamais supprimés automatiquement.
// L'administrateur choisit la fusion (historique réaffecté, compte retiré).
export function AccountConflictPanel({ extras }: { extras: ExtraAccountPanel[] }) {
  const [target, setTarget] = useState<ExtraAccountPanel | null>(null);
  if (extras.length === 0) return null;
  return (
    <div className="panel form-panel">
      <h2>
        <UserCog size={18} /> Comptes hérités détectés
      </h2>
      <p className="form-description">
        Cette installation contient {extras.length} compte(s)
        supplémentaire(s) hérité(s). IRONZ Gestion est désormais monoposte :
        un seul compte administrateur. Rien n’est supprimé automatiquement —
        vous décidez. La fusion rattache l’ensemble de l’historique
        (documents, paiements, journal) à votre compte avant de retirer
        l’autre accès : aucune donnée commerciale n’est perdue.
      </p>
      <div className="table-wrap responsive-table">
        <table>
          <thead>
            <tr>
              <th>COMPTE</th>
              <th>RÔLE</th>
              <th>DOCUMENTS</th>
              <th>PAIEMENTS</th>
              <th>JOURNAL</th>
              <th>CRÉÉ LE</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {extras.map((u) => (
              <tr key={u.id}>
                <td data-label="Compte">
                  <strong className="table-primary">{u.name}</strong>
                  <span className="table-secondary">{u.email}</span>
                </td>
                <td data-label="Rôle">
                  {roleLabel(u.role)} · {u.active ? "Actif" : "Désactivé"}
                </td>
                <td data-label="Documents">{u.documents}</td>
                <td data-label="Paiements">{u.payments}</td>
                <td data-label="Journal">{u.activities}</td>
                <td data-label="Créé le">{u.createdAt}</td>
                <td>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTarget(u)}
                  >
                    Fusionner dans mon compte
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {target && (
        <MergeModal extra={target} onClose={() => setTarget(null)} />
      )}
    </div>
  );
}

function MergeModal({
  extra,
  onClose,
}: {
  extra: ExtraAccountPanel;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    const result = await resolveAccountConflict(extra.id, password);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      onClose();
    } else toast.error(result.message);
  };
  return (
    <Modal title={`Fusionner ${extra.name}`} onClose={onClose}>
      <p className="form-description">
        Action définitive : les documents, paiements et entrées de journal de{" "}
        {extra.email} seront rattachés à votre compte administrateur, puis le
        compte sera supprimé et ses sessions fermées. Confirmé par votre mot
        de passe actuel.
      </p>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="merge-password">Votre mot de passe actuel</label>
          <Input
            id="merge-password"
            type="password"
            autoComplete="current-password"
            minLength={1}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={pending}>
            {pending ? "Fusion…" : "Confirmer la fusion"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
