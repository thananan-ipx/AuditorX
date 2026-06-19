import Link from "next/link"

import { Button } from "@/components/ui/button"
import { listProjectsForCurrentUser } from "@/lib/projects"

export default async function ProjectsPage() {
  const projects = await listProjectsForCurrentUser()

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Projects</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect repositories with the AuditorX GitHub Action.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/projects/new">Add repository</Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-4">
        {projects.length === 0 ? (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold">No projects yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add your first repository to get a project token and setup steps.
            </p>
          </div>
        ) : (
          projects.map((project) => (
            <Link
              key={project.id}
              href={`/app/projects/${project.id}`}
              className="rounded-lg border bg-card p-5 transition-colors hover:bg-muted/40"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{project.name}</h2>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">
                    {project.repo_full_name}
                  </p>
                </div>
                <span className="text-sm font-medium text-primary">View report</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  )
}
