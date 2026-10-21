"use client";

// Figma 5.12 Shop settings: Opening hours + Time zone (saved with "Save changes") and
// Holidays (added and removed straight away), 5.12b–5.12g states.
import { useActionState, useState, useTransition } from "react";
import { Alert } from "@/components/alert";
import { Dialog } from "@/components/dialog";
import { SelectFormField, TextField } from "@/components/form-field";
import { DateField } from "@/components/owner/filter-field";
import { HoursEditor, type HoursDay } from "@/components/owner/hours-editor";
import { buttonClass } from "@/components/ui";
import { addHoliday, removeHoliday, saveShopSettings, type HolidayResult } from "./actions";

type Holiday = { id: string; date: string; name: string | null; label: string };

export function ShopSettingsForm({ hours, timeZone, timeZones, holidays, today }: {
  hours: HoursDay[];
  timeZone: string;
  timeZones: { value: string; label: string }[];
  holidays: Holiday[];
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
          <HoursEditor initial={hours} dayErrors={state?.dayErrors} switchLabel={(day) => `${day} open`} />
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6" aria-labelledby="tz-heading">
          <h2 id="tz-heading" className="text-h2 font-semibold">Time zone</h2>
          <SelectFormField id="time_zone" label="Shop time zone" defaultValue={timeZone} options={timeZones}
            helper="Every time in the app and in emails uses this time zone" />
        </section>
      </form>

      <HolidaysCard holidays={holidays} today={today} />

      <div>
        <button type="submit" form="settings-form" className={buttonClass.primary} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function HolidaysCard({ holidays, today }: { holidays: Holiday[]; today: string }) {
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

      {notice?.title && <Alert title={notice.title}>{notice.message}</Alert>}
      {notice?.error && <Alert variant="warning" role="alert">{notice.error}</Alert>}

      {holidays.length > 0 ? (
        <ul className="flex flex-col">
          {holidays.map((h) => (
            <li key={h.id} className="flex min-h-16 items-center gap-4 border-b border-border text-small">
              <span className="w-44 shrink-0 font-medium">{h.label}</span>
              <span className="flex-1">{h.name ?? <span className="text-ink-muted">No name</span>}</span>
              <button type="button" className={buttonClass.ghost} onClick={() => setRemoving(h)}
                aria-label={`Remove ${h.name ?? h.label}`}>
                Remove
              </button>
            </li>
          ))}
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
