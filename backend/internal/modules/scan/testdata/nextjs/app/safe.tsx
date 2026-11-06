import DOMPurify from "dompurify";
import { redirect } from "next/navigation";
export function Safe({ searchParams }: { searchParams: URLSearchParams }) {
  const html = DOMPurify.sanitize(searchParams.get("html") ?? "");
  const publicUrl = process.env.NEXT_PUBLIC_API_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const text = "fixture".replace(searchParams.get("next") ?? "", "");
  const items: string[] = [];
  items.push(searchParams.get("next") ?? "");
  if (searchParams.get("next")) redirect("/dashboard");
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
