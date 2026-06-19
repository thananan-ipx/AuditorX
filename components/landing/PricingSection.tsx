const prices = [
  ["Free trial", "For early teams testing AuditorX on real PRs."],
  ["3,900 THB / repo / month", "Early access pricing for active repositories."],
  ["Custom audit service by IPX", "Hands-on technical debt review for priority repos."],
]

export function PricingSection() {
  return (
    <section className="border-b bg-muted/35">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-semibold">Pricing</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {prices.map(([title, copy]) => (
            <div key={title} className="rounded-lg border bg-background p-5">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
