package scan

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

type PredictionContext struct {
	RepositoryCriticality string `json:"repository_criticality"`
	Exposure              string `json:"exposure"`
	Impact                string `json:"impact"`
}

func (p PredictionContext) valid() bool {
	return oneOf(p.RepositoryCriticality, "unknown", "high", "normal", "low") && oneOf(p.Exposure, "unknown", "public", "authenticated", "internal", "test_only") && oneOf(p.Impact, "unknown", "high", "medium", "low")
}

type PredictionFeatures struct {
	PredictionContext
	Severity   string `json:"severity"`
	RuleFamily string `json:"rule_family"`
	Category   string `json:"category"`
	Language   string `json:"language"`
	FileType   string `json:"file_type"`
	RuleCount  int    `json:"rule_count_in_scan"`
}
type PredictionItem struct {
	Fingerprint string             `json:"fingerprint"`
	Features    PredictionFeatures `json:"features"`
}
type PriorityPrediction struct {
	Fingerprint string `json:"fingerprint"`
	Priority    string `json:"priority"`
}
type PredictionResult struct {
	ModelVersion    string               `json:"model_version"`
	ModelSHA256     string               `json:"model_sha256"`
	FeatureContract string               `json:"feature_contract"`
	Experimental    bool                 `json:"experimental"`
	DatasetKind     string               `json:"dataset_kind"`
	TrainingRows    int                  `json:"training_rows"`
	Predictions     []PriorityPrediction `json:"predictions"`
}
type Predictor interface {
	Predict(context.Context, []PredictionItem) (PredictionResult, error)
}
type PredictionClient struct {
	URL    string
	Client *http.Client
}

func NewPredictionClient(url string) *PredictionClient {
	return &PredictionClient{URL: strings.TrimRight(url, "/"), Client: &http.Client{Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
}
func (p *PredictionClient) Predict(ctx context.Context, items []PredictionItem) (PredictionResult, error) {
	body, err := json.Marshal(map[string]any{"items": items})
	if err != nil {
		return PredictionResult{}, err
	}
	request, err := http.NewRequestWithContext(ctx, "POST", p.URL+"/predict", bytes.NewReader(body))
	if err != nil {
		return PredictionResult{}, err
	}
	request.Header.Set("Content-Type", "application/json")
	res, err := p.Client.Do(request)
	if err != nil {
		return PredictionResult{}, err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return PredictionResult{}, errors.New("prediction service unavailable")
	}
	var result PredictionResult
	decoder := json.NewDecoder(io.LimitReader(res.Body, 1<<20))
	if err = decoder.Decode(&result); err != nil {
		return result, err
	}
	if decoder.Decode(new(any)) != io.EOF || !result.Experimental || result.DatasetKind != "simulated_source_lab" || result.FeatureContract != "priority-features-v1" || len(result.ModelVersion) == 0 || len(result.ModelVersion) > 100 || !fingerprintPattern.MatchString(result.ModelSHA256) || result.TrainingRows < 1 || len(result.Predictions) != len(items) {
		return PredictionResult{}, errors.New("invalid prediction contract")
	}
	expected := map[string]bool{}
	for _, item := range items {
		expected[item.Fingerprint] = true
	}
	for _, prediction := range result.Predictions {
		if !expected[prediction.Fingerprint] || !oneOf(prediction.Priority, "High", "Medium", "Low") {
			return PredictionResult{}, errors.New("invalid prediction response")
		}
		delete(expected, prediction.Fingerprint)
	}
	return result, nil
}

// This mirrors priority-features-v1 CSV extraction; no paths, reasons or target labels are sent.
func predictionItems(findings []Finding, input PredictionContext) []PredictionItem {
	counts := map[string]int{}
	for _, f := range findings {
		counts[f.RuleID]++
	}
	items := make([]PredictionItem, 0, len(findings))
	for _, f := range findings {
		family := f.RuleID
		for _, prefix := range []string{"auditorx.python.", "auditorx.javascript.", "auditorx.go."} {
			family = strings.TrimPrefix(family, prefix)
		}
		category := "unknown"
		switch {
		case oneOf(f.RuleID, "auditorx.python.dynamic-eval", "auditorx.javascript.dynamic-eval", "auditorx.go.tls-verification-disabled"):
			category = "Security"
		case strings.Contains(f.RuleID, ".security."):
			category = "Security"
		case strings.Contains(f.RuleID, ".coding-standard."):
			category = "Coding standard"
		case strings.Contains(f.RuleID, ".code-quality."):
			category = "Code quality"
		case strings.Contains(f.RuleID, ".review."):
			category = "Manual review"
		}
		extension := strings.TrimPrefix(strings.ToLower(path.Ext(f.File)), ".")
		if extension == "" {
			extension = "unknown"
		}
		language := map[string]string{"py": "python", "js": "javascript", "jsx": "javascript", "ts": "typescript", "tsx": "typescript", "go": "go"}[extension]
		if language == "" {
			language = "unknown"
		}
		items = append(items, PredictionItem{Fingerprint: f.Fingerprint, Features: PredictionFeatures{PredictionContext: input, Severity: f.Severity, RuleFamily: family, Category: category, Language: language, FileType: extension, RuleCount: counts[f.RuleID]}})
	}
	return items
}
func (h Handler) Predict(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.repository(w, r, false)
	if !ok {
		return
	}
	actor, id := identity.UserID(r.Context()), r.PathValue("scanID")
	job, err := h.Jobs.Get(r.Context(), actor, repo.ID, id)
	if err != nil {
		writeError(w, err)
		return
	}
	if job.Status != "completed" {
		response.Error(w, 409, "SCAN_NOT_COMPLETED", "Complete the scan before predicting priority.")
		return
	}
	var input PredictionContext
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF || !input.valid() {
		response.Error(w, 400, "INVALID_PREDICTION_CONTEXT", "Provide repository_criticality, exposure and impact using supported values.")
		return
	}
	if h.Predictor == nil {
		response.Error(w, 503, "PREDICTION_UNAVAILABLE", "The prediction service is not configured.")
		return
	}
	findings, err := h.Jobs.Findings(r.Context(), actor, repo.ID, id)
	if err != nil {
		writeError(w, err)
		return
	}
	if len(findings) == 0 {
		response.Error(w, 409, "NO_FINDINGS", "This scan has no findings to predict.")
		return
	}
	result, err := h.Predictor.Predict(r.Context(), predictionItems(findings, input))
	if err != nil {
		response.Error(w, 503, "PREDICTION_UNAVAILABLE", "The prediction service is unavailable. Try again later.")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, 200, map[string]any{"data": result})
}
