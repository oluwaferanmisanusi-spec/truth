"use client";

// Figma 5.12 Shop settings: Opening hours + Time zone (saved with "Save changes") and
// Holidays (added and removed straight away), 5.12b–5.12g states.
import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Alert } from "@/components/alert";
import { Dialog } from "@/components/dialog";
import { SelectFormField, TextField } from "@/components/form-field";
import { DateField } from "@/components/owner/filter-field";
import { HoursEditor, type HoursDay } from "@/components/owner/hours-editor";
import { buttonClass } from "@/components/ui";
import { addHoliday, removeHoliday, saveShopSettings, type HolidayResult } from "./actions";

type Holiday = { id: string; date: string; name: string | null; label: string };
type Clash = { date: string; reason: "holiday" | "hours"; count: number; label: string; href: string };

const linkClass = "font-medium text-primary underline underline-offset-2 hover:text-primary-hover";
const bookingsText = (n: number) => (n === 1 ? "1 booking" : `${n} bookings`);

export function ShopSettingsForm({ hours, timeZone, timeZones, holidays, clashes, today }: {
  hours: HoursDay[];
  timeZone: string;
  timeZones: { value: string; label: string }[];
  holidays: Holiday[];
  clashes: Clash[];
  today: string;
}) {
  const [state, action, pending] = useActionState(saveShopSettings, undefined);

  return (
    <div className="flex w-180 max-w-full flex-col gap-6">
      {state?.saved && !pending && (
        <Alert title="Changes saved">New opening hours apply to slots from now on. Existing bookings stay as they are.</Alert>
      )}
      {state?.error && <Alert variant="warning" role="alert">{state.error}</Alert>}

      <form id="settings-form" action={action} noValidate className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6" aria-labelledby="hours-heading">
          <h2 id="hours-heading" className="text-h2 font-semibold">Opening hours</h2>
          <HoursClashes clashes={clashes.filter((c) => c.reason === "hours")} />
          <HoursEditor initial={hours} dayErrors={state?.dayErrors} switchLabel={(day) => `${day} open`} />
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6" aria-labelledby="tz-heading">
          <h2 id="tz-heading" className="text-h2 font-semibold">Time zone</h2>
          <SelectFormField id="time_zone" label="Shop time zone" defaultValue={timeZone} options={timeZones}
            helper="Every time in the app and in emails uses this time zone" />
        </section>
      </form>

      <HolidaysCard holidays={holidays} clashes={clashes} today={today} />

      <div>
        <button type="submit" form="settings-form" className={buttonClass.primary} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// Bookings the opening hours now rule out (decided 2026-10-26, built from the Alert). They
// stay booked, so this shows until each is cancelled or moved, or the hours change back.
function HoursClashes({ clashes }: { clashes: Clash[] }) {
  if (clashes.length === 0) return null;
  const total = clashes.reduce((n, c) => n + c.count, 0);
  return (
    <Alert variant="warning" title={`${bookingsText(total)} ${total === 1 ? "is" : "are"} outside your opening hours`}>
      <p>{total === 1 ? "It stays" : "They stay"} booked until you cancel or move {total === 1 ? "it" : "them"}.</p>
      <ul className="mt-2 flex flex-col gap-1">
        {clashes.map((c) => (
          <li key={c.date}>
            <Link href={c.href} className={linkClass}>{c.label}: {bookingsText(c.count)}</Link>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

function HolidaysCard({ holidays, clashes, today }: { holidays: Holiday[]; clashes: Clash[]; today: string }) {
  const [notice, setNotice] = useState<HolidayResult>();
  const [removing, setRemoving] = useState<Holiday>();
  const [removePending, startRemove] = useTransition();
  const [date, setDate] = useState("");

  const [addState, add, adding] = useActionState(async (prev: HolidayResult, formData: FormData) => {
    const result = await addHoliday(prev, formData);
    if (!result?.error) {
      setNotice(result);
      setDate("");
    }
    return result?.error ? result : undefined;
  }, undefined);

  const confirmRemove = () =>
    startRemove(async () => {
      const result = await removeHoliday(removing!.id);
      setRemoving(undefined);
      setNotice(result);
    });

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6" aria-labelledby="holidays-heading">
      <div className="flex flex-col gap-1">
        <h2 id="holidays-heading" className="text-h2 font-semibold">Holidays</h2>
        <p className="text-small text-ink-muted">No one can book on these dates.</p>
      </div>

      {notice?.title && (
        <Alert title={notice.title}>
          {notice.message}
          {notice.link && <> <Link href={notice.link.href} className={linkClass}>{notice.link.text}</Link></>}
        </Alert>
      )}
      {notice?.error && <Alert variant="warning" role="alert">{notice.error}</Alert>}

      {holidays.length > 0 ? (
        <ul className="flex flex-col">
          {holidays.map((h) => {
            // Still booked on this holiday: shown on its row until those bookings are dealt with.
            const clash = clashes.find((c) => c.date === h.date);
            return (
              <li key={h.id} className="flex min-h-16 items-center gap-4 border-b border-border text-small">
                <span className="w-44 shrink-0 font-medium">{h.label}</span>
                <span className="flex flex-1 flex-col gap-1 py-2">
                  {h.name ?? <span className="text-ink-muted">No name</span>}
                  {clash && (
                    <span className="flex items-center gap-1 text-warning">
                      <CircleAlert aria-hidden size={16} className="shrink-0" />
                      {bookingsText(clash.count)} still on this day.
                      <Link href={clash.href} className={linkClass}>Show {clash.count === 1 ? "it" : "them"}</Link>
                    </span>
                  )}
                </span>
                <button type="button" className={buttonClass.ghost} onClick={() => setRemoving(h)}
                  aria-label={`Remove ${h.name ?? h.label}`}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-small text-ink-muted">No holidays yet.</p>
      )}

      <form action={add} noValidate className="flex items-start gap-3">
        <div className="w-50 shrink-0">
          <DateField id="holiday_date" label="Date" value={date} min={today} onChange={setDate} className="w-full" />
          <input type="hidden" name="holiday_date" value={date} />
        </div>
        <TextField id="holiday_name" label="Name (optional)" placeholder="e.g. Eid al-Fitr" className="flex-1" maxLength={60}
          key={notice?.title ?? "new"} />
        <button type="submit" className={`${buttonClass.secondary} mt-7`} disabled={adding}>
          {adding ? "Adding…" : "Add holiday"}
        </button>
      </form>
      {addState?.error && <Alert variant="warning" role="alert">{addState.error}</Alert>}

      <Dialog
        open={!!removing}
        onClose={() => !removePending && setRemoving(undefined)}
        title={`Remove ${removing?.name ?? "this holiday"}?`}
        actions={
          <>
            <button type="button" className={buttonClass.secondary} onClick={() => setRemoving(undefined)} disabled={removePending}>
              Cancel
            </button>
            <button type="button" className={buttonClass.danger} onClick={confirmRemove} disabled={removePending}>
              {removePending ? "Removing…" : "Remove holiday"}
            </button>
          </>
        }
      >
        <p>Customers will be able to book {removing?.label} again, inside your opening hours.</p>
      </Dialog>
    </section>
  );
}
