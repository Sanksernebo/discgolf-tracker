import { setRequestLocale } from "next-intl/server";
import { isResetTokenValid } from "@/lib/password-reset";
import { ResetPasswordForm } from "@/components/admin/ResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const tokenStr = typeof token === "string" ? token : "";
  const valid = tokenStr ? await isResetTokenValid(tokenStr) : false;

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      <ResetPasswordForm token={valid ? tokenStr : null} />
    </div>
  );
}
