import Link from "next/link";
import { XCircle, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/shared/PageHero";

export default function AppointmentCancelledPage() {
  return (
    <>
      <PageHero
        eyebrow="Payment Notice"
        title="Checkout Cancelled"
        description="Your Stripe checkout session was not completed."
      />

      <section className="section-padding bg-paper">
        <div className="container flex justify-center">
          <div className="w-full max-w-lg">
            <Card className="p-8 text-center sm:p-10 shadow-card rounded-3xl border-rose-dark/20">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose/20 text-rose-dark ring-4 ring-rose/10">
                <XCircle className="h-8 w-8 stroke-[2]" />
              </span>

              <h2 className="mt-6 font-display text-2xl font-semibold text-ink">
                No Payment Was Charged
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                You cancelled the Stripe test payment session. Your card was not charged and the appointment slot was not finalized. You can try again or choose to pay at the salon upon arrival.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button asChild className="w-full sm:w-auto shadow-gold">
                  <Link href="/appointment">
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Book Again
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/account">Go to My Account</Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
