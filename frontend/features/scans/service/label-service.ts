import { apiClient } from "@/lib/api-client";
import type { LabelInput, PriorityLabel, Scan } from "../types";

const base = (scan: Scan) => `/api/v1/repositories/${encodeURIComponent(scan.repository_id)}/scans/${encodeURIComponent(scan.id)}`;
export const labelService = {
  list(scan: Scan, signal?: AbortSignal) {
    return apiClient<PriorityLabel[]>(`${base(scan)}/labels`, { cache: "no-store", signal });
  },
  save(scan: Scan, fingerprint: string, input: LabelInput) {
    return apiClient<PriorityLabel>(`${base(scan)}/findings/${encodeURIComponent(fingerprint)}/labels`, { method: "POST", body: JSON.stringify(input) });
  },
};
