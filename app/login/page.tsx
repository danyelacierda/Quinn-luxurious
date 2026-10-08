import Link from "next/link";
import { PageHero } from "@/components/shared/PageHero";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <>
      <PageHero eyebrow="Welcome Back" title="Sign In" description="Access your appointments and account details." />

      <section className="section-padding bg-paper">
        <div className="container flex justify-center">
          <div className="w-full max-w-md rounded-4xl bg-cream p-10 shadow-card">
            <LoginForm />
            <p className="mt-6 text-center text-sm text-ink-soft">
              Don&rsquo;t have an account?{" "}
              <Link href="/signup" className="font-medium text-gold-dark hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
