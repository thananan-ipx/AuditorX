import { cookies } from "next/headers";
export const serverSecret = process.env.API_SECRET;
export async function readSession() {
  return (await cookies()).get("session");
}
