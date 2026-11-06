import { apiClient } from "@/lib/api-client";
import type { LabelInput, Scan } from "../types";

export type PredictionContext = Pick<LabelInput, "repository_criticality" | "exposure" | "impact">;
export type PredictionResult = {
  model_version: string; model_sha256: string; feature_contract: string;
  experimental: boolean; dataset_kind: string; training_rows: number;
  predictions: { fingerprint: string; priority: "High" | "Medium" | "Low" }[];
};
export type PredictionRun = {
  id: number; scan_id: string; repository_id: string; status: "queued" | "running" | "completed" | "failed";
  attempts: number; context: PredictionContext; result: PredictionResult | null; error_code: string | null;
  created_at: string; finished_at: string | null;
};
const base = (scan: Scan) => `/api/v1/repositories/${encodeURIComponent(scan.repository_id)}/scans/${encodeURIComponent(scan.id)}/predictions`;
export const predictionService = {
  latest(scan: Scan, signal?: AbortSignal) { return apiClient<PredictionRun | null>(base(scan), { signal, cache: "no-store" }); },
  retry(scan: Scan, signal?: AbortSignal) { return apiClient<PredictionRun>(`${base(scan)}/retry`, { method: "POST", body: "{}", signal }); },
};
export function predictScan(scan: Scan, context: PredictionContext, signal?: AbortSignal) {
  return apiClient<PredictionResult>(`/api/v1/repositories/${encodeURIComponent(scan.repository_id)}/scans/${encodeURIComponent(scan.id)}/predictions`, {
    method: "POST", body: JSON.stringify(context), signal, cache: "no-store",
  });
}
