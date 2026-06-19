const steps = [
  "Add the AuditorX workflow",
  "Open a pull request",
  "GitHub Actions sends the diff",
  "Get an AI audit comment before merge",
]

export function HowItWorksSection() {
  return (
    <section className="border-b bg-muted/35">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-semibold">How it works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step} className="rounded-lg border bg-background p-4">
              <div className="mb-4 flex size-8 items-center justify-center rounded-full bg-emerald-700 text-sm font-semibold text-white">
                {index + 1}
              </div>
              <p className="text-sm font-medium leading-6">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
