"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/language-switcher";
import { UniversalSearch } from "./universal-search";
import { currentPage } from "./navigation";
import { useLanguage } from "@/lib/i18n";

export function AppHeader() {
  const { t } = useLanguage();
  const page = currentPage(usePathname());
  return <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur md:px-6">
    <SidebarTrigger aria-label={t("Toggle navigation")} />
    <Separator orientation="vertical" className="h-5!" />
    <div className="min-w-0 flex-1"><Breadcrumb><BreadcrumbList className="flex-nowrap type-caption"><BreadcrumbItem className="hidden xl:inline-flex"><BreadcrumbLink asChild><Link href="/dashboard">{t("Workspace")}</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator className="hidden xl:block" /><BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate">{t(page?.label ?? "Overview")}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
    </div>
    <UniversalSearch />
    <LanguageSwitcher />
  </header>;
}
