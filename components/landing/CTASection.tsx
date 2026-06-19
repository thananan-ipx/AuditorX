import Link from "next/link"

import { Button } from "@/components/ui/button"

type CTASectionProps = {
  setupHref: string
}

export function CTASection({ setupHref }: CTASectionProps) {
  return (
    <section>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-16 md:flex-row md:items-center md:justify-between">
        <h2 className="max-w-2xl text-3xl font-semibold leading-tight">
          Start auditing your AI-generated code before it becomes technical debt.
        </h2>
        <Button asChild className="h-10 px-4">
          <Link href={setupHref}>Set Up GitHub Action</Link>
        </Button>
      </div>
    </section>
  )
}
