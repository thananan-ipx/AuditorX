// Static analysis fixture only. Never execute.
"use client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export function Unsafe({ searchParams }: { searchParams: URLSearchParams }) {
  const html = searchParams.get("html");
  const target = searchParams.get("next");
  const exposed = process.env.NEXT_PUBLIC_API_SECRET;
  const bracketSecret = process.env["NEXT_PUBLIC_DB_PASSWORD"];
  redirect(target);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
