"use client";

// Figma password field (3.1, 3.2, 3.5): a text field with a show/hide button.
import { useState } from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";

type Props = {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  autoComplete: "current-password" | "new-password";
};

export function PasswordField({ id, label, helper, error, autoComplete }: Props) {
  const [shown, setShown] = useState(false);
  const describedBy = [error && `${id}-error`, helper && `${id}-helper`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-small font-medium">
        {label}
      </label>
      <div
        className={`flex h-12 items-center rounded-md border bg-surface focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus ${
          error ? "border-danger" : "border-border-input"
        }`}
      >
        <input
          id={id}
          name={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-full min-w-0 flex-1 rounded-md bg-transparent px-4 text-body outline-none"
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="mr-1 flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted focus-visible:outline-3 focus-visible:outline-focus"
        >
          {shown ? <EyeOff aria-hidden size={20} /> : <Eye aria-hidden size={20} />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1 text-small text-danger">
          <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      {helper && (
        <p id={`${id}-helper`} className="text-small text-ink-muted">
          {helper}
        </p>
      )}
    </div>
  );
}
