import DashboardPageClient from "@/features/dashboard/pages/dashboard-page-client";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ repository?: string | string[] }> }) {
  const { repository } = await searchParams;
  const repositoryID = Array.isArray(repository) ? repository[0] : repository;
  return <DashboardPageClient key={repositoryID ?? "default"} repositoryID={repositoryID} />;
}
