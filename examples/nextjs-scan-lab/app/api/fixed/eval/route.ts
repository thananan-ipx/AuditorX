import { NextRequest } from "next/server";
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("number") ?? "0";
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return Response.json({ error: "Numeric input required" }, { status: 400 });
  const value = Number(raw);
  if (!Number.isFinite(value)) return Response.json({ error: "Finite input required" }, { status: 400 });
  return Response.json({ result: value * 2 });
}
