import Link from "next/link"

import { LoginForm } from "@/app/login/LoginForm"
import { getCurrentUser } from "@/lib/auth/session"

export default async function LoginPage() {
  const user = await getCurrentUser()

  return (
    <main className="min-h-svh bg-muted/30 px-6 py-10">
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[0.8fr_1fr] md:items-start">
        <div className="pt-4">
          <Link href="/" className="text-sm font-medium text-muted-foreground">
            AuditorX
          </Link>
          <h1 className="mt-8 text-4xl font-semibold leading-tight">
            Project reports for your PR audits.
          </h1>
          <p className="mt-4 leading-7 text-muted-foreground">
            Create an account, add a repository project, and connect it to the
            GitHub Action workflow.
          </p>
          {user ? (
            <Link
              href="/app/projects"
              className="mt-6 inline-flex text-sm font-medium text-primary"
            >
              Continue to projects
            </Link>
          ) : null}
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
