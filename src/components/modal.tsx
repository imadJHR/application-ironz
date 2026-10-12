"use client";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal-dialog"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <h2 id={id}>{title}</h2>
          <button onClick={onClose} aria-label="Fermer" type="button">
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
