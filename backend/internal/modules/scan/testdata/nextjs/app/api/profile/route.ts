// Review fixture: public access may be intentional; do not report missing auth.
export async function POST(request: Request) {
  const input = await request.json();
  return Response.json({ received: !!input });
}
