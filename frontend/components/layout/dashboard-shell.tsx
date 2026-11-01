"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export function DashboardShell({ children, defaultSidebarOpen = true }: Readonly<{ children: React.ReactNode; defaultSidebarOpen?: boolean }>) {
  return <SidebarProvider defaultOpen={defaultSidebarOpen}>
    <AppSidebar />
    <SidebarInset className="min-w-0 overflow-clip">
      <AppHeader />
      <div data-slot="page-content" className="min-w-0 w-full flex-1 space-y-4 p-4 md:p-6">
        {children}
      </div>
    </SidebarInset>
  </SidebarProvider>;
}
