import { Box, Database, LayoutDashboard, type LucideIcon } from "lucide-react";

export type NavigationPage = {
  href: string; label: string; group: string; icon: LucideIcon; keywords: string[];
};

// Shared by sidebar, header and search. Only implemented destinations belong here.
export const navigationPages: NavigationPage[] = [
  { href: "/dashboard", label: "Overview", group: "Workspace", icon: LayoutDashboard, keywords: ["dashboard", "overview", "ภาพรวม", "แดชบอร์ด", "scan", "สแกน"] },
  { href: "/repositories", label: "Repositories", group: "Workspace", icon: Box, keywords: ["repositories", "repository", "github", "คลังโค้ด", "เพิ่มคลังโค้ด"] },
  { href: "/datasets", label: "Training datasets", group: "Workspace", icon: Database, keywords: ["dataset", "training", "labels", "ชุดข้อมูล", "เทรน", "train"] },
];

export function currentPage(pathname: string) {
  return navigationPages.find(page => pathname === page.href || pathname.startsWith(page.href + "/"));
}

const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase().trim();
export function searchPages(query: string, translate: (value: string) => string = value => value) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return navigationPages.filter(page => terms.every(term => normalize([page.label, translate(page.label), translate(page.group), page.href, ...page.keywords].join(" ")).includes(term)));
}
