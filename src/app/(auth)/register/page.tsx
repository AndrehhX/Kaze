import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <>
      <p className="k-label text-primary-ink">Empieza tu universo</p>
      <h1 className="font-display text-title mb-8 mt-2">Crear una cuenta</h1>
      <Suspense fallback={<div className="k-skeleton h-64" />}>
        <RegisterForm />
      </Suspense>
    </>
  );
}
