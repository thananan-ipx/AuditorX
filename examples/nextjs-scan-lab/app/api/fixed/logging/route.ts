export async function POST() {
  console.info("LAB sign-in attempt; credentials omitted");
  return Response.json({ ok: true, labOnly: true });
}
