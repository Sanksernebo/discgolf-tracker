import { setRequestLocale } from "next-intl/server";
import { isAdmin } from "@/lib/admin";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const authed = await isAdmin();

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      {authed ? <AdminDashboard /> : <AdminLogin />}
    </div>
  );
}
