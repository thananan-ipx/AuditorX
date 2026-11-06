import { NextRequest } from "next/server";
import { demoDB } from "@/lib/demo-data";
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "alice";
  const preview = await demoDB.query("SELECT * FROM demo_users WHERE name = $1", [name]);
  return Response.json(preview);
}
