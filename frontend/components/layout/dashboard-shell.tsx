"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Box,
  CircleDot,
  Code2,
  FileBarChart,
  History,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type NavigationItem = { label: string; icon: typeof Box; href?: string };

const workspaceNavigation: NavigationItem[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Repositories", icon: Box, href: "/repositories" },
  { label: "Issues", icon: CircleDot },
  { label: "Scan history", icon: History },
  { label: "Reports", icon: FileBarChart },
];

const managementNavigation = [
  { label: "Team", icon: Users },
  { label: "Model evaluation", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

type DashboardShellProps = Readonly<{ children: React.ReactNode }>;

export function DashboardShell({ children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f6f7f4] text-foreground">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-[260px]">
        <Header onMenu={() => setSidebarOpen(true)} />
        {children}
      </div>
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <>
      {open && <button aria-label={t("Close navigation")} className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={onClose} />}
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-[260px] -translate-x-full flex-col border-r border-white/8 bg-[#0d1720] text-slate-300 transition-transform lg:translate-x-0", open && "translate-x-0")}>
        <div className="flex h-[76px] items-center justify-between border-b border-white/8 px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-[#c9f060] text-[#0d1720]"><Code2 size={19} strokeWidth={2.6} /></div>
            <div><p className="font-bold tracking-tight text-white">AuditorX</p><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t("Code Intelligence")}</p></div>
          </div>
          <button className="lg:hidden" onClick={onClose} aria-label={t("Close menu")}><X size={19} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <NavigationGroup label={t("Workspace")} items={workspaceNavigation} onNavigate={onClose} />
          <div className="mt-8"><NavigationGroup label={t("Management")} items={managementNavigation} onNavigate={onClose} /></div>
        </div>

        <div className="border-t border-white/8 p-4">
          <div className="flex items-center gap-3 px-1">
            <div className="grid size-9 place-items-center rounded-full bg-slate-700 text-white"><Users size={17} aria-hidden="true" /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{t("Your workspace")}</p><p className="truncate text-xs text-slate-500">{t("AuditorX account")}</p></div>
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  );
}

function NavigationGroup({ label, items, onNavigate }: { label: string; items: NavigationItem[]; onNavigate: () => void }) {
  return (
    <>
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{label}</p>
      <nav aria-label={label} className="space-y-1">
        {items.map((item) => <NavItem key={item.label} {...item} onNavigate={onNavigate} />)}
      </nav>
    </>
  );
}

function NavItem({ label, icon: Icon, href, onNavigate }: NavigationItem & { onNavigate: () => void }) {
  const { t } = useLanguage();
  const active = usePathname() === href;
  const className = cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9f060]", active ? "bg-white/8 font-medium text-white" : "hover:bg-white/5 hover:text-white");
  const content = <><Icon size={17} aria-hidden="true" className={active ? "text-[#c9f060]" : "text-slate-500"} /><span className="flex-1">{t(label)}</span></>;
  return href
    ? <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={className}>{content}</Link>
    : <button disabled className={cn(className, "opacity-50")} title={t("Not available yet")}>{content}<span className="text-[10px]">{t("Soon")}</span></button>;
}

function Header({ onMenu }: { onMenu: () => void }) {
  const { t } = useLanguage();
  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center border-b border-border/80 bg-[#f6f7f4]/90 px-4 backdrop-blur md:px-7 lg:px-9">
      <button className="mr-3 lg:hidden" onClick={onMenu} aria-label={t("Open menu")}><Menu size={21} /></button>
      <p className="hidden text-sm font-medium text-slate-700 sm:block">{t("Code intelligence workspace")}</p>
      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitcher />
        <Link href="/repositories" className="hidden rounded-lg border bg-white px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 md:block">{t("Repositories")}</Link>
      </div>
    </header>
  );
}
