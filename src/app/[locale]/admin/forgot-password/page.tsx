import { setRequestLocale } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/admin/ForgotPasswordForm";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      <ForgotPasswordForm />
    </div>
  );
}
