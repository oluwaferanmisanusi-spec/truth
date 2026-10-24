// A barber the owner has deactivated, still logged in from before. Login turns them away
// too; this catches an open session.
import type { Metadata } from "next";
import { CircleAlert } from "lucide-react";
import { LogoutButton } from "@/components/shop/logout-button";
import { StatusHero } from "@/components/shop/status-hero";
import { logOut } from "../actions";

export const metadata: Metadata = { title: "Account not active" };

export default function InactiveBarberPage() {
  return (
    <main className="flex flex-col items-center gap-6 px-4 pt-10 pb-6">
      <StatusHero icon={CircleAlert} tone="warning" title="Your barber account isn’t active">
        The shop owner has turned off your account, so your schedule isn’t available. Ask them if you think this is a
        mistake.
      </StatusHero>
      <LogoutButton action={logOut} message="You can log in again if the shop owner turns your account back on." />
    </main>
  );
}
