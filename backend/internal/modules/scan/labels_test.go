package scan

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
)

type labelJobsStub struct {
	jobsStub
	saved []LabelInput
}

func (s *labelJobsStub) Labels(context.Context, string, string, string) ([]PriorityLabel, error) {
	return []PriorityLabel{}, nil
}
func (s *labelJobsStub) SaveLabel(_ context.Context, actor, repo, scan, fingerprint string, input LabelInput) (PriorityLabel, error) {
	s.saved = append(s.saved, input)
	return PriorityLabel{ID: 1, ScanID: scan, Fingerprint: fingerprint, Reviewer: actor, LabelInput: input}, nil
}
func TestLabelHTTP(t *testing.T) {
	valid := `{"repository_group":"crm","review_status":"accepted","priority_label":"High","repository_criticality":"normal","exposure":"public","impact":"high","label_reason":"Public input reaches eval"}`
	for _, tc := range []struct {
		name, access, body string
		want               int
	}{
		{"owner", "owner", valid, 201}, {"editor", "editor", valid, 201}, {"viewer", "viewer", valid, 403},
		{"simulated test label", "owner", strings.ReplaceAll(strings.Replace(valid, `"accepted"`, `"simulated"`, 1), `"public"`, `"test_only"`), 201},
		{"simulated requires test context", "owner", strings.Replace(valid, `"accepted"`, `"simulated"`, 1), 400},
		{"simulated requires priority", "owner", strings.ReplaceAll(strings.ReplaceAll(strings.Replace(valid, `"accepted"`, `"simulated"`, 1), `"public"`, `"test_only"`), `"High"`, `""`), 400},
		{"forged reviewer", "owner", strings.Replace(valid, `"repository_group"`, `"reviewer":"forged","repository_group"`, 1), 400},
		{"missing label", "owner", strings.Replace(valid, `"High"`, `""`, 1), 400},
		{"invalid class", "owner", strings.Replace(valid, `"High"`, `"Critical"`, 1), 400},
		{"excluded cannot be training label", "owner", strings.Replace(valid, `"accepted"`, `"excluded"`, 1), 400},
		{"missing reason", "owner", strings.Replace(valid, `"Public input reaches eval"`, `" "`, 1), 400},
	} {
		t.Run(tc.name, func(t *testing.T) {
			jobs := &labelJobsStub{}
			mux := http.NewServeMux()
			Handler{Repositories: readerStub{access: tc.access}, Jobs: jobs}.RegisterRoutes(mux)
			r := httptest.NewRequest("POST", "/api/v1/repositories/"+alice+"/scans/"+bob+"/findings/"+strings.Repeat("f", 64)+"/labels", strings.NewReader(tc.body))
			r = r.WithContext(identity.WithUserID(r.Context(), alice))
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, r)
			if w.Code != tc.want {
				t.Fatalf("%d %s", w.Code, w.Body.String())
			}
			if tc.want != 201 && len(jobs.saved) != 0 {
				t.Fatal("invalid label saved")
			}
		})
	}
}
