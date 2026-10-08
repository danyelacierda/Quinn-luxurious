import { PageHero } from "@/components/shared/PageHero";
import { SignUp } from "@clerk/nextjs";

export default function SignupPage() {
  return (
    <>
      <PageHero eyebrow="Join Us" title="Create Your Account" description="Book faster and manage your appointments anytime." />
      <section className="section-padding bg-paper">
        <div className="container flex justify-center">
          <div className="w-full max-w-md rounded-4xl bg-cream p-10 shadow-card flex justify-center">
            <SignUp />
          </div>
        </div>
      </section>
    </>
  );
}
