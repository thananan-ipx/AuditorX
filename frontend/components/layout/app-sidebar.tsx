"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, ChevronsUpDown, CircleDot, Code2, FileBarChart, History, LogOut, Settings, Users, X } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/shared/feedback";
import { authService, type AuthUser } from "@/features/auth/service/auth-service";
import { useLanguage } from "@/lib/i18n";
import { APP_NAME } from "@/lib/constants";
import { currentPage, navigationPages } from "./navigation";

const plannedGroups = [
  { label: "Analysis", items: [{ label: "Issues", icon: CircleDot }, { label: "Scan history", icon: History }, { label: "Reports", icon: FileBarChart }] },
  { label: "Management", items: [{ label: "Team", icon: Users }, { label: "Model evaluation", icon: BarChart3 }, { label: "Settings", icon: Settings }] },
];

export function AppSidebar() {
  const { t } = useLanguage();
  const active = currentPage(usePathname())?.href;
  const { setOpenMobile } = useSidebar();
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void authService.me(controller.signal).then(result => { if (!controller.signal.aborted) setUser(result.user); }).catch(() => { if (!controller.signal.aborted) setUser(null); });
    return () => controller.abort();
  }, []);
  return <Sidebar variant="inset" collapsible="icon" title={t("Workspace")} description={t("Code intelligence workspace")}>
    <SidebarHeader className="flex-row items-center gap-2.5 p-2">
      <Link href="/dashboard" onClick={() => setOpenMobile(false)} aria-label={APP_NAME} className="grid size-9 shrink-0 place-content-center rounded-lg bg-primary text-primary-foreground"><Code2 className="size-5" aria-hidden="true" /></Link>
      <div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate type-label font-semibold">{APP_NAME}</p><p className="type-caption text-muted-foreground">{t("Code Intelligence")}</p></div>
      <Button variant="ghost" size="icon-sm" className="ml-auto md:hidden" aria-label={t("Close menu")} onClick={() => setOpenMobile(false)}><X className="size-4" /></Button>
    </SidebarHeader>
    <SidebarContent className="px-2 py-3">
      <SidebarGroup className="p-0 pb-2"><SidebarGroupLabel className="type-overline">{t("Workspace")}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>
        {navigationPages.map(page => <SidebarMenuItem key={page.href}><SidebarMenuButton asChild isActive={active === page.href} tooltip={t(page.label)} className="h-10 type-label"><Link href={page.href} aria-current={active === page.href ? "page" : undefined} onClick={() => setOpenMobile(false)}><page.icon aria-hidden="true" /><span>{t(page.label)}</span></Link></SidebarMenuButton></SidebarMenuItem>)}
      </SidebarMenu></SidebarGroupContent></SidebarGroup>
      {plannedGroups.map(group => <SidebarGroup key={group.label} className="p-0 pb-2"><SidebarGroupLabel className="type-overline">{t(group.label)}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>
        {group.items.map(item => <SidebarMenuItem key={item.label}><SidebarMenuButton disabled tooltip={t("Not available yet")} className="h-10 type-label" aria-label={`${t(item.label)} · ${t("Not available yet")}`}><item.icon aria-hidden="true" /><span>{t(item.label)}</span><span className="ml-auto type-caption group-data-[collapsible=icon]:hidden">{t("Soon")}</span></SidebarMenuButton></SidebarMenuItem>)}
      </SidebarMenu></SidebarGroupContent></SidebarGroup>)}
    </SidebarContent>
    <SidebarFooter className="p-2"><UserMenu user={user} /></SidebarFooter>
  </Sidebar>;
}

function UserMenu({ user }: { user: AuthUser | null }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { isMobile } = useSidebar();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const name = user?.email.split("@")[0] || t("Your workspace");
  const email = user?.email || t("AuditorX account");
  return <>
    {error && <Feedback tone="error">{t("Unable to sign out. Try again.")}</Feedback>}
    <SidebarMenu><SidebarMenuItem><DropdownMenu><DropdownMenuTrigger asChild>
      <SidebarMenuButton size="lg" tooltip={email} aria-label={t("Account menu")} className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
        <Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg bg-primary/10 type-label text-primary">{name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
        <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden"><span className="block truncate type-label">{name}</span><span className="block truncate type-caption text-muted-foreground">{email}</span></span>
        <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" aria-hidden="true" />
      </SidebarMenuButton>
    </DropdownMenuTrigger><DropdownMenuContent side={isMobile ? "bottom" : "right"} align="end" className="min-w-60">
      <DropdownMenuLabel><p className="type-label">{t("Your workspace")}</p><p className="break-all type-caption font-normal text-muted-foreground">{email}</p></DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={pending} onSelect={event => {
        event.preventDefault(); setPending(true); setError(false);
        void authService.signOut().then(() => { router.replace("/login"); router.refresh(); }).catch(() => { setPending(false); setError(true); });
      }}><LogOut className="size-4" aria-hidden="true" />{t(pending ? "Please wait…" : "Sign out")}</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu></SidebarMenuItem></SidebarMenu>
  </>;
}
