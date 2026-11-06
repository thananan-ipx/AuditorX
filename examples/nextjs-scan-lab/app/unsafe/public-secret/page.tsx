"use client";
// This value is deliberately fake. No external credential exists.
export default function Page() {
  const browserValue = process.env.NEXT_PUBLIC_LAB_PAYMENT_SECRET ?? "FAKE-LAB-SECRET";
  return <main><h1>Public secret-name fixture</h1><pre>{browserValue}</pre></main>;
}
