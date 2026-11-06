import { loadDemoProfile } from "@/lib/fixed/cache";
export default async function Page({ searchParams }: { searchParams: Promise<{ user?: string }> }) { const query=await searchParams; const profile=await loadDemoProfile(query.user === "bob" ? "bob" : "alice"); return <main><h1>fixed cache fixture</h1><pre>{JSON.stringify(profile)}</pre></main>; }
