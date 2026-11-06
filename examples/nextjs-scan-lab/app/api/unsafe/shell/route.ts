import { NextRequest } from "next/server";
import * as child_process from "node:child_process";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text") ?? "lab";
  // Never use this pattern with real request data in a deployed service.
  const output = await new Promise<string>((resolve, reject) => child_process.exec("echo " + text, (error, stdout) => error ? reject(error) : resolve(stdout)));
  return Response.json({ output });
}
