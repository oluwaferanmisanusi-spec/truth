"use client";

// One login per browser, shared by every tab (decided 2026-10-26). If another tab logs in as
// someone else, or logs out, a page left open here would act as the wrong person or fail
// ("Not allowed"). When this tab comes back into view we ask which login the browser has now,
// and if it changed, the page is covered until it's reloaded. Closing the dialog reloads too.
import { useEffect, useState } from "react";
import { Dialog } from "@/components/dialog";
import { buttonClass } from "@/components/ui";
import { currentUserId } from "@/lib/auth/session";

type Change = "switched" | "logged_out" | "logged_in";

export function SessionGuard({ userId }: { userId: string | null }) {
  const [change, setChange] = useState<Change>();

  useEffect(() => {
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const now = await currentUserId();
        if (now !== userId) setChange(!now ? "logged_out" : !userId ? "logged_in" : "switched");
      } catch {
        // Offline or the server restarting: check again next time.
      } finally {
        checking = false;
      }
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [userId]);

  const reload = () => window.location.reload();
  const text: Record<Change, { title: string; body: string }> = {
    switched: {
      title: "You’re logged in as someone else now",
      body: "You logged in with a different account in another tab, so this page is out of date. Reload it to carry on as that account.",
    },
    logged_out: {
      title: "You’ve been logged out",
      body: "You logged out in another tab. Reload this page to log in again.",
    },
    logged_in: {
      title: "You’ve logged in",
      body: "You logged in in another tab. Reload this page to carry on with your account.",
    },
  };

  return (
    <Dialog
      open={Boolean(change)}
      onClose={reload}
      title={change ? text[change].title : ""}
      actions={
        <button type="button" className={buttonClass.primary} onClick={reload}>
          Reload page
        </button>
      }
    >
      {change && (
        <>
          <p>{text[change].body}</p>
          {change === "switched" && (
            <p className="mt-2">
              One browser keeps one login for all its tabs. To use two accounts at once, open the other in a
              private window or a different browser.
            </p>
          )}
        </>
      )}
    </Dialog>
  );
}
