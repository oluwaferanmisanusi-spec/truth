"use server";

// Barber screens' forms and buttons. Each goes through the API, which checks the person is
// an active barber and only touches their own schedule.
import { redirect } from "next/navigation";
import type { BlockAdded, BlockRemoved } from "@api/barber";
import { api, ApiError } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/server";
import { formatTime, isIsoDate } from "@/lib/format";

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Invites (Figma 4.1)

export type InviteState = {
  errors?: Partial<Record<"name" | "password" | "form", string>>;
  values?: { name?: string };
};

const invitePage = (token: string) => `/barber/invite/${encodeURIComponent(token)}`;

/** "Create account": the API makes the login and links it; then we log them in. */
export async function acceptInvite(token: string, _prev: InviteState | undefined, fd: FormData): Promise<InviteState> {
  const name = String(fd.get("name") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  let email: string;
  try {
    ({ email } = await api<{ email: string }>(`/barber-invites/${encodeURIComponent(token)}/accept`, {
      method: "POST",
      body: { name, password },
    }));
  } catch (error) {
    if (!(error instanceof ApiError) || error.status >= 500) throw error;
    if (error.status === 400) return { errors: error.fieldErrors, values: { name } };
    // Expired, used, or the email has a customer account: the page shows what to do next.
    redirect(invitePage(token));
  }
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/barber?joined=1");
}

// ---------------------------------------------------------------------------
// Outcomes (Figma 4.8, 4.8b)

export async function recordOutcome(id: string, outcome: "completed" | "no_show"): Promise<{ error?: string }> {
  try {
    await api(`/barber/appointments/${encodeURIComponent(id)}/outcome`, { method: "POST", body: { outcome } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) return { error: error.message };
    throw error;
  }
  redirect(`/barber/appointments/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Blocks (Figma 4.11–4.14)

export type BlockState = {
  errors?: Partial<Record<"date" | "from" | "to" | "fromDay" | "toDay" | "reason", string>>;
  /** The red alert at the top (4.12, 4.12b). */
  alert?: { title: string; message: string };
  values?: Record<string, string>;
};

const field = (fd: FormData, key: string) => String(fd.get(key) ?? "");

/** Adds the block, then back to the day the barber came from, with a confirmation. */
export async function addBlock(back: string, _prev: BlockState | undefined, fd: FormData): Promise<BlockState> {
  const kind = field(fd, "kind") === "days" ? "days" : "part";
  const reason = field(fd, "reason");
  const body =
    kind === "part"
      ? { kind, date: field(fd, "date"), from: field(fd, "from"), to: field(fd, "to"), reason }
      : { kind, from: field(fd, "fromDay"), to: field(fd, "toDay"), reason };

  let added: BlockAdded;
  try {
    added = await api<BlockAdded>("/barber/blocks", { method: "POST", body });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status >= 500) throw error;
    const e = error.fieldErrors;
    // Whole days have their own From and To date fields on the page.
    const errors = kind === "part" ? e : { fromDay: e.from, toDay: e.to, reason: e.reason };
    const title = typeof error.body.title === "string" ? error.body.title : undefined;
    return {
      errors,
      alert: title ? { title, message: error.message } : undefined,
      values: {
        kind,
        date: field(fd, "date"),
        from: field(fd, "from"),
        to: field(fd, "to"),
        fromDay: field(fd, "fromDay"),
        toDay: field(fd, "toDay"),
        reason,
      },
    };
  }

  const query = new URLSearchParams({ date: isIsoDate(back) ? back : "" });
  if (added.kind === "part") query.set("blocked", `${added.date}_${added.from}_${added.to}`);
  else query.set("leave", `${added.from}_${added.to}_${added.days}`);
  redirect(`/barber?${query}`);
}

/** Remove block (4.13), then the day again with "Block removed" (4.14). */
export async function removeBlock(id: string, date: string): Promise<{ error?: string }> {
  let removed: BlockRemoved;
  try {
    removed = await api<BlockRemoved>(`/barber/blocks/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof ApiError && error.status < 500) return { error: error.message };
    throw error;
  }
  const query = new URLSearchParams({ date: isIsoDate(date) ? date : "" });
  query.set("removed", removed.isWholeDay ? "day" : `${formatTime(removed.startsAt)}_${formatTime(removed.endsAt)}`);
  redirect(`/barber?${query}`);
}
