import { unstable_cache } from "next/cache";
import { demoProfile } from "@/lib/demo-data";
const load = unstable_cache(async (userId: string) => demoProfile(userId), ["lab-profile-by-user"]);
export async function loadDemoProfile(userId: string) { return load(userId); }
