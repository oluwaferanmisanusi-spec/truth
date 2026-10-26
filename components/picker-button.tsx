"use client";

// The design's calendar or clock icon on a native date/time input, as a button that opens
// the browser's picker in one click (decided 2026-10-26). Before, the browser's own picker
// button sat invisibly over the icon and only answered once the input had focus. Keyboard
// users open the picker from the input itself, so the icon stays out of the tab order.
import type { ReactNode } from "react";

/** For the input: hides the browser's own picker button so the design's icon is the one. */
export const pickerInputClass =
  "min-w-0 flex-1 bg-transparent text-body outline-none [&::-webkit-calendar-picker-indicator]:hidden";

export function PickerButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      onClick={(e) => {
        const input = e.currentTarget.parentElement?.querySelector("input");
        if (!input || input.disabled) return;
        input.focus();
        try {
          input.showPicker();
        } catch {
          // Browsers without showPicker: focusing the input is the next best thing.
        }
      }}
      className="flex size-6 shrink-0 cursor-pointer items-center justify-center text-ink-muted hover:text-ink"
    >
      {children}
    </button>
  );
}
