"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { api, ApiError } from "@/lib/api/client";

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

/** Add (no id) or edit (with id) a service (Figma 5.6 / 5.6b). The API checks every field. */
export async function saveService(_prev: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  const id = String(formData.get("id") ?? "");
  const values: ServiceFormValues = {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    duration: String(formData.get("duration") ?? ""),
    buffer: String(formData.get("buffer") ?? ""),
    price: String(formData.get("price") ?? "").trim(),
  };

  try {
    await api(id ? `/owner/services/${encodeURIComponent(id)}` : "/owner/services", {
      method: id ? "PUT" : "POST",
      body: values,
    });
  } catch (error) {
    if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
      return { errors: error.fieldErrors, values };
    }
    if (error instanceof ApiError && error.status === 404) return { errors: { form: "This service couldn’t be found." }, values };
    console.error("saveService failed", error);
    return { errors: { form: "Something went wrong and the service wasn’t saved. Please try again." }, values };
  }
  redirect("/owner/services");
}

/** Deactivate (Figma 5.7) or turn a service back on. Existing bookings are untouched. */
export async function setServiceActive(id: string, isActive: boolean): Promise<{ error?: string }> {
  try {
    await api(`/owner/services/${encodeURIComponent(id)}/active`, { method: "PUT", body: { active: isActive } });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return { error: "This service couldn’t be found." };
    console.error("setServiceActive failed", error);
    return { error: "Something went wrong. Please try again." };
  }
  refresh();
  return {};
}
