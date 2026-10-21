// Figma "Alert" (2:352): inline message. Icon + text carry the meaning; the tint only
// reinforces it.
import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";

const VARIANTS = {
  success: { icon: CircleCheck, className: "bg-success-tint", iconClass: "text-success" },
  warning: { icon: CircleAlert, className: "bg-warning-tint", iconClass: "text-warning" },
  info: { icon: Info, className: "bg-primary-tint", iconClass: "text-primary" },
};

export function Alert({ variant = "success", title, children, role = "status" }: {
  variant?: keyof typeof VARIANTS;
  title?: string;
  children: ReactNode;
  role?: "status" | "alert";
}) {
  const { icon: Icon, className, iconClass } = VARIANTS[variant];
  return (
    <div role={role} className={`flex items-start gap-3 rounded-md px-4 py-3 text-small text-ink ${className}`}>
      <Icon aria-hidden size={20} className={`shrink-0 ${iconClass}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="font-medium">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
