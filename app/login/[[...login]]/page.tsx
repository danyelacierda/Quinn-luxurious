import { PageHero } from "@/components/shared/PageHero";
import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <>
      <PageHero eyebrow="Welcome Back" title="Sign In" description="Access your appointments and account details." />
      <section className="section-padding bg-paper">
        <div className="container flex justify-center">
          <div className="w-full max-w-md rounded-4xl bg-cream p-10 shadow-card flex justify-center">
            <SignIn />
          </div>
        </div>
      </section>
    </>
  );
}
