"use client"

import { useActionState } from "react"

import { createProject, type ProjectActionState } from "@/app/app/actions"
import { Button } from "@/components/ui/button"

const initialState: ProjectActionState = {
  ok: false,
  message: "",
}

export function NewProjectForm() {
  const [state, action, pending] = useActionState(createProject, initialState)

  return (
    <div className="grid gap-6">
      <form action={action} className="grid gap-4 rounded-lg border bg-card p-5">
        <label className="grid gap-1.5 text-sm font-medium">
          Project name
          <input
            required
            name="name"
            className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            placeholder="Website frontend"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Repository full name
          <input
            required
            name="repoFullName"
            className="h-10 rounded-lg border bg-background px-3 font-mono text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            placeholder="owner/repo"
          />
        </label>
        <Button className="h-10" disabled={pending}>
          {pending ? "Creating..." : "Create project"}
        </Button>
        {state.message ? (
          <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-destructive"}`}>
            {state.message}
          </p>
        ) : null}
      </form>

      {state.ok && state.projectId && state.apiToken ? (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">GitHub secrets</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add these secrets to the repository, then copy the workflow from the
            setup page.
          </p>
          <div className="mt-4 grid gap-3">
            <SecretRow label="AUDITORX_PROJECT_ID" value={state.projectId} />
            <SecretRow label="AUDITORX_API_TOKEN" value={state.apiToken} />
          </div>
          <Button asChild className="mt-5" variant="outline">
            <a href={`/app/projects/${state.projectId}/setup`}>Open setup page</a>
          </Button>
        </div>
      ) : null}
    </div>
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
