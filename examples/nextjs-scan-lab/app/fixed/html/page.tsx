// Fixed: React renders the request value as escaped text.
export default async function Page({ searchParams }: { searchParams: Promise<{ html?: string }> }) {
  const query = await searchParams;
  return <main><h1>Escaped text example</h1><p>{query.html ?? "Demo"}</p></main>;
}
