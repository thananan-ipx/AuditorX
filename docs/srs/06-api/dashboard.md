# Dashboard API

> Related: `UC-005`, `FR-DASH-*`

**Implementation status (as of 2026-09-12):** `GET /api/v1/repositories/{repository_id}/dashboard` is a real, registered route, but in the current (`postgres` + scan-queue) mode it is a legacy placeholder that always returns `409 SCAN_REQUIRED` once the repository is found (`backend/internal/modules/project/delivery/http/handler.go`, `Dashboard` handler) — it never returns the rich payload below. No endpoint anywhere computes or serves a quality score, AI summary, trend data, or a priority breakdown; none of those tables exist (see `docs/05-database/data-model.md` §4a). In real usage, the frontend dashboard is actually built from the scan/findings endpoints in `scans.md` (`GET .../scans`, `GET .../scans/{scan_id}`, `GET .../scans/{scan_id}/findings`), not from this endpoint. When the backend runs in `prototype` mode (no database), a separate legacy `audit` module serves a hardcoded/sample dashboard response shaped like the payload below, clearly using fake sample data — see `backend/internal/modules/audit/entity/audit.go` and `docs/scan-pipeline.md`. The JSON below documents the planned target dashboard contract; it is not what a real repository with real scans returns today.

## GET /api/v1/repositories/{repository_id}/dashboard — **[Planned target shape; implemented route returns `409 SCAN_REQUIRED` or legacy sample data — see status note above]**

Returns dashboard data for a repository.

Suggested response (planned; not implemented):

```json
{
  "data": {
    "repository": {
      "id": "uuid",
      "name": "example",
      "branch": "main",
      "primary_language": "Go"
    },
    "latest_scan": {
      "id": "uuid",
      "completed_at": "2026-08-09T12:00:00Z"
    },
    "quality_score": {
      "value": 82.5,
      "version": "v1",
      "calculated_at": "2026-08-09T12:00:02Z"
    },
    "issues": {
      "total": 17,
      "by_severity": {
        "Critical": 0,
        "High": 2,
        "Medium": 7,
        "Low": 8
      },
      "by_priority": {
        "Critical": 1,
        "High": 4,
        "Medium": 8,
        "Low": 4
      },
      "by_category": {}
    },
    "trend": [],
    "ai_summary": {
      "status": "Completed",
      "summary": "Overall repository quality is stable.",
      "major_risks": [],
      "recommended_priorities": [],
      "positive_observations": [],
      "confidence_note": "Based on the latest completed scan."
    },
    "priority_model": {
      "source": "model",
      "version": "priority-model-v1",
      "fallback_count": 0
    }
  }
}
```

---

## Behavior

If there is no completed scan:

- return repository metadata
- return `latest_scan: null`
- return an explicit empty/no-data state rather than fabricate metrics

The Dashboard uses the latest Completed `AIRepositorySummary` for the latest completed Scan. If no completed summary exists, it returns the latest summary status or `ai_summary: null`; static metrics remain available.

Priority counts must be grouped from persisted Predictions. The response identifies the Active predictor version/source and how many Issues used fallback.
