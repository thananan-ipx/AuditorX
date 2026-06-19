const risks = [
  "Duplicated business logic",
  "God components",
  "God services",
  "Unsafe patterns",
  "N+1 queries",
  "Unclear architecture",
]

export function ProblemSection() {
  return (
    <section className="border-b">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold">The problem</h2>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            AI coding tools help teams ship faster, but they also create
            invisible technical debt: duplicated logic, oversized components,
            scattered business rules, and risky architecture decisions.
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {risks.map((risk) => (
            <div key={risk} className="rounded-lg border bg-card p-4 text-sm font-medium">
              {risk}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
