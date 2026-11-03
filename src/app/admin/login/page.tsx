import { adminConfigured } from "@/lib/admin/auth";
import { LoginForm } from "@/components/admin/LoginForm";

export default function LoginPage() {
  if (!adminConfigured()) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-line bg-surface p-6 leading-8">
        پنل مدیریت هنوز فعال نشده است. مقدارهای <bdi dir="ltr">ADMIN_PASSWORD</bdi> و{" "}
        <bdi dir="ltr">SUPABASE_SERVICE_ROLE_KEY</bdi> باید در Vercel تنظیم شوند. رمز باید دست‌کم ۱۲ حرف باشد.
      </div>
    );
  }
  return <LoginForm />;
}
