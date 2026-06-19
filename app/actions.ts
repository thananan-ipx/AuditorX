"use server"

import { insertWaitlistEntry } from "@/lib/supabase/waitlist"

export type WaitlistState = {
  ok: boolean
  message: string
}

export async function joinWaitlist(
  _state: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const name = String(formData.get("name") ?? "").trim()
  const company = String(formData.get("company") ?? "").trim()
  const githubOrg = String(formData.get("githubOrg") ?? "").trim()

  if (!email || !email.includes("@")) {
    return {
      ok: false,
      message: "Enter a valid email so we can reach you.",
    }
  }

  try {
    await insertWaitlistEntry({
      email,
      name,
      company,
      githubOrg,
    })

    return {
      ok: true,
      message: "You are on the early access list.",
    }
  } catch (error) {
    console.error("Waitlist insert failed", error)

    return {
      ok: false,
      message: "Could not join the waitlist yet. Check Supabase env and tables.",
    }
  }
}
