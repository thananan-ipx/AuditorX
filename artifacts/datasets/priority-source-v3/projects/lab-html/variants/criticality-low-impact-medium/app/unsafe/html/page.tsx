// LAB: intentionally renders untrusted HTML. Test data only.
export default async function Page({ searchParams }: { searchParams: Promise<{ html?: string }> }) {
  const query = await searchParams;
  return <main><h1>Unsafe HTML example</h1><div dangerouslySetInnerHTML={{ __html: query.html ?? "Demo" }} /></main>;
}
