"use client";

// Figma "Modal" (2:605), desktop dialog. Uses the native <dialog> element, which gives
// focus trapping, Escape to close and the backdrop for free.
import { useEffect, useId, useRef, type ReactNode } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons, right-aligned; put the primary action last. */
  actions: ReactNode;
};

export function Dialog({ open, onClose, title, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the scrim
      }}
      aria-labelledby={titleId}
      className="m-auto w-120 max-w-[calc(100vw-2rem)] rounded-lg bg-surface p-0 text-left text-ink shadow-modal backdrop:bg-ink/45"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="text-h2 font-semibold">
          {title}
        </h2>
        <div className="text-ink-muted">{children}</div>
        <div className="flex justify-end gap-3">{actions}</div>
      </div>
    </dialog>
  );
}
