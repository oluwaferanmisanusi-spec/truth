import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeader } from "@/components/owner/page-header";
import { shopToday } from "@/lib/format";
import { getShopSettings, TIME_ZONES } from "@/lib/owner/settings";
import { ShopSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Shop settings" };

// Figma 5.12 Shop settings (7:5082) and 5.12b–5.12g.
export default function ShopSettingsPage() {
  return (
    <>
      <PageHeader
        title="Shop settings"
        description="Opening hours, time zone and holidays. Customers can only book inside these."
      />
      <Suspense fallback={<p className="text-small text-ink-muted">Loading settings…</p>}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  await connection(); // "today" for the holiday date picker
  const settings = await getShopSettings();
  return (
    <ShopSettingsForm
      hours={settings.hours}
      timeZone={settings.timeZone}
      timeZones={TIME_ZONES}
      holidays={settings.holidays}
      today={shopToday()}
    />
  );
}
