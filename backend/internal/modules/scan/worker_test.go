package scan

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type queueStub struct {
	claimErr, finishErr error
	finished            bool
	code                string
	job                 Job
}

func (q *queueStub) Claim(context.Context) (Job, error) { return q.job, q.claimErr }
func (q *queueStub) Finish(_ context.Context, _ Job, _ Result, code string) error {
	q.finished = true
	q.code = code
	return q.finishErr
}

type sourceStub struct {
	err      error
	revision string
}

func (s sourceStub) Fetch(context.Context, Job, string) (string, error) {
	if s.revision != "" {
		return s.revision, s.err
	}
	return strings.Repeat("a", 40), s.err
}

type analyzerStub struct {
	err    error
	cancel context.CancelFunc
	seen   *string
}

func (a analyzerStub) Analyze(_ context.Context, _, rulesVersion string) (Result, error) {
	if a.seen != nil {
		*a.seen = rulesVersion
	}
	if a.cancel != nil {
		a.cancel()
	}
	return Result{}, a.err
}

func TestWorkerUsesPersistedRulesVersion(t *testing.T) {
	q := &queueStub{job: Job{RulesVersion: "baseline-v1"}}
	seen := ""
	worker := Worker{Queue: q, Source: sourceStub{}, Analyzer: analyzerStub{seen: &seen}}
	worked, err := worker.RunOne(context.Background())
	if err != nil || !worked || seen != "baseline-v1" {
		t.Fatalf("worker used rules %q: worked=%v err=%v", seen, worked, err)
	}
}

func TestWorkerOutcomes(t *testing.T) {
	for _, tc := range []struct {
		name                                    string
		claimErr, sourceErr, scanErr, finishErr error
		code                                    string
		worked, finished                        bool
	}{
		{name: "empty", claimErr: ErrNotFound},
		{name: "success", worked: true, finished: true},
		{name: "source failure", sourceErr: errors.New("private detail"), code: "SOURCE_UNAVAILABLE", worked: true, finished: true},
		{name: "scan failure", scanErr: errors.New("private source"), code: "SCANNER_FAILED", worked: true, finished: true},
		{name: "cancelled during scan", finishErr: ErrLeaseLost, worked: true, finished: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			q := &queueStub{claimErr: tc.claimErr, finishErr: tc.finishErr}
			worker := Worker{Queue: q, Source: sourceStub{err: tc.sourceErr}, Analyzer: analyzerStub{err: tc.scanErr}}
			worked, err := worker.RunOne(context.Background())
			if err != nil || worked != tc.worked || q.finished != tc.finished || q.code != tc.code {
				t.Fatalf("outcome: %v %v %+v", worked, err, q)
			}
		})
	}
}

func TestWorkerAcceptsUploadedSourceDigest(t *testing.T) {
	q := &queueStub{job: Job{SourceKind: "upload"}}
	worker := Worker{
		Queue:    q,
		Source:   sourceStub{revision: strings.Repeat("a", 64)},
		Analyzer: analyzerStub{},
	}
	worked, err := worker.RunOne(context.Background())
	if err != nil || !worked || !q.finished || q.code != "" {
		t.Fatalf("upload outcome: worked=%v err=%v queue=%+v", worked, err, q)
	}
}

func TestWorkerRejectsInvalidUploadedSourceDigest(t *testing.T) {
	q := &queueStub{job: Job{SourceKind: "upload"}}
	worker := Worker{
		Queue:    q,
		Source:   sourceStub{revision: strings.Repeat("a", 40)},
		Analyzer: analyzerStub{},
	}
	worked, err := worker.RunOne(context.Background())
	if err != nil || !worked || !q.finished || q.code != "INVALID_SOURCE_DIGEST" {
		t.Fatalf("upload outcome: worked=%v err=%v queue=%+v", worked, err, q)
	}
}
func TestShutdownLeavesJobForLeaseRecovery(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	q := &queueStub{}
	worker := Worker{Queue: q, Source: sourceStub{}, Analyzer: analyzerStub{cancel: cancel}}
	worked, err := worker.RunOne(ctx)
	if !worked || !errors.Is(err, context.Canceled) || q.finished {
		t.Fatalf("shutdown: %v %v %+v", worked, err, q)
	}
}
