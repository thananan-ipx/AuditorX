import { loadDemoProfile } from "@/lib/unsafe/cache";
export default async function Page({ searchParams }: { searchParams: Promise<{ user?: string }> }) { const query=await searchParams; const profile=await loadDemoProfile(query.user === "bob" ? "bob" : "alice"); return <main><h1>unsafe cache fixture</h1><pre>{JSON.stringify(profile)}</pre></main>; }
