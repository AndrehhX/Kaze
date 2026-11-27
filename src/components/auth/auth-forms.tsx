"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleCheck, Eye, EyeOff, Loader2, MailCheck, MailWarning } from "lucide-react";
import { useEffect, useState } from "react";
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
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede exceder 72 caracteres")
  .regex(/[a-zA-Z]/, "Debe incluir al menos una letra")
  .regex(/[0-9]/, "Debe incluir al menos un número");

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "El usuario debe tener entre 3 y 24 caracteres")
      .max(24, "El usuario debe tener entre 3 y 24 caracteres")
      .regex(/^[a-zA-Z0-9_]+$/, "Solo se permiten letras, números y guiones bajos (_)"),
    displayName: z
      .string()
      .trim()
      .min(2, "Ingresa un nombre de al menos 2 caracteres")
      .max(48, "El nombre no puede exceder 48 caracteres"),
    email: z
      .string()
      .trim()
      .min(5, "El correo electrónico es obligatorio")
      .email("Ingresa un correo electrónico válido"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirma tu contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
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
      <button type="button" className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center text-muted" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/** Logo oficial de Google (4 colores), como piden sus normas de marca. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Entrar o crear cuenta con Google en un toque (vuelve por /auth/callback ya con la sesión iniciada). */
function GoogleButton({ next, label }: { next: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    const db = getSupabaseBrowser();
    if (!db) return;
    setBusy(true);
    const { error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setBusy(false);
      toast.error(/provider is not enabled|unsupported provider/i.test(error.message) ? "El acceso con Google todavía no está disponible." : authMessage(error.message));
    }
  };
  return (
    <>
      <button type="button" onClick={go} disabled={busy} className="k-btn w-full !min-h-12 gap-3 border border-line bg-white font-semibold text-[#1f1f1f] hover:bg-white/90">
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <GoogleLogo />}
        {label}
      </button>
      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" /> o con tu correo <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

function authMessage(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "El correo o la contraseña son incorrectos.";
  if (/email not confirmed/i.test(msg)) return "Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada o spam para el enlace de activación.";
  if (/rate limit|too many/i.test(msg)) return "Demasiados intentos. Espera un momento y vuelve a intentarlo.";
  if (/already registered/i.test(msg)) return "Ya existe una cuenta registrada con este correo electrónico.";
  if (/user already exists/i.test(msg)) return "Este usuario o correo ya se encuentra registrado.";
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
  // Vuelta desde un correo de Supabase (verificar cuenta, enlace mágico…). Supabase puede devolver
  // aquí en vez de /auth/callback, con ?code=… o #access_token=… si salió bien, o #error_code=… si no.
  const [linkIssue, setLinkIssue] = useState<null | "expired" | "other-device">(null);
  const [confirming, setConfirming] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const client = getSupabaseBrowser()!;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const qs = new URLSearchParams(window.location.search);
    const clean = () => window.history.replaceState(null, "", window.location.pathname);
    const welcome = () => {
      toast.success("¡Cuenta confirmada! Bienvenido a Orunei");
      router.replace(next);
      router.refresh();
    };
    const expired = Boolean(hash.get("error_code") || hash.get("error") || qs.get("error_code") || qs.get("error") === "link");
    const code = qs.get("code");
    const cameFromEmail = Boolean(code || hash.get("access_token"));
    void (async () => {
      await Promise.resolve();
      if (expired) {
        setLinkIssue("expired");
        clean();
        return;
      }
      if (cameFromEmail) setConfirming(true);
      // getSession espera a que el cliente procese la URL (el enlace ya inicia sesión si es de este navegador).
      const { data } = await client.auth.getSession();
      if (data.session) {
        setConfirming(false);
        if (cameFromEmail) { clean(); welcome(); } else router.replace(next);
        return;
      }
      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        setConfirming(false);
        clean();
        if (!error) return welcome();
        // Abierto en otro dispositivo o navegador: el correo SÍ quedó confirmado, solo falta entrar.
        setLinkIssue("other-device");
        return;
      }
      setConfirming(false);
    })();
    // Solo al abrir la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isSupabaseConfigured) return <BackendMissing feature="Inicio de sesión" />;
  const db = getSupabaseBrowser()!;

  const resend = async () => {
    if (!email) return setError("Escribe tu correo para enviarte un enlace nuevo.");
    setError("");
    setResending(true);
    const { error } = await db.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${location.origin}/auth/callback?next=/` } });
    setResending(false);
    if (error && /rate limit|too many|security purposes/i.test(error.message)) return setError("Espera un minuto antes de pedir otro enlace.");
    if (error && /already confirmed|confirmed/i.test(error.message)) {
      setLinkIssue("other-device");
      return;
    }
    toast.success("Te enviamos un enlace nuevo. Ábrelo desde este mismo navegador.");
  };

  if (confirming)
    return (
      <div className="py-10 text-center">
        <Loader2 className="mx-auto size-8 animate-spin text-primary" aria-hidden />
        <p className="mt-4 text-sm text-muted">Confirmando tu cuenta…</p>
      </div>
    );

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
    toast.success("Bienvenido de nuevo");
    router.replace(next);
    router.refresh();
  };

  if (mode === "sent")
    return (
      <div className="text-center">
        <MailCheck className="mx-auto size-10 text-primary-ink" aria-hidden />
        <h2 className="font-display mt-4 text-xl">Revisa tu correo</h2>
        <p className="mt-2 text-sm text-muted">Si existe una cuenta con {email}, te llegará un enlace para cambiar tu contraseña.</p>
        <button className="k-btn k-btn-ghost k-btn-sm mt-6" onClick={() => setMode("login")}>Volver a iniciar sesión</button>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {linkIssue === "expired" && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm" role="status">
          <p className="flex items-center gap-2 font-semibold text-fg">
            <MailWarning className="size-4 shrink-0 text-primary-ink" aria-hidden /> Ese enlace ya caducó o ya se usó
          </p>
          <p className="mt-1 text-muted">
            Pasa cuando el correo tarda en abrirse o cuando tu bandeja revisa el enlace antes que tú. Escribe tu correo y te mandamos uno nuevo.
          </p>
          <button type="button" className="k-btn k-btn-primary k-btn-sm mt-3" onClick={resend} disabled={resending}>
            {resending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Enviar un enlace nuevo
          </button>
          <p className="mt-2 text-xs text-muted">¿Era para cambiar tu contraseña? Usa «¿Olvidaste tu contraseña?» abajo.</p>
        </div>
      )}
      {linkIssue === "other-device" && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm" role="status">
          <p className="flex items-center gap-2 font-semibold text-fg">
            <CircleCheck className="size-4 shrink-0 text-success" aria-hidden /> Tu correo ya está confirmado
          </p>
          <p className="mt-1 text-muted">Abriste el enlace en otro navegador o dispositivo. Entra aquí con tu correo y contraseña.</p>
        </div>
      )}
      {mode === "login" && <GoogleButton next={next} label="Continuar con Google" />}
      <Field id="email" label="Correo electrónico">
        <input id="email" type="email" className="k-input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      {mode === "login" && (
        <Field id="password" label="Contraseña">
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
        {mode === "login" ? "Iniciar sesión" : "Enviar enlace de recuperación"}
      </button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-primary-ink hover:underline" onClick={() => (setMode(mode === "login" ? "forgot" : "login"), setError(""))}>
          {mode === "login" ? "¿Olvidaste tu contraseña?" : "Volver a iniciar sesión"}
        </button>
        <Link href={`/register${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-muted hover:text-fg">
          ¿Eres nuevo? Crea una cuenta
        </Link>
      </div>
    </form>
  );
}

const COMMON_TYPO_DOMAINS: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahou.com": "yahoo.com",
};

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "tempmail.com", "temp-mail.org", "10minutemail.com", "guerrillamail.com", "guerrillamail.net",
  "guerrillamail.org", "guerrillamailblock.com", "sharklasers.com", "grr.la", "pokemail.net",
  "yopmail.com", "yopmail.fr", "yopmail.net", "cool.fr.nf", "jetable.fr.nf",
  "mailinator.com", "trashmail.com", "trashmail.net", "dispostable.com", "getairmail.com",
  "mohmal.com", "inboxkitten.com", "burnermail.io", "crazymailing.com", "throwawaymail.com",
  "fakeinbox.com", "nada.ltd", "getnada.com", "abcvg.com", "dropmail.me"
]);

export function RegisterForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const next = safeRedirectPath(sp.get("next"), "/");
  const [form, setForm] = useState({ username: "", displayName: "", email: "", password: "", confirmPassword: "" });
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (!isSupabaseConfigured) return <BackendMissing feature="Cuentas" />;
  const db = getSupabaseBrowser()!;

  const isFormIncomplete =
    !form.username.trim() ||
    !form.displayName.trim() ||
    !form.email.trim() ||
    !form.password ||
    !form.confirmPassword;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});

    const domain = parsed.data.email.split("@")[1]?.toLowerCase();
    if (domain && COMMON_TYPO_DOMAINS[domain]) {
      return setErrors({ email: `¿Quisiste escribir @${COMMON_TYPO_DOMAINS[domain]}? Revisa tu correo.` });
    }
    if (domain && DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      return setErrors({ email: "No se permiten correos temporales ni desechables. Usa un correo real (Gmail, Outlook, etc.)." });
    }

    setBusy(true);

    const { data: taken } = await db.from("profiles").select("id").ilike("username", parsed.data.username).maybeSingle();
    if (taken) {
      setBusy(false);
      return setErrors({ username: "Ese nombre de usuario ya está en uso. Elige otro." });
    }

    const { data: signUpData, error } = await db.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: { username: parsed.data.username, display_name: parsed.data.displayName, theme },
      },
    });

    if (error) {
      setBusy(false);
      return setErrors({ form: authMessage(error.message) });
    }

    // Si Supabase devuelve sesión activa directa (cuando confirmación está desactivada)
    if (signUpData?.session) {
      setBusy(false);
      toast.success("¡Bienvenido a Orunei! Tu cuenta fue creada exitosamente.");
      router.replace(next);
      router.refresh();
      return;
    }

    // Al requerir confirmación por correo (vía Brevo SMTP), mostramos la pantalla de activación
    setBusy(false);
    setDone(true);
  };

  if (done)
    return (
      <div className="rounded-2xl border border-line bg-surface/60 p-6 text-center shadow-lg">
        <MailCheck className="mx-auto size-12 text-primary" aria-hidden />
        <h2 className="font-display mt-4 text-2xl font-bold">Confirma tu correo electrónico</h2>
        <p className="mt-3 text-sm text-muted max-w-sm mx-auto">
          Hemos enviado un enlace de confirmación a <strong className="text-fg">{form.email}</strong>.
        </p>
        <div className="mt-5 rounded-xl border border-line/60 bg-elevated/40 p-4 text-xs text-muted text-left space-y-2">
          <p className="font-semibold text-fg">Pasos para activar tu cuenta:</p>
          <p>1. Revisa tu bandeja de entrada (o carpeta de <strong>Spam / Correo no deseado</strong>).</p>
          <p>2. Haz clic en el enlace de verificación recibido.</p>
          <p>3. Al tocarlo entrarás directo a Orunei, sin volver a iniciar sesión (ábrelo en este mismo navegador).</p>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/login" className="k-btn k-btn-primary w-full !min-h-11 font-semibold">
            Ir a Iniciar Sesión
          </Link>
        </div>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <GoogleButton next={next} label="Crear cuenta con Google" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="username" label="Nombre de usuario" error={errors.username} hint="Tu perfil vivirá en /profile/tu_usuario">
          <input
            id="username"
            className="k-input"
            autoComplete="username"
            placeholder="ej. kirito_kun"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            aria-invalid={Boolean(errors.username)}
            required
          />
        </Field>
        <Field id="displayName" label="Nombre a mostrar" error={errors.displayName} hint="¿Cómo quieres que te llamen?">
          <input
            id="displayName"
            className="k-input"
            autoComplete="nickname"
            placeholder="ej. Kazuto"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            aria-invalid={Boolean(errors.displayName)}
            required
          />
        </Field>
      </div>

      <Field id="email" label="Correo electrónico" error={errors.email} hint="Te enviaremos un enlace de confirmación obligatorio">
        <input
          id="email"
          type="email"
          className="k-input"
          autoComplete="email"
          placeholder="tu@correo.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          aria-invalid={Boolean(errors.email)}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="password" label="Contraseña" error={errors.password} hint="Mínimo 8 caracteres (letras y números)">
          <PasswordInput
            id="password"
            value={form.password}
            onChange={(password) => setForm({ ...form, password })}
            autoComplete="new-password"
            invalid={Boolean(errors.password)}
          />
        </Field>
        <Field id="confirmPassword" label="Confirmar contraseña" error={errors.confirmPassword} hint="Repite tu contraseña exactamente">
          <PasswordInput
            id="confirmPassword"
            value={form.confirmPassword}
            onChange={(confirmPassword) => setForm({ ...form, confirmPassword })}
            autoComplete="new-password"
            invalid={Boolean(errors.confirmPassword)}
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Elige tu tema inicial</legend>
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

      <button className="k-btn k-btn-primary w-full !min-h-12 font-semibold" disabled={busy || isFormIncomplete}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {isFormIncomplete ? "Rellena todos los campos" : "Crear cuenta gratuita"}
      </button>

      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-primary-ink hover:underline">
          Inicia sesión
        </Link>
      </p>
      <p className="text-center text-xs text-muted">Tu cuenta de Orunei es independiente de AniList. Puedes vincularla después en Ajustes.</p>
    </form>
  );
}
