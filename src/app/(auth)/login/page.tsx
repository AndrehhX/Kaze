import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <>
      <p className="k-label text-primary-ink">Bienvenido de nuevo</p>
      <h1 className="font-display text-title mb-8 mt-2">Iniciar sesión</h1>
      <Suspense fallback={<div className="k-skeleton h-64" />}>
        <LoginForm />
      </Suspense>
    </>
  );
}
