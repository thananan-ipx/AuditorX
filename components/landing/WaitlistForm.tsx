"use client"

import { useActionState } from "react"

import { joinWaitlist, type WaitlistState } from "@/app/actions"
import { Button } from "@/components/ui/button"

const initialState: WaitlistState = {
  ok: false,
  message: "",
}

export function WaitlistForm() {
  const [state, action, pending] = useActionState(joinWaitlist, initialState)

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-medium">
        Name
        <input
          name="name"
          className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          placeholder="Jane Doe"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Work email
        <input
          required
          type="email"
          name="email"
          className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          placeholder="jane@company.com"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Company
        <input
          name="company"
          className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          placeholder="IProgressX"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        GitHub org
        <input
          name="githubOrg"
          className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          placeholder="your-org"
        />
      </label>
      <div className="sm:col-span-2">
        <Button className="h-10 w-full sm:w-auto" disabled={pending}>
          {pending ? "Joining..." : "Join Early Access"}
        </Button>
      </div>
      {state.message ? (
        <p
          className={`sm:col-span-2 text-sm ${
            state.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
