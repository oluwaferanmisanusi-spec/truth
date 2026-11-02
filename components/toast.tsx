"use client";

// A notice about something that just happened (saved, sent, couldn't save…): slides down from
// the top of the screen and stays there, so nobody has to scroll up to see it. It goes back up
// on the next click or tap outside it (decided 2026-11-01), or 3 seconds after they start
// scrolling (2026-11-02). A click, not a press, so a swipe doesn't count as a tap; clicks inside
// it don't close it.
// Notices that describe the page itself stay inline as <Alert>.
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { Alert } from "@/components/alert";

type Props = ComponentProps<typeof Alert> & {
  /**
   * Shows the notice again when this changes, e.g. the state a form action returned, so a
   * second "Couldn't save" after closing the first one still slides down. Pages that show a
   * notice from the address (after a redirect) pass renderId(), because the page stays mounted
   * when only the address changes and the same notice can come twice.
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
    const hide = () => setPhase(reducedMotion() ? "gone" : "out");
    const close = (event: Event) => {
      if (event.target instanceof Node && box.current?.contains(event.target)) return;
      hide();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    // Scrolling means they've moved on: it goes back up 3 seconds after they start.
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      scrollTimer ??= setTimeout(hide, 3000);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    // Wait a moment, so the click that caused the notice doesn't also close it.
    const timer = setTimeout(() => {
      document.addEventListener("click", close, true);
      document.addEventListener("keydown", onKey);
    }, 100);
    return () => {
      clearTimeout(timer);
      clearTimeout(scrollTimer);
      document.removeEventListener("click", close, true);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onScroll, { capture: true });
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
