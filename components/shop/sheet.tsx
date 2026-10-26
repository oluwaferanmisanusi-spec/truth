"use client";

// Figma bottom sheet (3.11, 3.12, 3.25): a confirm that slides up from the bottom on phones.
// Native <dialog>, so focus is trapped and Escape closes it.
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Full-width buttons, stacked; put the main action first, as designed. */
  actions: ReactNode;
};

export function Sheet({ open, onClose, title, children, actions }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Leaving the page keeps it alive but hidden (Next's Activity), so an open sheet would stay
  // in the browser's top layer and block every click on the next page. Close it on the way
  // out; its close event resets the parent's state too.
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // tap on the scrim
      }}
      aria-labelledby={titleId}
      className="mx-auto mt-auto mb-0 w-full max-w-[480px] rounded-t-lg bg-surface p-0 text-left text-ink backdrop:bg-ink/45"
    >
      <div className="flex flex-col gap-4 px-4 pt-3 pb-6">
        <span aria-hidden className="mx-auto h-1 w-9 rounded-full bg-border-input/60" />
        <h2 id={titleId} className="text-h2">
          {title}
        </h2>
        <div className="text-ink-muted">{children}</div>
        <div className="flex flex-col gap-3">{actions}</div>
      </div>
    </dialog>
  );
}
