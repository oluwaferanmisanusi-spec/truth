// Barber screens are designed at phone width (Figma 4.x); on larger screens they sit in a centred column.
export default function BarberLayout({ children }: LayoutProps<"/barber">) {
  return <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">{children}</div>;
}
