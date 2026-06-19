import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { getProjectForCurrentUser, listReviewsForProject } from "@/lib/projects"

export default async function ProjectReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await getProjectForCurrentUser(id)

  if (!project) {
    notFound()
  }

  const reviews = await listReviewsForProject(project.id)
  const latest = reviews[0]
  const averageScore =
    reviews.length > 0
      ? Math.round(
          reviews.reduce((total, review) => total + (review.score ?? 0), 0) /
            reviews.length,
        )
      : null
  const categoryCounts = countFindingsByCategory(reviews)

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/app/projects" className="text-sm font-medium text-muted-foreground">
            Back to projects
          </Link>
          <h1 className="mt-6 text-3xl font-semibold">{project.name}</h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            {project.repo_full_name}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/app/projects/${project.id}/setup`}>Setup</Link>
        </Button>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard label="Latest risk" value={latest?.risk_level ?? "No reviews"} />
        <MetricCard label="Average score" value={averageScore ? `${averageScore}/100` : "-"} />
        <MetricCard label="Reviews" value={String(reviews.length)} />
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-[0.7fr_1fr]">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">Findings by category</h2>
          <div className="mt-4 grid gap-3">
            {Object.keys(categoryCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground">No findings yet.</p>
            ) : (
              Object.entries(categoryCounts).map(([category, count]) => (
                <div key={category} className="flex items-center justify-between text-sm">
                  <span>{category}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">Recent PR reviews</h2>
          <div className="mt-4 grid gap-4">
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No review data yet. Open or update a PR after installing the
                workflow.
              </p>
            ) : (
              reviews.map((review) => (
                <article key={review.id} className="rounded-lg border bg-background p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold">
                        #{review.pull_number} {review.pull_title ?? "Untitled PR"}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {review.summary}
                      </p>
                    </div>
                    <div className="text-sm font-semibold">
                      {review.score ?? "-"}
                      <span className="text-muted-foreground">/100</span>
                    </div>
                  </div>
                  {review.pull_url ? (
                    <a
                      href={review.pull_url}
                      className="mt-3 inline-flex text-sm font-medium text-primary"
                    >
                      Open pull request
                    </a>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold capitalize">{value}</div>
    </div>
  )
}

function countFindingsByCategory(reviews: Awaited<ReturnType<typeof listReviewsForProject>>) {
  const counts: Record<string, number> = {}

  for (const review of reviews) {
    const findings = Array.isArray(review.findings) ? review.findings : []

    for (const finding of findings) {
      if (
        finding &&
        typeof finding === "object" &&
        "category" in finding &&
        typeof finding.category === "string"
      ) {
        counts[finding.category] = (counts[finding.category] ?? 0) + 1
      }
    }
  }

  return counts
}
