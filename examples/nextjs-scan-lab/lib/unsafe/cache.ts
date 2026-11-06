import { unstable_cache } from "next/cache";
import { demoProfile } from "@/lib/demo-data";
export async function loadDemoProfile(userId: string) {
  const load = unstable_cache(async () => demoProfile(userId), ["lab-private-profile"]);
  return load();
}
