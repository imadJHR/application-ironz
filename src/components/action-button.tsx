"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Modal } from "./modal";
import type { Result } from "@/server/actions";
export function ActionButton({
  action,
  children,
  confirmation,
  confirmationTitle = "Confirmer l’action",
  confirmLabel = "Confirmer",
  destructiveConfirmation = false,
  ariaLabel,
  variant = "outline",
  redirectTo,
  size,
}: {
  action: () => Promise<Result>;
  children: React.ReactNode;
  confirmation?: string;
  confirmationTitle?: string;
  confirmLabel?: string;
  destructiveConfirmation?: boolean;
  ariaLabel?: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
  redirectTo?: string;
  size?: "sm" | "icon";
}) {
  const [pending, start] = useTransition(),
    [confirm, setConfirm] = useState(false),
    router = useRouter();
  const run = () =>
    start(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message);
          setConfirm(false);
          if (redirectTo)
            router.push(redirectTo.replace(":id", result.id || ""));
          router.refresh();
        } else toast.error(result.message);
      } catch {
        toast.error("Cette action n’a pas pu être effectuée.");
      }
    });
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending}
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => (confirmation ? setConfirm(true) : run())}
      >
        {pending ? "En cours…" : children}
      </Button>
      {confirm && (
        <Modal title={confirmationTitle} onClose={() => setConfirm(false)}>
          <p>{confirmation}</p>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Annuler
            </Button>
            <Button
              variant={
                variant === "destructive" || destructiveConfirmation
                  ? "destructive"
                  : "default"
              }
              disabled={pending}
              onClick={run}
            >
              {pending ? "En cours…" : confirmLabel}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
