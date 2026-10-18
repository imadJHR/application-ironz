"use client";
import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
import { regenerateRecoveryCode } from "@/server/actions";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Modal } from "./modal";

export function RecoveryCodePanel({
  hasCode,
  consumed,
  createdAt,
}: {
  hasCode: boolean;
  consumed: boolean;
  createdAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel form-panel">
      <h2>Code de récupération</h2>
      <p className="form-description">
        Le code de récupération permet de retrouver l’accès à ce compte
        administrateur en cas de mot de passe oublié, entièrement hors ligne.
        {createdAt && !consumed && (
          <>
            {" "}
            Un code est actif depuis le{" "}
            <strong>
              {createdAt.slice(8, 10)}/{createdAt.slice(5, 7)}/
              {createdAt.slice(0, 4)}
            </strong>
            .
          </>
        )}
        {consumed && (
          <>
            {" "}
            Le code a été utilisé : il a été remplacé par un nouveau code lors
            de la récupération.
          </>
        )}
      </p>
      <p className="form-description">
        Il s’affiche une seule fois lors de sa création ; seul un hash est
        conservé sur le poste. La régénération invalide l’ancien code et
        exige votre mot de passe actuel.
      </p>
      <div className="form-actions">
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <KeyRound size={16} />
          {hasCode ? "Régénérer mon code de récupération" : "Créer mon code de récupération"}
        </Button>
      </div>
      {open && (
        <RegenerateModal onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

function RegenerateModal({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(regenerateRecoveryCode, {
    ok: false,
    message: "",
  });
  if (state.ok && state.recoveryCode)
    return (
      <Modal title="Nouveau code de récupération" onClose={onClose}>
        <div className="modal-body">
          <p className="form-description">
            Notez ce code maintenant : il s’affiche{" "}
            <strong>une seule fois</strong> et remplace définitivement
            l’ancien code.
          </p>
          <div className="recovery-code-display" data-testid="recovery-code">
            {state.recoveryCode}
          </div>
          <div className="form-actions">
            <Button type="button" onClick={onClose}>
              J’ai sauvegardé mon code
            </Button>
          </div>
        </div>
      </Modal>
    );
  return (
    <Modal title="Régénérer le code de récupération" onClose={onClose}>
      <form action={action}>
        <div className="modal-body">
          <p className="form-description">
            Confirmez votre mot de passe actuel. L’ancien code devient
            définitivement inutilisable dès la régénération.
          </p>
          <div className="field">
            <label htmlFor="regen-password">Mot de passe actuel</label>
            <Input
              id="regen-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {state.message && (
            <p className="login-error" role="alert">
              {state.message}
            </p>
          )}
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button disabled={pending}>
              {pending ? "Génération…" : "Régénérer"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
