// Heading + one line under it, at the top of the account screens.
export function Intro({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-h1">{title}</h1>
      <p className="text-ink-muted">{children}</p>
    </div>
  );
}
