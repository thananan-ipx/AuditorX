import { DashboardShell } from "@/components/layout/dashboard-shell";
import { cookies } from "next/headers";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  return <DashboardShell defaultSidebarOpen={cookieStore.get("auditorx_sidebar_state")?.value !== "false"}>{children}</DashboardShell>;
}
