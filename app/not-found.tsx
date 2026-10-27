// Any page or link that doesn't exist (no Figma screen): the shop's own look and a way back,
// instead of Next.js's plain 404. Also shown for a mistyped or cut-off emailed link.
import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { BrandBar, BottomBar } from "@/components/shop/bars";
import { StatusHero } from "@/components/shop/status-hero";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <BrandBar />
      <main className="flex flex-1 flex-col">
        <div className="flex flex-col gap-6 px-4 pt-10 pb-6">
          <StatusHero icon={SearchX} tone="warning" title="We can’t find that page">
            The link may be mistyped or cut short. If it came from one of our emails, try opening it again from the
            email.
          </StatusHero>
        </div>
        <div className="mt-auto">
          <BottomBar>
            <Link href="/" className={`${buttonClass.primary} w-full`}>Back to home</Link>
          </BottomBar>
        </div>
      </main>
    </div>
  );
}
