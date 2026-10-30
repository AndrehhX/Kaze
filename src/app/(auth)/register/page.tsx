import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <p className="k-label text-primary-ink">Begin your universe</p>
      <h1 className="font-display text-title mb-8 mt-2">Create an account</h1>
      <RegisterForm />
    </>
  );
}
