export function ExampleReviewSection() {
  return (
    <section className="border-b">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-[0.7fr_1fr] md:items-start">
        <div>
          <h2 className="text-3xl font-semibold">Example review</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            AuditorX posts one practical PR comment focused on risk, not lint
            noise.
          </p>
        </div>
        <article className="rounded-lg border bg-card p-5 font-mono text-sm leading-7 shadow-sm">
          <h3 className="font-sans text-lg font-semibold">AuditorX Review</h3>
          <p className="mt-3">
            <strong>AI Smell Score:</strong> 72/100
            <br />
            <strong>Risk Level:</strong> Medium
          </p>
          <p className="mt-4 text-muted-foreground">
            This PR is mostly safe but introduces maintainability risks in the
            user service layer.
          </p>
          <h4 className="mt-5 font-sans font-semibold">Findings</h4>
          <p className="mt-2">
            <strong>1. High / Architecture / UserService has too many responsibilities</strong>
          </p>
          <p className="text-muted-foreground">File: src/services/user.service.ts</p>
          <p className="mt-2 text-muted-foreground">
            The service handles validation, database access, notification, and
            response transformation in one place.
          </p>
        </article>
      </div>
    </section>
  )
}
