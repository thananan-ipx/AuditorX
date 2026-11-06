import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text") ?? "lab";
  // Executable and program are fixed; input is a separate argument, not shell code.
  const output = await new Promise<string>((resolve, reject) => execFile(process.execPath, ["-e", "process.stdout.write(process.argv[1] ?? '')", text], (error, stdout) => error ? reject(error) : resolve(stdout)));
  return Response.json({ output });
}
