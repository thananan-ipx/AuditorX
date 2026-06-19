import Link from "next/link"

import { NewProjectForm } from "@/app/app/projects/new/NewProjectForm"

export default function NewProjectPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/app/projects" className="text-sm font-medium text-muted-foreground">
        Back to projects
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Add repository</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Create a project and get a token for the GitHub Action workflow.
      </p>
      <div className="mt-8">
        <NewProjectForm />
      </div>
    </main>
  )
}
