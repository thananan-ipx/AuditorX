package scan

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	project "github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
)

type predictionJobs struct {
	jobsStub
	findings []Finding
}

func (s *predictionJobs) Findings(context.Context, string, string, string) ([]Finding, error) {
	return s.findings, nil
}

type predictionStub struct {
	calls int
	items []PredictionItem
	err   error
}

func (p *predictionStub) Predict(_ context.Context, items []PredictionItem) (PredictionResult, error) {
	p.calls++
	p.items = items
	return PredictionResult{Experimental: true, Predictions: []PriorityPrediction{{Fingerprint: items[0].Fingerprint, Priority: "High"}}}, p.err
}
func TestPredictionHTTPAccessAndContext(t *testing.T) {
	valid := `{"repository_criticality":"low","exposure":"test_only","impact":"unknown"}`
	for _, tc := range []struct {
		name, status, body string
		repoErr, error     error
		findings           bool
		want               int
	}{
		{name: "viewer can preview", status: "completed", body: valid, findings: true, want: 200},
		{name: "no access", status: "completed", body: valid, repoErr: project.ErrNotFound, findings: true, want: 404},
		{name: "pending scan", status: "running", body: valid, findings: true, want: 409},
		{name: "target injection", status: "completed", body: strings.Replace(valid, `"impact"`, `"priority_label":"High","impact"`, 1), findings: true, want: 400},
		{name: "empty", status: "completed", body: valid, want: 409},
		{name: "service down", status: "completed", body: valid, findings: true, error: errors.New("secret upstream detail"), want: 503},
	} {
		t.Run(tc.name, func(t *testing.T) {
			jobs := &predictionJobs{jobsStub: jobsStub{status: tc.status}}
			if tc.findings {
				jobs.findings = []Finding{{Fingerprint: strings.Repeat("a", 64), RuleID: "auditorx.javascript.security.dynamic-eval", File: "app/api/route.ts", Severity: "High"}}
			}
			predictor := &predictionStub{err: tc.error}
			h := Handler{Repositories: readerStub{access: "viewer", err: tc.repoErr}, Jobs: jobs, Predictor: predictor}
			mux := http.NewServeMux()
			h.RegisterRoutes(mux)
			r := httptest.NewRequest("POST", "/api/v1/repositories/"+alice+"/scans/"+bob+"/predictions", strings.NewReader(tc.body))
			r = r.WithContext(identity.WithUserID(r.Context(), alice))
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, r)
			if w.Code != tc.want {
				t.Fatalf("%d %s", w.Code, w.Body.String())
			}
			if tc.want != 200 && tc.want != 503 && predictor.calls != 0 {
				t.Fatal("unauthorized or invalid request reached model")
			}
			if strings.Contains(w.Body.String(), "secret upstream") {
				t.Fatal("upstream details leaked")
			}
		})
	}
}
func TestPredictionFeatureContract(t *testing.T) {
	context := PredictionContext{RepositoryCriticality: "low", Exposure: "test_only", Impact: "unknown"}
	findings := []Finding{{Fingerprint: "a", RuleID: "auditorx.nextjs.review.shared-cache", File: "lib/cache.ts", Severity: "Low"}, {Fingerprint: "b", RuleID: "auditorx.nextjs.review.shared-cache", File: "lib/other.ts", Severity: "Low"}, {Fingerprint: "c", RuleID: "auditorx.go.code-quality.unhandled-json-error", File: "main.go", Severity: "Medium"}}
	items := predictionItems(findings, context)
	if items[0].Features.RuleFamily != "auditorx.nextjs.review.shared-cache" || items[0].Features.Category != "Manual review" || items[0].Features.RuleCount != 2 || items[2].Features.Language != "go" || items[2].Features.RuleFamily != "code-quality.unhandled-json-error" || items[2].Features.Category != "Code quality" {
		t.Fatalf("feature drift: %+v", items)
	}
	encoded, _ := json.Marshal(items)
	if strings.Contains(string(encoded), "lib/cache.ts") || strings.Contains(string(encoded), "label_reason") {
		t.Fatal("non-features sent to inference")
	}
}
func TestPredictionClientRejectsMismatchedResults(t *testing.T) {
	for _, priority := range []string{"High", "Critical"} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(PredictionResult{ModelVersion: "demo-v1", ModelSHA256: strings.Repeat("b", 64), Experimental: true, FeatureContract: "priority-features-v1", DatasetKind: "simulated_source_lab", TrainingRows: 6, Predictions: []PriorityPrediction{{Fingerprint: strings.Repeat("a", 64), Priority: priority}}})
		}))
		_, err := NewPredictionClient(server.URL).Predict(context.Background(), []PredictionItem{{Fingerprint: strings.Repeat("a", 64)}})
		server.Close()
		if (err == nil) != (priority == "High") {
			t.Fatalf("priority %s error %v", priority, err)
		}
	}
}

func TestLivePredictionRoute(t *testing.T) {
	url := os.Getenv("AUDITORX_TEST_PREDICTION_URL")
	if url == "" {
		t.Skip("set AUDITORX_TEST_PREDICTION_URL for the running service")
	}
	jobs := &predictionJobs{jobsStub: jobsStub{status: "completed"}, findings: []Finding{{Fingerprint: strings.Repeat("a", 64), RuleID: "auditorx.javascript.security.dynamic-eval", Severity: "High", File: "app/api/eval/route.ts"}}}
	mux := http.NewServeMux()
	Handler{Repositories: readerStub{access: "viewer"}, Jobs: jobs, Predictor: NewPredictionClient(url)}.RegisterRoutes(mux)
	r := httptest.NewRequest("POST", "/api/v1/repositories/"+alice+"/scans/"+bob+"/predictions", strings.NewReader(`{"repository_criticality":"low","exposure":"test_only","impact":"unknown"}`))
	r = r.WithContext(identity.WithUserID(r.Context(), alice))
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("live prediction: %d %s", w.Code, w.Body.String())
	}
	var payload struct {
		Data PredictionResult `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Data.ModelVersion != "lecture_decision_tree_v1" || len(payload.Data.Predictions) != 1 || payload.Data.Predictions[0].Priority != "High" {
		t.Fatalf("unexpected live prediction: %+v", payload.Data)
	}
}
