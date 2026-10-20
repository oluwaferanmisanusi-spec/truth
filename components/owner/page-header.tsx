// Figma "Page header" (6:3503): top of every owner page.
import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex items-end gap-6">
      <div className="flex flex-1 flex-col gap-1">
        <h1 className="text-h1 font-semibold">{title}</h1>
        <p className="text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
