import Link from "next/link"
import { notFound } from "next/navigation"

import { TokenResetForm } from "@/app/app/projects/[id]/setup/TokenResetForm"
import { getProjectForCurrentUser } from "@/lib/projects"

export default async function ProjectSetupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await getProjectForCurrentUser(id)

  if (!project) {
    notFound()
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href={`/app/projects/${project.id}`}
        className="text-sm font-medium text-muted-foreground"
      >
        Back to report
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">GitHub Action setup</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Add these values to {project.repo_full_name}, then copy the workflow.
      </p>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.65fr_1fr]">
        <div className="grid gap-6">
          <div className="rounded-lg border bg-card p-5">
            <h2 className="text-lg font-semibold">Repository secrets</h2>
            <div className="mt-4 grid gap-3">
              <SecretRow label="AUDITORX_PROJECT_ID" value={project.id} />
              <SecretRow label="AUDITORX_API_TOKEN" value="Use the token shown when creating or rotating this project." />
            </div>
          </div>
          <TokenResetForm projectId={project.id} />
        </div>

        <pre className="max-h-[620px] overflow-auto rounded-lg border bg-card p-4 text-xs leading-5">
          <code>{buildWorkflow(project.id)}</code>
        </pre>
      </section>
    </main>
  )
}

function SecretRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <code className="mt-1 block overflow-auto text-sm">{value}</code>
    </div>
  )
}

function buildWorkflow(projectId: string) {
  return `name: AuditorX Review

on:
  pull_request_target:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  audit:
    runs-on: ubuntu-latest
    env:
      AUDITORX_API_URL: https://auditor-x.vercel.app/api/reviews
      AUDITORX_PROJECT_ID: ${projectId}
      PR_NUMBER: \${{ github.event.pull_request.number }}
      PR_TITLE: \${{ github.event.pull_request.title }}
      PR_URL: \${{ github.event.pull_request.html_url }}
      GH_TOKEN: \${{ github.token }}
    steps:
      - name: Build PR diff payload
        run: |
          gh pr diff "$PR_NUMBER" --repo "$GITHUB_REPOSITORY" > pr.diff
          jq -n \\
            --arg projectId "$AUDITORX_PROJECT_ID" \\
            --arg repoFullName "$GITHUB_REPOSITORY" \\
            --argjson pullNumber "$PR_NUMBER" \\
            --arg pullTitle "$PR_TITLE" \\
            --arg pullUrl "$PR_URL" \\
            --rawfile diffContent pr.diff \\
            '{ projectId: $projectId, repoFullName: $repoFullName, pullNumber: $pullNumber, pullTitle: $pullTitle, pullUrl: $pullUrl, diffContent: $diffContent }' \\
            > payload.json

      - name: Ask AuditorX for a review
        run: |
          curl --fail-with-body -sS -X POST "$AUDITORX_API_URL" \\
            -H "Authorization: Bearer \${{ secrets.AUDITORX_API_TOKEN }}" \\
            -H "Content-Type: application/json" \\
            --data @payload.json \\
            > auditorx-response.json
          jq -r '.comment' auditorx-response.json > auditorx-comment.md

      - name: Post AuditorX comment
        run: gh pr comment "$PR_NUMBER" --repo "$GITHUB_REPOSITORY" --body-file auditorx-comment.md`
}
