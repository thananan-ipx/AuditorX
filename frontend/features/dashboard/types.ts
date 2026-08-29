export type Dashboard = {
  repository: { id: string; name: string; owner: string; branch: string; primary_language: string; status: string };
  latest_scan: { id: string; status: string; branch: string; commit_sha: string; completed_at: string };
  quality_score: { value: number; version: string; calculated_at: string };
  issues: {
    total: number;
    by_severity: Record<string, number>;
    by_priority: Record<string, number>;
    by_category: Record<string, number>;
  };
  trend: { date: string; quality_score: number; issue_count: number }[];
  ai_summary: {
    status: string;
    summary: string;
    major_risks: string[];
    recommended_priorities: string[];
    positive_observations: string[];
    confidence_note: string;
  };
  priority_model: { source: string; version: string; fallback_count: number };
};

export type Issue = {
  id: string; title: string; rule_id: string; severity: string; priority: string;
  category: string; file: string; line: number; status: string; confidence: number;
};
