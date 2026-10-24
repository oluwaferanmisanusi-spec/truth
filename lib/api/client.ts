// Calls the NestJS API (api/) from the website's server code. The visitor's Supabase access
// token goes along as a Bearer token, and the API checks it itself, so the API decides who
// may do what.
import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const API_URL = process.env.API_URL ?? "http://localhost:3200";

/**
 * A failed API call: the HTTP status, its message, a code for the cases a page handles
 * (e.g. "slot_taken"), per-field messages for forms, and the whole reply for anything else.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly fieldErrors: Record<string, string> = {},
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type Options = { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown };

export async function api<T>(path: string, { method = "GET", body }: Options = {}): Promise<T> {
  // Also marks the caller as request-time, so pages never call the API while building.
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(API_URL + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message = typeof json?.message === "string" ? json.message : "Something went wrong";
    throw new ApiError(res.status, message, json?.code, json?.fieldErrors, json ?? {});
  }
  return json as T;
}

/** The API's answer, or the 404 page if it says there's no such thing (or the id is malformed). */
export async function apiOrNotFound<T>(path: string): Promise<T> {
  try {
    return await api<T>(path);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}
