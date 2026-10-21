// Figma "Status hero": tinted icon circle, title and message, centred.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

const TONES = {
  success: "bg-success-tint text-success",
  danger: "bg-danger-tint text-danger",
  warning: "bg-warning-tint text-warning",
  primary: "bg-primary-tint text-primary",
};

export function StatusHero({ icon: Icon, tone, title, children, spin = false }: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  title: string;
  children: ReactNode;
  spin?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className={`mb-1 flex size-16 items-center justify-center rounded-full ${TONES[tone]}`}>
        <Icon aria-hidden size={28} className={spin ? "animate-spin" : undefined} />
      </span>
      <h1 className="text-h1">{title}</h1>
      <div className="text-body text-ink-muted">{children}</div>
    </div>
  );
}
