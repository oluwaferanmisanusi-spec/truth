"use client";

// Figma "Hold timer": counts down the 10-minute hold. At zero the page reloads from the
// server, which then shows "Your hold ran out" (2.12).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

const mmss = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function HoldTimer({ secondsLeft }: { secondsLeft: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(secondsLeft);

  useEffect(() => {
    const deadline = Date.now() + secondsLeft * 1000;
    const id = setInterval(() => {
      const next = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setLeft(next);
      if (next === 0) {
        clearInterval(id);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft, router]);

  return (
    <div className="flex items-center gap-2 rounded-md bg-warning-tint px-4 py-3">
      <Clock aria-hidden size={20} className="shrink-0 text-warning" />
      <p className="flex-1 text-small">We’re holding this time for you</p>
      <span role="timer" aria-label={`${Math.ceil(left / 60)} minutes left`} className="font-semibold tabular-nums text-warning">
        {mmss(left)}
      </span>
    </div>
  );
}
