"use client";

import { useActionState } from "react";
import { login } from "@/app/admin/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="mx-auto max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6">
      <h1 className="text-xl font-black">ورود به پنل مدیریت</h1>
      <label className="block space-y-2">
        <span className="text-sm text-muted">رمز عبور</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          dir="ltr"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2"
        />
      </label>
      {state?.error && <p className="text-sm font-semibold text-accent">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-brand py-2.5 font-bold text-white disabled:opacity-60">
        {pending ? "در حال ورود…" : "ورود"}
      </button>
    </form>
  );
}
