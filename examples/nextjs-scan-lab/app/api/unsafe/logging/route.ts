import { NextRequest } from "next/server";
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  console.log("LAB credential:", password);
  return Response.json({ ok: true, labOnly: true });
}
