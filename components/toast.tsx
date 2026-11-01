"use client";

// A notice about something that just happened (saved, sent, couldn't save…): slides down from
// the top of the screen and stays there, so nobody has to scroll up to see it. It goes back up
// on the next click or tap anywhere, except on a link or button inside it (decided 2026-11-01).
// Notices that describe the page itself stay inline as <Alert>.
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { Alert } from "@/components/alert";

type Props = ComponentProps<typeof Alert> & {
  /**
   * Shows the notice again when this changes, e.g. the state a form action returned, so a
   * second "Couldn't save" after closing the first one still slides down.
   */
  trigger?: unknown;
};

export function Toast({ trigger, ...alert }: Props) {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");
  const [shownFor, setShownFor] = useState(trigger);
  const box = useRef<HTMLDivElement>(null);
  // Only in the browser: the server and the first (hydrating) render show nothing.
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);

  // A new trigger brings it back (adjusting state while rendering, as React recommends).
  if (trigger !== shownFor) {
    setShownFor(trigger);
    setPhase("in");
  }

  useEffect(() => {
    if (phase !== "in") return;
    const close = (event: Event) => {
      const target = event.target as Element | null;
      if (target && box.current?.contains(target) && target.closest("a, button, input, select, textarea, label")) return;
      setPhase(reducedMotion() ? "gone" : "out");
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(event);
    };
    // Wait a moment, so the click that caused the notice doesn't also close it.
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", close);
      document.addEventListener("keydown", onKey);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [phase]);

  if (phase === "gone" || !inBrowser) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <div
        ref={box}
        onAnimationEnd={() => phase === "out" && setPhase("gone")}
        className={`pointer-events-auto w-full max-w-120 rounded-md shadow-lg ${phase === "in" ? "animate-toast-in" : "animate-toast-out"}`}
      >
        <Alert {...alert} />
      </div>
    </div>,
    document.body,
  );
}

const noSubscribe = () => () => {};

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
