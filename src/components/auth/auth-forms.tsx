"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { safeRedirectPath, cn } from "@/lib/utils";
import { THEME_IDS, THEMES, type ThemeId } from "@/lib/themes";
import { useSettings } from "@/stores/settings";
import { BackendMissing } from "@/components/social/gate";
import { isSupabaseConfigured } from "@/lib/env";

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(72, "At most 72 characters")
  .regex(/[a-zA-Z]/, "Include a letter")
  .regex(/[0-9]/, "Include a number");

export const registerSchema = z.object({
  username: z.string().trim().regex(/^[a-zA-Z0-9_]{3,24}$/, "3–24 letters, numbers or underscores"),
  displayName: z.string().trim().min(1, "Tell us what to call you").max(48),
  email: z.email("Enter a valid email"),
  password: passwordSchema,
});

function Field({ id, label, error, children, hint }: { id: string; label: string; error?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-err`} className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, invalid }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? "text" : "password"} className="k-input pr-11" value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} aria-invalid={invalid} aria-describedby={invalid ? `${id}-err` : undefined} required />
      <button type="button" className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center text-muted" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function authMessage(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "That email and password don't match.";
  if (/email not confirmed/i.test(msg)) return "Confirm your email first — check your inbox for the link.";
  if (/rate limit|too many/i.test(msg)) return "Too many attempts. Wait a minute and try again.";
  if (/already registered/i.test(msg)) return "An account with this email already exists.";
  return msg;
}

export function LoginForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const next = safeRedirectPath(sp.get("next"), "/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "forgot" | "sent">("login");
  if (!isSupabaseConfigured) return <BackendMissing feature="Sign-in" />;
  const db = getSupabaseBrowser()!;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    if (mode === "forgot") {
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent("/settings/account?reset=1")}` });
      setBusy(false);
      // Same response whether or not the email exists (no account enumeration).
      if (error && /rate limit/i.test(error.message)) setError(authMessage(error.message));
      else setMode("sent");
      return;
    }
    const { error } = await db.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(authMessage(error.message));
    toast.success("Welcome back");
    router.replace(next);
    router.refresh();
  };

  if (mode === "sent")
    return (
      <div className="text-center">
        <MailCheck className="mx-auto size-10 text-primary-ink" aria-hidden />
        <h2 className="font-display mt-4 text-xl">Check your inbox</h2>
        <p className="mt-2 text-sm text-muted">If an account exists for {email}, a reset link is on its way.</p>
        <button className="k-btn k-btn-ghost k-btn-sm mt-6" onClick={() => setMode("login")}>Back to sign in</button>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field id="email" label="Email">
        <input id="email" type="email" className="k-input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      {mode === "login" && (
        <Field id="password" label="Password">
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </Field>
      )}
      {error && (
        <p className="rounded-[var(--k-radius-btn)] bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <button className="k-btn k-btn-primary w-full !min-h-12" disabled={busy || !email || (mode === "login" && !password)}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {mode === "login" ? "Sign in" : "Send reset link"}
      </button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-primary-ink hover:underline" onClick={() => (setMode(mode === "login" ? "forgot" : "login"), setError(""))}>
          {mode === "login" ? "Forgot password?" : "Back to sign in"}
        </button>
        <Link href={`/register${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-muted hover:text-fg">
          New here? Create an account
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const [form, setForm] = useState({ username: "", displayName: "", email: "", password: "" });
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (!isSupabaseConfigured) return <BackendMissing feature="Accounts" />;
  const db = getSupabaseBrowser()!;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    setBusy(true);
    const { data: taken } = await db.from("profiles").select("id").ilike("username", parsed.data.username).maybeSingle();
    if (taken) {
      setBusy(false);
      return setErrors({ username: "That username is taken" });
    }
    const { data: signUpData, error } = await db.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=/`,
        data: { username: parsed.data.username, display_name: parsed.data.displayName, theme },
      },
    });
    setBusy(false);
    if (error) return setErrors({ form: authMessage(error.message) });
    if (signUpData?.session) {
      window.location.href = "/";
      return;
    }
    setDone(true);
  };

  if (done)
    return (
      <div className="text-center">
        <MailCheck className="mx-auto size-10 text-primary-ink" aria-hidden />
        <h2 className="font-display mt-4 text-xl">Confirm your email</h2>
        <p className="mt-2 text-sm text-muted">We sent a verification link to {form.email}. Open it on this device to finish creating your universe.</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="username" label="Username" error={errors.username} hint="Your profile lives at /profile/username">
          <input id="username" className="k-input" autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} aria-invalid={Boolean(errors.username)} />
        </Field>
        <Field id="displayName" label="Display name" error={errors.displayName}>
          <input id="displayName" className="k-input" autoComplete="nickname" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} aria-invalid={Boolean(errors.displayName)} />
        </Field>
      </div>
      <Field id="email" label="Email" error={errors.email}>
        <input id="email" type="email" className="k-input" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={Boolean(errors.email)} />
      </Field>
      <Field id="password" label="Password" error={errors.password} hint="8+ characters with a letter and a number">
        <PasswordInput id="password" value={form.password} onChange={(password) => setForm({ ...form, password })} autoComplete="new-password" invalid={Boolean(errors.password)} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Choose your universe</legend>
        <div className="grid grid-cols-2 gap-2">
          {THEME_IDS.map((id: ThemeId) => (
            <button key={id} type="button" onClick={() => setTheme(id)} aria-pressed={theme === id} className={cn("k-card flex items-center gap-2 p-2.5 text-left text-xs font-semibold", theme === id && "ring-2 ring-primary")}>
              <span className="flex -space-x-1">
                {THEMES[id].swatches.slice(0, 3).map((c) => (
                  <span key={c} className="size-4 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                ))}
              </span>
              {THEMES[id].name}
            </button>
          ))}
        </div>
      </fieldset>
      {errors.form && <p className="rounded-[var(--k-radius-btn)] bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{errors.form}</p>}
      <button className="k-btn k-btn-primary w-full !min-h-12" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Create account
      </button>
      <p className="text-center text-sm text-muted">
        Already have one?{" "}
        <Link href="/login" className="font-semibold text-primary-ink">
          Sign in
        </Link>
      </p>
      <p className="text-center text-xs text-muted">Your KAZE account is separate from AniList. You can connect AniList later in Settings.</p>
    </form>
  );
}
