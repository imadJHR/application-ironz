"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { resetPassword } from "@/server/actions";
import { toast } from "sonner";
import { Modal } from "./modal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function UserControls({ id }: { id: string }) {
  const [open, setOpen] = useState(false),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [show, setShow] = useState(false),
    [pending, setPending] = useState(false);
  const close = () => {
    setOpen(false);
    setPassword("");
    setConfirm("");
    setShow(false);
  };
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Mot de passe
      </Button>
      {open && (
        <Modal title="Réinitialiser le mot de passe" onClose={close}>
          <p>
            Les sessions existantes seront fermées. Transmettez le nouveau mot
            de passe au collaborateur par un canal sécurisé.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (password !== confirm) {
                toast.error("Les deux mots de passe ne correspondent pas.");
                return;
              }
              setPending(true);
              const result = await resetPassword(id, password);
              setPending(false);
              if (result.ok) {
                toast.success(result.message);
                close();
              } else toast.error(result.message);
            }}
          >
            <div className="field">
              <label htmlFor="new-password">
                Nouveau mot de passe · 12 caractères minimum
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <Input
                  id="new-password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  aria-label={show ? "Masquer" : "Afficher"}
                  title={show ? "Masquer" : "Afficher"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="confirm-password">
                Confirmer le mot de passe
              </label>
              <Input
                id="confirm-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <div className="form-actions">
              <Button disabled={pending}>
                {pending ? "Enregistrement…" : "Réinitialiser"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
