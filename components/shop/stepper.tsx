// Figma "Stepper": "Step 3 of 4 · Time" over four segments, plus a line of context.
const STEPS = ["Service", "Barber", "Time", "Details and payment"];

export function Stepper({ step, context }: { step: 1 | 2 | 3 | 4; context?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption font-medium tracking-normal text-ink-muted">
        Step {step} of {STEPS.length} · {STEPS[step - 1]}
      </p>
      <div className="flex gap-1" aria-hidden>
        {STEPS.map((name, i) => (
          <span key={name} className={`h-1 flex-1 rounded-full ${i < step ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>
      {context && <p className="text-small text-ink-muted">{context}</p>}
    </div>
  );
}
