import "server-only"

import { createHash, randomBytes } from "node:crypto"

export function createProjectApiToken() {
  return `ax_${randomBytes(24).toString("hex")}`
}

export function hashProjectApiToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}
