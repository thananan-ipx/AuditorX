"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Progress as ProgressPrimitive } from "radix-ui"

function Progress({
  className,
  value = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const limit = Number.isFinite(max) && max > 0 ? max : 100
  const normalized = value === null ? null : Number.isFinite(value) ? Math.min(limit, Math.max(0, value)) : 0
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={normalized}
      max={limit}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - ((normalized ?? 0) / limit) * 100}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }

