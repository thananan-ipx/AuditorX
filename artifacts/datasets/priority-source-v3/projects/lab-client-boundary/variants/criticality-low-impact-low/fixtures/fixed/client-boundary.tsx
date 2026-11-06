"use client";
export default function ClientBoundary({ exists }: { exists: boolean }) { return <p>{String(exists)}</p>; }
