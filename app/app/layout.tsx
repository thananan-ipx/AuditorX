import Link from "next/link"

import { signOut } from "@/app/auth/actions"
import { Button } from "@/components/ui/button"
import { requireUser } from "@/lib/auth/session"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <div className="min-h-svh bg-muted/25">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/app/projects" className="font-semibold">
            AuditorX
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.email}
            </span>
            <form action={signOut}>
              <Button size="sm" variant="outline">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
