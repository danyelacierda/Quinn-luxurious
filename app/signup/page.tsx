import Link from "next/link";
import { PageHero } from "@/components/shared/PageHero";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <>
      <PageHero
        eyebrow="Join Us"
        title="Create Your Account"
        description="Book faster and manage your appointments anytime."
      />

      <section className="section-padding bg-paper">
        <div className="container flex justify-center">
          <div className="w-full max-w-md rounded-4xl bg-cream p-10 shadow-card">
            <SignupForm />
            <p className="mt-6 text-center text-sm text-ink-soft">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-gold-dark hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
