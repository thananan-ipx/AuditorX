import { redirect } from "next/navigation";
export default async function Page({ searchParams }: { searchParams: Promise<{ html: string; next: string }> }) {
  const query = await searchParams;
  redirect(query.next);
  return <article dangerouslySetInnerHTML={{ __html: query.html }} />;
}
