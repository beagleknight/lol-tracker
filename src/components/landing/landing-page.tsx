import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingScreenshots } from "@/components/landing/landing-screenshots";
import { LandingSecondary } from "@/components/landing/landing-secondary";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingScreenshots />
        <LandingSecondary />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
