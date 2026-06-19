import Link from "next/link"

import { Button } from "@/components/ui/button"
import { WaitlistForm } from "@/components/landing/WaitlistForm"

type HeroSectionProps = {
  installUrl: string
}

export function HeroSection({ installUrl }: HeroSectionProps) {
  return (
    <section className="border-b bg-[linear-gradient(180deg,rgba(5,150,105,0.08),rgba(255,255,255,0))]">
      <div className="mx-auto grid min-h-[88svh] max-w-6xl gap-10 px-6 py-8 md:grid-cols-[1fr_0.88fr] md:items-center md:py-12">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
            AuditorX for pull requests
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
            Find hidden technical debt in AI-written code.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            AuditorX reviews every pull request and catches code smells,
            architecture risks, and maintainability issues before they reach
            production.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-10 px-4">
              <Link href={installUrl}>Install GitHub App</Link>
            </Button>
            <Button asChild className="h-10 px-4" variant="outline">
              <Link href="#waitlist">Join Early Access</Link>
            </Button>
          </div>
        </div>
        <div id="waitlist" className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Early access</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Tell us where AuditorX should review first. We will use this for
              MVP onboarding only.
            </p>
          </div>
          <WaitlistForm />
        </div>
      </div>
    </section>
  )
}
