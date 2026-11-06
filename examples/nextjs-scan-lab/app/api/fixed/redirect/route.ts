import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  // A constant destination allowlist also rejects slash-backslash normalization.
  const destination = next === "/fixed/html" ? "/fixed/html" : "/";
  return NextResponse.redirect(new URL(destination, request.url));
}
