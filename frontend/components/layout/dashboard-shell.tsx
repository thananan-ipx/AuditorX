"use client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger, SheetClose } from "@/components/ui/sheet";

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
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}><div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-white/8 bg-[#0d1720] text-slate-300 lg:flex"><Sidebar onClose={() => setSidebarOpen(false)} /></aside>
      <SheetContent side="left" showCloseButton={false} className="w-[260px] gap-0 border-white/8 bg-[#0d1720] p-0 text-slate-300 sm:max-w-[260px] lg:hidden">
        <SheetTitle className="sr-only">AuditorX</SheetTitle>
        <SheetDescription className="sr-only">{ /* Navigation labels are localized inside Sidebar. */ }AuditorX workspace navigation</SheetDescription>
        <Sidebar onClose={() => setSidebarOpen(false)} mobile />
      </SheetContent>
      <div className="lg:pl-[260px]">
        <Header />
        {children}
      </div>
    </div></Sheet>
  );
}

function Sidebar({ onClose, mobile = false }: { onClose: () => void; mobile?: boolean }) {
  const { t } = useLanguage();
  return (
    <>
        <div className="flex h-[76px] items-center justify-between border-b border-white/8 px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-[#c9f060] text-[#0d1720]"><Code2 size={19} strokeWidth={2.6} /></div>
            <div><p className="type-card-title text-white">AuditorX</p><p className="text-slate-400 type-overline">{t("Code Intelligence")}</p></div>
          </div>
          <div className="flex items-center gap-2">{mobile && <SheetClose asChild><Button variant="ghost" size="icon" aria-label={t("Close menu")}><X size={19} /></Button></SheetClose>}</div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <NavigationGroup label={t("Workspace")} items={workspaceNavigation} onNavigate={onClose} />
          <div className="mt-8"><NavigationGroup label={t("Management")} items={managementNavigation} onNavigate={onClose} /></div>
        </div>

        <div className="border-t border-white/8 p-4">
          <div className="flex items-center gap-3 px-1">
            <div className="grid size-9 place-items-center rounded-full bg-slate-700 text-white"><Users size={17} aria-hidden="true" /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-white type-label">{t("Your workspace")}</p><p className="truncate text-slate-500 type-caption">{t("AuditorX account")}</p></div>
            <LogoutButton />
          </div>
        </div>
    </>
  );
}

function NavigationGroup({ label, items, onNavigate }: { label: string; items: NavigationItem[]; onNavigate: () => void }) {
  return (
    <>
      <p className="mb-2 px-3 text-slate-400 type-overline">{label}</p>
      <nav aria-label={label} className="space-y-1">
        {items.map((item) => <NavItem key={item.label} {...item} onNavigate={onNavigate} />)}
      </nav>
    </>
  );
}

function NavItem({ label, icon: Icon, href, onNavigate }: NavigationItem & { onNavigate: () => void }) {
  const { t } = useLanguage();
  const active = usePathname() === href;
  const className = cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9f060] type-body-sm", active ? "bg-white/8 font-medium text-white" : "hover:bg-white/5 hover:text-white");
  const content = <><Icon size={17} aria-hidden="true" className={active ? "text-[#c9f060]" : "text-slate-500"} /><span className="flex-1">{t(label)}</span></>;
  return href
    ? <Button asChild variant="ghost" className={cn(className, "h-auto justify-start whitespace-normal")}><Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined}>{content}</Link></Button>
    : <Button variant="ghost" disabled className={cn(className, "h-auto justify-start whitespace-normal opacity-50")} title={t("Not available yet")}>{content}<span className="type-caption">{t("Soon")}</span></Button>;
}

function Header() {
  const { t } = useLanguage();
  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center border-b border-border/80 bg-[#f6f7f4]/90 px-4 backdrop-blur md:px-7 lg:px-9">
      <SheetTrigger asChild><Button variant="ghost" size="icon" className="mr-3 lg:hidden" aria-label={t("Open menu")}><Menu size={21} /></Button></SheetTrigger>
      <p className="hidden text-slate-700 sm:block type-label">{t("Code intelligence workspace")}</p>
      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitcher />
        <Button asChild variant="outline" className="hidden md:inline-flex"><Link href="/repositories">{t("Repositories")}</Link></Button>
      </div>
    </header>
  );
}
