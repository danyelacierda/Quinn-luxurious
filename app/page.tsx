import { Hero } from "@/components/home/Hero";
import { PromoBanner } from "@/components/home/PromoBanner";
import { FeaturedServices } from "@/components/home/FeaturedServices";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { Testimonials } from "@/components/home/Testimonials";
import { InstagramPreview } from "@/components/home/InstagramPreview";
import { CallToAction } from "@/components/home/CallToAction";

export default function HomePage() {
  return (
    <>
      <PromoBanner />
      <Hero />
      <FeaturedServices />
      <WhyChooseUs />
      <Testimonials />
      <InstagramPreview />
      <CallToAction />
    </>
  );
}
