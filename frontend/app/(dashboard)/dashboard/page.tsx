import DashboardPageClient from "@/features/dashboard/pages/dashboard-page-client";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ repository?: string | string[]; scan?: string | string[] }> }) {
  const { repository, scan } = await searchParams;
  const repositoryID = Array.isArray(repository) ? repository[0] : repository;
  const scanID = Array.isArray(scan) ? scan[0] : scan;
  return <DashboardPageClient key={`${repositoryID ?? "default"}:${scanID ?? "latest"}`} repositoryID={repositoryID} initialScanID={scanID} />;
}
