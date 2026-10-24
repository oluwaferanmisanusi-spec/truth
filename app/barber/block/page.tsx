// Block time (Figma 4.11 part of a day, 4.11b whole days, 4.12 / 4.12b overlap errors).
import type { Metadata } from "next";
import { Suspense } from "react";
import type { ShopHours } from "@api/barber";
import { StepBar } from "@/components/shop/bars";
import { api } from "@/lib/api/client";
import { requireBarber } from "@/lib/auth/barber";
import { isIsoDate, shopToday } from "@/lib/format";
import { BlockForm } from "./block-form";

export const metadata: Metadata = { title: "Block time" };

type Props = PageProps<"/barber/block">;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function BlockTimePage({ searchParams }: Props) {
  return (
    <Suspense fallback={<StepBar title="Block time" back="/barber" />}>
      <BlockTime searchParams={searchParams} />
    </Suspense>
  );
}

async function BlockTime({ searchParams }: Pick<Props, "searchParams">) {
  const [, query] = await Promise.all([requireBarber("/barber/block"), searchParams]);
  const today = shopToday();
  const asked = one(query.date);
  // The day the barber came from; a past day starts the form on today instead.
  const back = isIsoDate(asked) ? asked : today;
  const start = back < today ? today : back;
  const hours = await api<ShopHours>("/barber/shop-hours");

  return (
    <>
      <StepBar title="Block time" back={`/barber?date=${back}`} />
      <BlockForm back={back} start={start} today={today} hours={hours} />
    </>
  );
}
