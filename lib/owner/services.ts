// Data for the owner Services screens (Figma 5.5–5.7), from the API's /owner/services.
// The API checks what's saved; these lists only fill the form's drop-downs.
import "server-only";
import type { OwnerService, OwnerServiceDetail, ServiceBarber } from "@api/owner";
import { api, apiOrNotFound } from "@/lib/api/client";

export const DURATION_OPTIONS = [15, 20, 30, 45, 60, 75, 90, 120];
export const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30];

export function listServices() {
  return api<OwnerService[]>("/owner/services");
}

export function getService(id: string) {
  return apiOrNotFound<OwnerServiceDetail>(`/owner/services/${encodeURIComponent(id)}`);
}

/** Active barbers for the Add service form (none ticked). */
export function listServiceBarbers() {
  return api<ServiceBarber[]>("/owner/services/barbers");
}
