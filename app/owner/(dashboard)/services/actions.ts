"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUFFER_OPTIONS, MAX_PRICE_NAIRA } from "@/lib/owner/services";

export type ServiceFormValues = {
  name: string;
  description: string;
  duration: string;
  buffer: string;
  price: string;
};

export type ServiceFormState =
  | { errors: Partial<Record<keyof ServiceFormValues | "form", string>>; values: ServiceFormValues }
  | undefined;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Add (no id) or edit (with id) a service. Figma 5.6 / 5.6b. */
export async function saveService(_prev: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  const values: ServiceFormValues = {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    duration: String(formData.get("duration") ?? ""),
    buffer: String(formData.get("buffer") ?? ""),
    price: String(formData.get("price") ?? "").trim(),
  };

  const errors: NonNullable<ServiceFormState>["errors"] = {};
  if (!values.name) errors.name = "Enter a name for the service.";
  else if (values.name.length > 60) errors.name = "Keep the name to 60 characters or fewer.";
  if (values.description.length > 300) errors.description = "Keep the description to 300 characters or fewer.";

  const duration = Number(values.duration);
  const buffer = Number(values.buffer);
  if (!values.duration) errors.duration = "Choose how long it takes.";
  else if (!Number.isInteger(duration) || duration <= 0 || duration > 480) errors.duration = "Choose a duration from the list.";
  if (!BUFFER_OPTIONS.includes(buffer)) errors.buffer = "Choose a buffer from the list.";

  // Accept "8000", "8,000" or "₦8,000"; whole naira only.
  const priceDigits = values.price.replace(/[₦,\s]/g, "");
  const price = Number(priceDigits);
  if (!priceDigits) errors.price = "Enter a price.";
  else if (!/^\d+$/.test(priceDigits)) errors.price = "Enter the price in whole naira, for example 8,000.";
  else if (price <= 0) errors.price = "The price must be more than ₦0, because customers pay in full when booking.";
  else if (price > MAX_PRICE_NAIRA) errors.price = "That price looks too high. Check it and try again.";

  if (Object.keys(errors).length) return { errors, values };
  if (id && !UUID.test(id)) return { errors: { form: "This service couldn’t be found." }, values };

  const admin = createAdminClient();
  const row = {
    name: values.name,
    description: values.description,
    duration_minutes: duration,
    buffer_minutes: buffer,
    price_kobo: price * 100,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (id) {
    ({ error } = await admin.from("services").update(row).eq("id", id));
  } else {
    const { data: last } = await admin.from("services").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    ({ error } = await admin.from("services").insert({ ...row, sort_order: (last?.sort_order ?? 0) + 1 }));
  }

  if (error) {
    if (error.code === "23505") return { errors: { name: "There’s already a service with this name." }, values };
    console.error("saveService failed", error);
    return { errors: { form: "Something went wrong and the service wasn’t saved. Please try again." }, values };
  }

  redirect("/owner/services");
}

/** Deactivate (Figma 5.7) or turn a service back on. Existing bookings are untouched. */
export async function setServiceActive(id: string, isActive: boolean): Promise<{ error?: string }> {
  await requireOwner();
  if (!UUID.test(id)) return { error: "This service couldn’t be found." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("services")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("setServiceActive failed", error);
    return { error: "Something went wrong. Please try again." };
  }
  refresh();
  return {};
}
