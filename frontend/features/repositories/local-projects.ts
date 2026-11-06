import type { ScanStatus } from "@/features/scans/types";

export type LocalProject = {
  name: string; source_name: string; source_kind: "local" | "upload";
  repository_id: string; repository_name: string; access_level: "owner" | "editor" | "viewer";
  scan_id: string; status: ScanStatus; created_at: string; scan_count: number;
  high: number; medium: number; low: number;
};

export function filterLocalProjects(items: LocalProject[], query: string, kind: string) {
  const needle = query.normalize("NFKC").trim().toLowerCase();
  return items.filter(item => (kind === "all" || kind === item.source_kind)
    && (!needle || `${item.name} ${item.source_name} ${item.repository_name}`.toLowerCase().includes(needle)));
}
