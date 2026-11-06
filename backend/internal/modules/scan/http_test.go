package scan

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	project "github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
)

type readerStub struct {
	access string
	err    error
}

func (s readerStub) Get(context.Context, string) (project.Repository, error) {
	return project.Repository{ID: alice, Branch: "main", AccessLevel: s.access}, s.err
}

type jobsStub struct {
	calls  int
	err    error
	status string
}

func (s *jobsStub) EnqueueLocal(context.Context, string, string, string, string, ...PredictionContext) (Job, error) {
	s.calls++
	return Job{ID: bob, Status: "queued", SourceKind: "local"}, s.err
}

func TestEnqueueLocalHTTP(t *testing.T) {
	t.Setenv("LOCAL_SCAN_ENABLED", "true")
	t.Setenv("LOCAL_SCAN_HOST_ROOT", `C:\Projects`)
	for _, tc := range []struct {
		access, body string
		want         int
	}{
		{"owner", `{"path":"auditor-x"}`, 202},
		{"owner", `{"path":"\"C:\\Projects\\crm-new-idea-front\""}`, 202},
		{"editor", `{"path":"auditor-x/frontend"}`, 202},
		{"viewer", `{"path":"auditor-x"}`, 403},
		{"owner", `{"path":"../other"}`, 400},
		{"owner", `{"path":"/etc"}`, 400},
		{"owner", `{"path":"auditor-x"} {}`, 400},
	} {
		jobs := &jobsStub{}
		mux := http.NewServeMux()
		Handler{Repositories: readerStub{access: tc.access}, Jobs: jobs}.RegisterRoutes(mux)
		r := httptest.NewRequest("POST", "/api/v1/repositories/"+alice+"/scans/local", strings.NewReader(tc.body))
		r = r.WithContext(identity.WithUserID(r.Context(), alice))
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != tc.want {
			t.Fatalf("%s %s: %d %s", tc.access, tc.body, w.Code, w.Body.String())
		}
		if tc.want != 202 && jobs.calls != 0 {
			t.Fatal("unauthorized/invalid request queued")
		}
	}
}

func (s *jobsStub) Enqueue(context.Context, string, string, string, ...PredictionContext) (Job, error) {
	s.calls++
	return Job{ID: bob, Status: "queued"}, s.err
}
func (s *jobsStub) EnqueueUpload(context.Context, string, string, string, string, string, []byte, ...PredictionContext) (Job, error) {
	s.calls++
	return Job{ID: bob, Status: "queued", SourceKind: "upload"}, s.err
}
func (s *jobsStub) Get(context.Context, string, string, string) (Job, error) {
	s.calls++
	return Job{ID: bob, Status: s.status}, s.err
}

func uploadRequest(t *testing.T, field, filename string, content []byte) (*http.Request, string) {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile(field, filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = part.Write(content); err != nil {
		t.Fatal(err)
	}
	if err = writer.Close(); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest("POST", "/api/v1/repositories/"+alice+"/scans/upload", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	return request, writer.FormDataContentType()
}

func TestEnqueueUploadHTTP(t *testing.T) {
	var archive bytes.Buffer
	zw := zip.NewWriter(&archive)
	entry, err := zw.Create("app.py")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = entry.Write([]byte("print('safe')\n"))
	if err = zw.Close(); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name, access, field, filename string
		content                       []byte
		want, calls                   int
	}{
		{name: "zip", access: "owner", field: "archive", filename: "project.zip", content: archive.Bytes(), want: 202, calls: 1},
		{name: "folder", access: "editor", field: "file:src/app.py", filename: "app.py", content: []byte("print('safe')\n"), want: 202, calls: 1},
		{name: "viewer", access: "viewer", field: "archive", filename: "project.zip", content: archive.Bytes(), want: 403},
		{name: "wrong type", access: "owner", field: "archive", filename: "project.txt", content: archive.Bytes(), want: 400},
		{name: "invalid zip", access: "owner", field: "archive", filename: "project.zip", content: []byte("not a zip"), want: 400},
	} {
		t.Run(tc.name, func(t *testing.T) {
			jobs := &jobsStub{}
			mux := http.NewServeMux()
			Handler{Repositories: readerStub{access: tc.access}, Jobs: jobs}.RegisterRoutes(mux)
			request, _ := uploadRequest(t, tc.field, tc.filename, tc.content)
			request = request.WithContext(identity.WithUserID(request.Context(), alice))
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, request)
			if rec.Code != tc.want || jobs.calls != tc.calls {
				t.Fatalf("status/calls=%d/%d body=%s", rec.Code, jobs.calls, rec.Body)
			}
		})
	}
}
func (s *jobsStub) List(context.Context, string, string) ([]Job, error) {
	s.calls++
	return []Job{}, s.err
}
func (s *jobsStub) Findings(context.Context, string, string, string) ([]Finding, error) {
	s.calls++
	return []Finding{}, s.err
}
func (s *jobsStub) Cancel(context.Context, string, string, string) (Job, error) {
	s.calls++
	return Job{Status: "cancelled"}, s.err
}

func TestEnqueueHTTP(t *testing.T) {
	for _, tc := range []struct {
		name, actor, access, body string
		storeErr                  error
		want, calls               int
	}{
		{name: "valid", actor: alice, access: "owner", body: `{"branch":"main","rule_profile":"recommended"}`, want: 202, calls: 1},
		{name: "editor", actor: alice, access: "editor", body: `{}`, want: 202, calls: 1},
		{name: "unauthorized", access: "owner", body: `{}`, want: 401},
		{name: "viewer", actor: alice, access: "viewer", body: `{}`, want: 403},
		{name: "branch", actor: alice, access: "owner", body: `{"branch":"other"}`, want: 400},
		{name: "rules", actor: alice, access: "owner", body: `{"rule_profile":"https://evil/rules"}`, want: 400},
		{name: "extra fields", actor: alice, access: "owner", body: `{"requested_by":"other"}`, want: 400},
		{name: "two bodies", actor: alice, access: "owner", body: `{} {}`, want: 400},
		{name: "empty", actor: alice, access: "owner", body: ``, want: 400},
		{name: "oversized", actor: alice, access: "owner", body: `{"branch":"` + strings.Repeat("a", 2100) + `"}`, want: 400},
		{name: "duplicate", actor: alice, access: "owner", body: `{}`, storeErr: ErrConflict, want: 409, calls: 1},
		{name: "store unavailable", actor: alice, access: "owner", body: `{}`, storeErr: errors.New("password=secret"), want: 503, calls: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			jobs := &jobsStub{err: tc.storeErr}
			mux := http.NewServeMux()
			Handler{Repositories: readerStub{access: tc.access}, Jobs: jobs}.RegisterRoutes(mux)
			request := httptest.NewRequest("POST", "/api/v1/repositories/"+alice+"/scans", strings.NewReader(tc.body))
			request = request.WithContext(identity.WithUserID(request.Context(), tc.actor))
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, request)
			if rec.Code != tc.want || jobs.calls != tc.calls {
				t.Fatalf("status/calls=%d/%d body=%s", rec.Code, jobs.calls, rec.Body)
			}
			if strings.Contains(rec.Body.String(), "secret") {
				t.Fatal("store error leaked")
			}
		})
	}
}

func TestFindingsRequireCompletedScan(t *testing.T) {
	jobs := &jobsStub{status: "running"}
	mux := http.NewServeMux()
	Handler{Repositories: readerStub{access: "viewer"}, Jobs: jobs}.RegisterRoutes(mux)
	request := httptest.NewRequest("GET", "/api/v1/repositories/"+alice+"/scans/"+bob+"/findings", nil)
	request = request.WithContext(identity.WithUserID(request.Context(), alice))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, request)
	if rec.Code != 409 || jobs.calls != 1 {
		t.Fatalf("incomplete findings: %d %d", rec.Code, jobs.calls)
	}
}
