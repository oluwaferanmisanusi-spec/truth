import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset your password" };

// Figma 5.0b Forgot password (13:6551) and 5.0c Reset link sent (13:6578).
export default function OwnerForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
