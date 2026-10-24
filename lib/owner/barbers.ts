// Data for the owner Barbers screens (Figma 5.8–5.11), from the API's /owner/barbers.
import "server-only";
import type { OwnerBarberDetail, OwnerBarbers } from "@api/owner";
import { api, apiOrNotFound } from "@/lib/api/client";

export function listBarbers() {
  return api<OwnerBarbers>("/owner/barbers");
}

export function getBarber(id: string) {
  return apiOrNotFound<OwnerBarberDetail>(`/owner/barbers/${encodeURIComponent(id)}`);
}
