// Figma "Field" (2:316) for forms: label above, optional helper, and an error state that
// pairs colour with an icon and text so it never relies on colour alone.
import type { ReactNode } from "react";
import { ChevronDown, CircleAlert } from "lucide-react";

type FieldProps = {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  className?: string;
};

function describedBy(id: string, helper?: string, error?: string) {
  return [error && `${id}-error`, helper && `${id}-helper`].filter(Boolean).join(" ") || undefined;
}

const box = (error?: string, extra = "") =>
  `w-full rounded-md border bg-surface px-4 text-body text-ink placeholder:text-ink-muted ` +
  `focus:outline-3 focus:outline-offset-2 focus:outline-focus disabled:cursor-not-allowed disabled:bg-disabled-bg ` +
  `disabled:text-ink-muted ${error ? "border-danger" : "border-border-input"} ${extra}`;

function Frame({ id, label, helper, error, className, children }: FieldProps & { children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className ?? ""}`}>
      <label htmlFor={id} className="text-small font-medium">
        {label}
      </label>
      {children}
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

export function TextField(props: FieldProps & Omit<React.ComponentProps<"input">, "id" | "className">) {
  const { id, label, helper, error, className, ...input } = props;
  return (
    <Frame id={id} label={label} helper={helper} error={error} className={className}>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, helper, error)}
        className={box(error, "h-12")}
        {...input}
      />
    </Frame>
  );
}

export function TextAreaField(props: FieldProps & Omit<React.ComponentProps<"textarea">, "id" | "className">) {
  const { id, label, helper, error, className, ...textarea } = props;
  return (
    <Frame id={id} label={label} helper={helper} error={error} className={className}>
      <textarea
        id={id}
        name={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, helper, error)}
        className={box(error, "h-28 resize-y py-3")}
        {...textarea}
      />
    </Frame>
  );
}

export function SelectFormField(
  props: FieldProps & { options: { value: string; label: string }[]; placeholder?: string } & Omit<
      React.ComponentProps<"select">,
      "id" | "className"
    >,
) {
  const { id, label, helper, error, className, options, placeholder, ...select } = props;
  return (
    <Frame id={id} label={label} helper={helper} error={error} className={className}>
      <div className="relative">
        <select
          id={id}
          name={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, helper, error)}
          className={box(error, "h-12 cursor-pointer appearance-none pr-11 invalid:text-ink-muted")}
          {...select}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden size={20} className="pointer-events-none absolute top-3.5 right-4 text-ink-muted" />
      </div>
    </Frame>
  );
}
