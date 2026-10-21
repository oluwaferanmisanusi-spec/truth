// Forgot password (Figma 3.3) and Reset link sent (3.4).
import { StepBar } from "@/components/shop/bars";
import { ForgotForm } from "../forms";

export default function ForgotPasswordPage() {
  return (
    <>
      <StepBar title="Reset password" back="/login" />
      <main className="px-4 py-6">
        <ForgotForm />
      </main>
    </>
  );
}
