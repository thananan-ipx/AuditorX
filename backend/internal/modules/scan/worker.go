package scan

import (
	"context"
	"errors"
	"os"
	"time"
)

type Queue interface {
	Claim(context.Context) (Job, error)
	Finish(context.Context, Job, Result, string) error
}
type Worker struct {
	Queue    Queue
	Source   Source
	Analyzer Analyzer
}

// RunOne is also used by the isolated acceptance harness with a fixture Source.
// A shutdown leaves the durable job leased; a subsequent worker reclaims it.
func (w Worker) RunOne(ctx context.Context) (bool, error) {
	job, err := w.Queue.Claim(ctx)
	if errors.Is(err, ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	scanCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	directory, err := os.MkdirTemp("", "auditorx-source-")
	code := ""
	result := Result{}
	if err != nil {
		code = "SOURCE_UNAVAILABLE"
	} else {
		defer os.RemoveAll(directory)
		sha, fetchErr := w.Source.Fetch(scanCtx, job, directory)
		if fetchErr != nil {
			code = "SOURCE_UNAVAILABLE"
		} else if job.SourceKind == "upload" && !uploadDigestPattern.MatchString(sha) {
			code = "INVALID_SOURCE_DIGEST"
		} else if job.SourceKind != "upload" && !shaPattern.MatchString(sha) {
			code = "INVALID_COMMIT"
		} else {
			result, err = w.Analyzer.Analyze(scanCtx, directory, job.RulesVersion)
			result.CommitSHA = sha
			if err != nil {
				code = "SCANNER_FAILED"
			}
		}
	}
	if ctx.Err() != nil {
		return true, ctx.Err()
	}
	if scanCtx.Err() != nil {
		code = "SCAN_TIMEOUT"
	}
	finishCtx, finishCancel := context.WithTimeout(ctx, 15*time.Second)
	defer finishCancel()
	err = w.Queue.Finish(finishCtx, job, result, code)
	if errors.Is(err, ErrLeaseLost) {
		return true, nil
	}
	return true, err
}
