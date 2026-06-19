"use client"

import { useActionState } from "react"

import {
  signInWithPassword,
  signUpWithPassword,
  type AuthState,
} from "@/app/auth/actions"
import { Button } from "@/components/ui/button"

const initialState: AuthState = {
  ok: false,
  message: "",
}

export function LoginForm() {
  const [signInState, signInAction, signInPending] = useActionState(
    signInWithPassword,
    initialState,
  )
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUpWithPassword,
    initialState,
  )

  return (
    <div className="grid gap-4">
      <form action={signInAction} className="grid gap-3 rounded-lg border bg-card p-5">
        <div>
          <h2 className="text-xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open your project reports and setup instructions.
          </p>
        </div>
        <AuthFields />
        <Button className="h-10" disabled={signInPending}>
          {signInPending ? "Signing in..." : "Sign in"}
        </Button>
        <AuthMessage state={signInState} />
      </form>

      <form action={signUpAction} className="grid gap-3 rounded-lg border bg-card p-5">
        <div>
          <h2 className="text-xl font-semibold">Create account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use email and password for the MVP.
          </p>
        </div>
        <AuthFields />
        <Button className="h-10" disabled={signUpPending} variant="outline">
          {signUpPending ? "Creating..." : "Create account"}
        </Button>
        <AuthMessage state={signUpState} />
      </form>
    </div>
  )
}

function AuthFields() {
  return (
    <>
      <label className="grid gap-1.5 text-sm font-medium">
        Email
        <input
          required
          type="email"
          name="email"
          className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          placeholder="you@company.com"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Password
        <input
          required
          minLength={8}
          type="password"
          name="password"
          className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          placeholder="At least 8 characters"
        />
      </label>
    </>
  )
}

function AuthMessage({ state }: { state: AuthState }) {
  if (!state.message) {
    return null
  }

  return (
    <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-destructive"}`}>
      {state.message}
    </p>
  )
}
