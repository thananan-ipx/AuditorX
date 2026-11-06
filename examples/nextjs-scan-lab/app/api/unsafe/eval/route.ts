import { NextRequest } from "next/server";
export async function GET(request: NextRequest) {
  const expression = request.nextUrl.searchParams.get("expression") ?? "2 + 2";
  return Response.json({ result: String(eval(expression)) });
}
