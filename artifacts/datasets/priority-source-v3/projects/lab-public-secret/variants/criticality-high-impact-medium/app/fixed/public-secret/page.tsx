// Server-only value is used here and never included in the response.
export default function Page() {
  const configured = Boolean(process.env.LAB_DEMO_PASSWORD);
  return <main><h1>Server-only configuration</h1><p>{configured ? "Configured" : "Not configured"}</p></main>;
}
