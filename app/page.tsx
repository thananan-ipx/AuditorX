import { CTASection } from "@/components/landing/CTASection"
import { ExampleReviewSection } from "@/components/landing/ExampleReviewSection"
import { GitHubActionSection } from "@/components/landing/GitHubActionSection"
import { HeroSection } from "@/components/landing/HeroSection"
import { HowItWorksSection } from "@/components/landing/HowItWorksSection"
import { PricingSection } from "@/components/landing/PricingSection"
import { ProblemSection } from "@/components/landing/ProblemSection"
import { validateServerEnv } from "@/lib/env"

export default function Page() {
  const env = validateServerEnv()
  const setupHref = "#github-action"

  return (
    <main className="min-h-svh">
      {!env.ok ? (
        <div className="border-b border-amber-300 bg-amber-50 px-6 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Environment setup pending: {env.missing.join(", ")}
        </div>
      ) : null}
      <HeroSection setupHref={setupHref} />
      <ProblemSection />
      <HowItWorksSection />
      <ExampleReviewSection />
      <GitHubActionSection />
      <PricingSection />
      <CTASection setupHref={setupHref} />
    </main>
  )
}
