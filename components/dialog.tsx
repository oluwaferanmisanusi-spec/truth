"use client";

// Figma "Modal" (2:605), desktop dialog. Uses the native <dialog> element, which gives
// focus trapping, Escape to close and the backdrop for free.
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons, right-aligned; put the primary action last. */
  actions: ReactNode;
  /** 600px instead of 480px, for three buttons in a row. */
  wide?: boolean;
};

export function Dialog({ open, onClose, title, children, actions, wide }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Leaving the page keeps it alive but hidden (Next's Activity), so an open dialog would stay
  // in the browser's top layer and block every click on the next page. Close it on the way
  // out; its close event resets the parent's state too.
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      // A late close event from the cleanup below can land after the dialog has opened again
      // (React's development double-mount does this): only pass on a close that stuck.
      onClose={() => {
        if (!ref.current?.open) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the scrim
      }}
      aria-labelledby={titleId}
      className={`m-auto ${wide ? "w-150" : "w-120"} max-w-[calc(100vw-2rem)] rounded-lg bg-surface p-0 text-left text-ink shadow-modal backdrop:bg-ink/45`}
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
