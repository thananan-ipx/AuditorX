"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { useLanguage } from "@/lib/i18n";

export function DashboardShell({ children, defaultSidebarOpen = true }: Readonly<{ children: React.ReactNode; defaultSidebarOpen?: boolean }>) {
  const { t } = useLanguage();
  return <SidebarProvider defaultOpen={defaultSidebarOpen}>
    <a href="#main-content" className="sr-only fixed left-4 top-4 z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only">{t("Skip to content")}</a>
    <AppSidebar />
    <SidebarInset className="min-w-0 overflow-clip">
      <AppHeader />
      <main id="main-content" tabIndex={-1} data-slot="page-content" className="mx-auto min-w-0 w-full max-w-[1600px] flex-1 space-y-6 p-4 outline-none md:p-6 xl:p-8">
        {children}
      </main>
    </SidebarInset>
  </SidebarProvider>;
}
