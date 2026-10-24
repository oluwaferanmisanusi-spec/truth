// Log in (Figma 3.1), and during booking with the hold still counting down (3.1b).
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StepBar } from "@/components/shop/bars";
import { HoldTimer } from "@/components/shop/hold-timer";
import { Alert } from "@/components/alert";
import { getAccount, safeNext } from "@/lib/auth/customer";
import { getActiveHold } from "../hold";
import { LoginForm } from "../forms";
import { Intro } from "../intro";

type Props = PageProps<"/login">;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function LoginPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<StepBar title="Log in" back="/" />}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}

async function Login({ searchParams }: Pick<Props, "searchParams">) {
  const query = await searchParams;
  const next = one(query.next);
  const hold = await getActiveHold(one(query.hold));
  const account = await getAccount();
  if (account?.role === "barber") redirect("/barber");
  if (account) redirect(hold ? `/booking/${hold.id}` : safeNext(next));

  const carry = hold ? `?hold=${hold.id}` : next ? `?next=${encodeURIComponent(safeNext(next))}` : "";
  return (
    <>
      <StepBar title="Log in" back={hold ? `/booking/${hold.id}` : "/"} />
      <main className="flex flex-col gap-6 px-4 py-6">
        {hold && <HoldTimer secondsLeft={hold.holdSecondsLeft} />}
        {one(query.verified) && (
          <Alert variant="success" title="Email verified">Log in to see your bookings.</Alert>
        )}
        <Intro title="Welcome back">
          {hold ? "Log in to finish your booking. Your details will fill in for you." : "Log in to see and manage your bookings."}
        </Intro>
        <LoginForm
          next={next ? safeNext(next) : undefined}
          hold={hold?.id}
          links={{ forgot: "/forgot-password", signup: `/signup${carry}` }}
        />
      </main>
    </>
  );
}
