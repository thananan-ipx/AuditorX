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
}

func (q *queueStub) Claim(context.Context) (Job, error) { return Job{}, q.claimErr }
func (q *queueStub) Finish(_ context.Context, _ Job, _ Result, code string) error {
	q.finished = true
	q.code = code
	return q.finishErr
}

type sourceStub struct{ err error }

func (s sourceStub) Fetch(context.Context, Job, string) (string, error) {
	return strings.Repeat("a", 40), s.err
}

type analyzerStub struct {
	err    error
	cancel context.CancelFunc
}

func (a analyzerStub) Analyze(context.Context, string) (Result, error) {
	if a.cancel != nil {
		a.cancel()
	}
	return Result{}, a.err
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
			worker := Worker{Queue: q, Source: sourceStub{tc.sourceErr}, Analyzer: analyzerStub{err: tc.scanErr}}
			worked, err := worker.RunOne(context.Background())
			if err != nil || worked != tc.worked || q.finished != tc.finished || q.code != tc.code {
				t.Fatalf("outcome: %v %v %+v", worked, err, q)
			}
		})
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
