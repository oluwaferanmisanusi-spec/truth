// Create an account (Figma 3.2), and during booking (3.2b).
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StepBar } from "@/components/shop/bars";
import { HoldTimer } from "@/components/shop/hold-timer";
import { getAccount, safeNext } from "@/lib/auth/customer";
import { getActiveHold } from "../hold";
import { SignupForm } from "../forms";
import { Intro } from "../intro";

type Props = PageProps<"/signup">;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function SignupPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<StepBar title="Create an account" back="/" />}>
      <Signup searchParams={searchParams} />
    </Suspense>
  );
}

async function Signup({ searchParams }: Pick<Props, "searchParams">) {
  const query = await searchParams;
  const next = one(query.next);
  const hold = await getActiveHold(one(query.hold));
  if (await getAccount()) redirect(hold ? `/booking/${hold.id}` : safeNext(next));

  const carry = hold ? `?hold=${hold.id}` : next ? `?next=${encodeURIComponent(safeNext(next))}` : "";
  return (
    <>
      <StepBar title="Create an account" back={hold ? `/booking/${hold.id}` : "/"} />
      <main className="flex flex-col gap-6 px-4 py-6">
        {hold && <HoldTimer secondsLeft={hold.holdSecondsLeft} />}
        <Intro title="Create an account">
          {hold
            ? "Create an account to finish your booking. We’ll email you a link to verify your address."
            : "See all your bookings in one place and book faster next time."}
        </Intro>
        <SignupForm next={next ? safeNext(next) : undefined} hold={hold?.id} loginHref={`/login${carry}`} />
      </main>
    </>
  );
}
