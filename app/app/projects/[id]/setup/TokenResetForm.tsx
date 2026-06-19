"use client"

import { useActionState } from "react"

import { rotateProjectToken, type ProjectActionState } from "@/app/app/actions"
import { Button } from "@/components/ui/button"

const initialState: ProjectActionState = {
  ok: false,
  message: "",
}

export function TokenResetForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(rotateProjectToken, initialState)

  return (
    <form action={action} className="rounded-lg border bg-card p-5">
      <input type="hidden" name="projectId" value={projectId} />
      <h2 className="text-lg font-semibold">Project token</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Tokens are shown only when created. Generate a new one if you lost the
        original, then update the GitHub secret.
      </p>
      <Button className="mt-4" disabled={pending} variant="outline">
        {pending ? "Generating..." : "Generate new token"}
      </Button>
      {state.message ? (
        <p className={`mt-3 text-sm ${state.ok ? "text-emerald-700" : "text-destructive"}`}>
          {state.message}
        </p>
      ) : null}
      {state.apiToken ? (
        <div className="mt-4 rounded-lg border bg-muted/30 p-3">
          <div className="text-xs font-semibold text-muted-foreground">
            AUDITORX_API_TOKEN
          </div>
          <code className="mt-1 block overflow-auto text-sm">{state.apiToken}</code>
        </div>
      ) : null}
    </form>
  )
}
