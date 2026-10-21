// Customer screens are designed at phone width; on larger screens they sit in a centred column.
export default function ShopLayout({ children }: LayoutProps<"/">) {
  return <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">{children}</div>;
}
