package scan

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
)

type runJobsStub struct {
	jobsStub
	retries int
}

func (s *runJobsStub) LatestPrediction(context.Context, string, string, string) (PredictionRun, error) {
	return PredictionRun{ID: 1, Status: "completed", LeaseToken: "private-token", Result: &PredictionResult{ModelVersion: "fixture"}}, nil
}
func (s *runJobsStub) RetryPrediction(context.Context, string, string, string) (PredictionRun, error) {
	s.retries++
	return PredictionRun{ID: 2, Status: "queued"}, nil
}
func TestPredictionRunRoutes(t *testing.T) {
	for _, tc := range []struct {
		access, method, suffix string
		want                   int
	}{{"viewer", "GET", "", 200}, {"viewer", "POST", "/retry", 403}, {"owner", "POST", "/retry", 202}} {
		jobs := &runJobsStub{jobsStub: jobsStub{status: "completed"}}
		mux := http.NewServeMux()
		Handler{Repositories: readerStub{access: tc.access}, Jobs: jobs}.RegisterRoutes(mux)
		r := httptest.NewRequest(tc.method, "/api/v1/repositories/"+alice+"/scans/"+bob+"/predictions"+tc.suffix, nil)
		r = r.WithContext(identity.WithUserID(r.Context(), alice))
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != tc.want {
			t.Fatalf("%s %s: %d %s", tc.access, tc.method, w.Code, w.Body.String())
		}
		if strings.Contains(w.Body.String(), "private-token") || strings.Contains(w.Body.String(), "lease_token") {
			t.Fatal("prediction lease exposed")
		}
		if tc.want == 403 && jobs.retries != 0 {
			t.Fatal("viewer queued a model run")
		}
	}
}

type predictionQueueStub struct {
	run      PredictionRun
	findings []Finding
	result   *PredictionResult
	finished bool
	err      error
}

func (q *predictionQueueStub) ClaimPrediction(context.Context) (PredictionRun, []Finding, error) {
	return q.run, q.findings, q.err
}
func (q *predictionQueueStub) FinishPrediction(_ context.Context, _ PredictionRun, result *PredictionResult) error {
	q.finished = true
	q.result = result
	return nil
}
func TestPredictionWorkerFailureAndEmptyScan(t *testing.T) {
	queue := &predictionQueueStub{findings: []Finding{{Fingerprint: strings.Repeat("a", 64), RuleID: "test", File: "test.ts", Severity: "High"}}}
	worker := PredictionWorker{Queue: queue, Predictor: &predictionStub{err: errors.New("offline")}}
	if worked, e := worker.RunOne(context.Background()); e != nil || !worked || !queue.finished || queue.result != nil {
		t.Fatalf("failure not scheduled for retry: %v %v", worked, e)
	}
	queue = &predictionQueueStub{}
	worker = PredictionWorker{Queue: queue}
	if worked, e := worker.RunOne(context.Background()); e != nil || !worked || !queue.finished || queue.result == nil || len(queue.result.Predictions) != 0 {
		t.Fatalf("empty scan: %v %v", worked, e)
	}
}
