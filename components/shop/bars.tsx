// Customer top and bottom bars (Figma "Top bar" and "Bottom bar"), phone width.
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const iconButton =
  "flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-muted " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Wordmark bar for Home and result screens. The account icon arrives with customer accounts. */
export function BrandBar() {
  return (
    <header className="flex h-14 items-center border-b border-border pr-1 pl-4">
      <Link href="/" className="font-display text-wordmark text-primary">
        Truth
      </Link>
    </header>
  );
}

/** Back + centred title for booking steps. `back` is a link, or a server action to run first. */
export function StepBar({ title, back }: { title: string; back: string | (() => Promise<void>) }) {
  const icon = <ChevronLeft aria-hidden size={24} />;
  return (
    <header className="flex h-14 items-center border-b border-border px-1">
      {typeof back === "string" ? (
        <Link href={back} className={iconButton} aria-label="Back">
          {icon}
        </Link>
      ) : (
        <form action={back}>
          <button type="submit" className={iconButton} aria-label="Back">
            {icon}
          </button>
        </form>
      )}
      <h1 className="flex-1 text-center font-sans text-body font-semibold tracking-normal">{title}</h1>
      <span className="size-11" aria-hidden />
    </header>
  );
}

/** Sticky footer with a one-line helper above the main action. */
export function BottomBar({ helper, children }: { helper?: ReactNode; children: ReactNode }) {
  return (
    <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-surface px-4 pt-4 pb-6">
      {helper && (
        <p className="text-center text-small text-ink-muted" aria-live="polite">
          {helper}
        </p>
      )}
      {children}
    </div>
  );
}
