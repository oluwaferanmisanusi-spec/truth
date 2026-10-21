// The centred card used by the owner log in, forgot password and set password screens
// (Figma 5.0, 5.0b, 5.0c).
import type { ReactNode } from "react";

export function AuthCard({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-110 max-w-full flex-col gap-6 rounded-lg border border-border bg-surface p-10">
        <p className="font-display text-wordmark font-semibold text-primary">Truth</p>
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 font-semibold">{title}</h1>
          {description && <p className="text-ink-muted">{description}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
