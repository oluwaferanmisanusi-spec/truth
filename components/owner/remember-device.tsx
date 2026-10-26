// "Remember this device for 30 days" under the two-step code (decided 2026-10-26). Ticked by
// default, so people sign in less often; the hint warns against it on shared computers.
export function RememberDevice() {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-ink">
        <input type="checkbox" name="remember" defaultChecked className="size-5 shrink-0 cursor-pointer accent-primary" />
        Remember this device for 30 days
      </label>
      <p className="pl-8 text-small text-ink-muted">
        You won’t need a code here until then, only your password. Untick this on a shared computer.
      </p>
    </div>
  );
}
