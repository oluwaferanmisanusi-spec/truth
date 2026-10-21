"use client";

// The Details card plus Save/Cancel, shared by Add service (5.6b) and Edit service (5.6).
import Link from "next/link";
import { useActionState } from "react";
import { CircleAlert } from "lucide-react";
import { SelectFormField, TextAreaField, TextField } from "@/components/form-field";
import { buttonClass } from "@/components/ui";
import { saveService, type ServiceFormValues } from "./actions";

type Props = {
  id?: string;
  initial: ServiceFormValues;
  durationOptions: number[];
  bufferOptions: number[];
  offeredByNote: string;
  submitLabel: string;
};

const minutes = (n: number) => (n === 0 ? "None" : `${n} min`);

export function ServiceForm({ id, initial, durationOptions, bufferOptions, offeredByNote, submitLabel }: Props) {
  const [state, action, pending] = useActionState(saveService, undefined);
  const values = state?.values ?? initial;
  const errors = state?.errors ?? {};

  // Keep an unusual existing duration selectable rather than silently changing it.
  const durations = durationOptions.includes(Number(initial.duration)) || !initial.duration
    ? durationOptions
    : [...durationOptions, Number(initial.duration)].sort((a, b) => a - b);

  return (
    <form action={action} className="flex w-180 max-w-full flex-col gap-6" noValidate>
      {id && <input type="hidden" name="id" value={id} />}

      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-6">
        <h2 className="text-h2 font-semibold">Details</h2>

        {errors.form && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-tint px-4 py-3 text-small text-danger">
            <CircleAlert aria-hidden size={20} className="mt-0.5 shrink-0" />
            {errors.form}
          </p>
        )}

        <TextField id="name" label="Name" defaultValue={values.name} placeholder="For example, Skin fade"
          error={errors.name} maxLength={60} required key={`name-${values.name}`} />
        <TextAreaField id="description" label="Description" defaultValue={values.description}
          placeholder="What’s included, in a sentence or two" helper="Customers see this when they choose a service"
          error={errors.description} maxLength={300} key={`desc-${values.description}`} />

        <div className="flex items-start gap-4">
          <SelectFormField id="duration" label="Duration" className="flex-1" defaultValue={values.duration}
            placeholder="Choose" required error={errors.duration} key={`dur-${values.duration}`}
            options={durations.map((n) => ({ value: String(n), label: minutes(n) }))} />
          <SelectFormField id="buffer" label="Buffer after" className="flex-1" defaultValue={values.buffer}
            helper="Clean-up time. Not shown to customers" error={errors.buffer} key={`buf-${values.buffer}`}
            options={bufferOptions.map((n) => ({ value: String(n), label: minutes(n) }))} />
          <TextField id="price" label="Price (₦)" className="flex-1" defaultValue={values.price} inputMode="numeric"
            placeholder="0" helper="Charged in full when booking" error={errors.price} key={`price-${values.price}`} />
        </div>

        <p className="text-small text-ink-muted">{offeredByNote}</p>
      </div>

      <div className="flex gap-3">
        <button type="submit" className={buttonClass.primary} disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href="/owner/services" className={buttonClass.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
