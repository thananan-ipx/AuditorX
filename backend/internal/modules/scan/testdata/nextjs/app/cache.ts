import { unstable_cache } from "next/cache";
export const cachedProfile = unstable_cache(async () => ({ name: "fixture" }));
