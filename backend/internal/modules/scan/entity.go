// Package scan implements durable scan jobs. It never executes repository code.
package scan

import (
	"errors"
	"time"
)

var (
	ErrNotFound  = errors.New("scan not found")
	ErrConflict  = errors.New("a scan is already active or no longer cancellable")
	ErrLeaseLost = errors.New("scan lease lost")
)

type Job struct {
	ID              string     `json:"id"`
	RepositoryID    string     `json:"repository_id"`
	RequestedBy     string     `json:"requested_by"`
	Branch          string     `json:"branch"`
	RulesVersion    string     `json:"rules_version"`
	Status          string     `json:"status"`
	Attempts        int        `json:"attempts"`
	CommitSHA       *string    `json:"commit_sha"`
	ScannerVersion  *string    `json:"scanner_version"`
	ErrorCode       *string    `json:"error_code"`
	SourceKind      string     `json:"source_kind"`
	SourceName      *string    `json:"source_name"`
	SourceDigest    *string    `json:"source_digest"`
	CreatedAt       time.Time  `json:"created_at"`
	StartedAt       *time.Time `json:"started_at"`
	FinishedAt      *time.Time `json:"finished_at"`
	LeaseToken      string     `json:"-"`
	RepositoryURL   string     `json:"-"`
	Archive         []byte     `json:"-"`
	SourceLanguages []string   `json:"source_languages"`
	CheckedRuleIDs  []string   `json:"checked_rule_ids"`
}

type Finding struct {
	Fingerprint string `json:"fingerprint"`
	RuleID      string `json:"rule_id"`
	Severity    string `json:"severity"`
	File        string `json:"file"`
	Line        int    `json:"line"`
	EndLine     int    `json:"end_line"`
	Message     string `json:"message"`
}

type Result struct {
	SourceLanguages []string
	CheckedRuleIDs  []string
	CommitSHA       string
	ScannerVersion  string
	Findings        []Finding
}
