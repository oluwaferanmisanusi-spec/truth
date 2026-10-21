"use client";

// A form's main button that says it's working while the server action runs.
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui";

export function SubmitButton({ label, pendingLabel, variant = "primary" }: {
  label: string;
  pendingLabel: string;
  variant?: keyof typeof buttonClass;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`${buttonClass[variant]} w-full`} disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}
