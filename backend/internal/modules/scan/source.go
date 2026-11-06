package scan

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const maxArchiveBytes = 20 << 20
const maxSourceBytes = 20 << 20
const maxFileBytes = 1 << 20

var shaPattern = regexp.MustCompile(`^[0-9a-f]{40}$`)
var uploadDigestPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
var sourceURLPattern = regexp.MustCompile(`^https://github\.com/([a-z0-9][a-z0-9-]{0,38})/([a-z0-9_.-]{1,100})$`)
var sourceBranchPattern = regexp.MustCompile(`^[a-zA-Z0-9_][a-zA-Z0-9_./-]{0,254}$`)

type Source interface {
	Fetch(context.Context, Job, string) (string, error)
}

// JobSource selects only between the two source kinds persisted by the API.
// Uploaded archives have already passed the same extraction validation once,
// but are hashed and validated again at the worker trust boundary.
type JobSource struct{ GitHub Source }

func (s JobSource) Fetch(ctx context.Context, j Job, destination string) (string, error) {
	if j.SourceKind == "local" {
		return (LocalSource{Root: os.Getenv("LOCAL_SCAN_ROOT")}).Fetch(ctx, j, destination)
	}
	if j.SourceKind != "upload" {
		if s.GitHub != nil {
			return s.GitHub.Fetch(ctx, j, destination)
		}
		return (GitHubSource{}).Fetch(ctx, j, destination)
	}
	if j.SourceDigest == nil || !uploadDigestPattern.MatchString(*j.SourceDigest) || len(j.Archive) == 0 {
		return "", errors.New("invalid uploaded source")
	}
	digest := sha256.Sum256(j.Archive)
	if hex.EncodeToString(digest[:]) != *j.SourceDigest {
		return "", errors.New("uploaded source digest mismatch")
	}
	if err := extractUploadedSource(j.Archive, destination); err != nil {
		return "", err
	}
	return *j.SourceDigest, nil
}

// GitHubSource fetches PUBLIC repositories without credentials. URLs cannot be
// supplied directly by the caller, and redirects/proxies are not followed.
type GitHubSource struct{}

func (GitHubSource) Fetch(ctx context.Context, j Job, destination string) (string, error) {
	parts := sourceURLPattern.FindStringSubmatch(j.RepositoryURL)
	if len(parts) != 3 || parts[2] == "." || parts[2] == ".." || !sourceBranchPattern.MatchString(j.Branch) || strings.Contains(j.Branch, "..") {
		return "", errors.New("invalid source")
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: 45 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("redirect refused") }}
	read := func(address string, limit int64) ([]byte, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", "AuditorX-scan-worker")
		req.Header.Set("Accept", "application/vnd.github+json")
		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			return nil, errors.New("public source unavailable")
		}
		content, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
		if err != nil {
			return nil, err
		}
		if int64(len(content)) > limit {
			return nil, errors.New("source size limit exceeded")
		}
		return content, nil
	}
	commitData, err := read("https://api.github.com/repos/"+parts[1]+"/"+parts[2]+"/commits/"+url.PathEscape(j.Branch), 2<<20)
	if err != nil {
		return "", err
	}
	var commit struct {
		SHA string `json:"sha"`
	}
	if json.Unmarshal(commitData, &commit) != nil || !shaPattern.MatchString(commit.SHA) {
		return "", errors.New("invalid commit response")
	}
	archive, err := read("https://codeload.github.com/"+parts[1]+"/"+parts[2]+"/zip/"+commit.SHA, maxArchiveBytes)
	if err != nil {
		return "", err
	}
	if err = extractSource(archive, destination); err != nil {
		return "", err
	}
	return commit.SHA, nil
}

// extractSource accepts only regular source files. It never restores symlinks,
// executables, repository config, .git, dependency directories or install hooks.
func extractSource(data []byte, destination string) error {
	return extractArchive(data, destination, true)
}

func extractUploadedSource(data []byte, destination string) error {
	return extractArchive(data, destination, false)
}

func extractArchive(data []byte, destination string, requireWrapper bool) error {
	return extractArchiveWithLimit(data, destination, requireWrapper, 1000)
}

func extractArchiveWithLimit(data []byte, destination string, requireWrapper bool, maxFiles int) error {
	if len(data) > maxArchiveBytes {
		return errors.New("archive too large")
	}
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}
	if len(reader.File) > 2000 {
		return errors.New("too many archive entries")
	}
	seen := map[string]bool{}
	root := ""
	stripRoot := requireWrapper
	if !requireWrapper {
		stripRoot = commonArchiveRoot(reader.File) != ""
	}
	total := int64(0)
	count := 0
	sourceCount := 0
	for _, entry := range reader.File {
		name := strings.TrimSuffix(entry.Name, "/")
		parts := strings.Split(name, "/")
		if name == "" || path.IsAbs(name) || strings.ContainsAny(name, "\\:\x00") {
			return errors.New("unsafe archive path")
		}
		for _, part := range parts {
			if part == "" || part == "." || part == ".." || strings.TrimRight(part, " .") != part || len(part) > 100 {
				return errors.New("unsafe archive component")
			}
			base := strings.ToUpper(strings.Split(part, ".")[0])
			if base == "CON" || base == "PRN" || base == "AUX" || base == "NUL" || regexp.MustCompile(`^(COM|LPT)[0-9]$`).MatchString(base) {
				return errors.New("reserved archive name")
			}
		}
		if stripRoot {
			if root == "" {
				root = parts[0]
			} else if root != parts[0] {
				return errors.New("multiple archive roots")
			}
		}
		if entry.Mode()&os.ModeSymlink != 0 || (!entry.FileInfo().IsDir() && !entry.Mode().IsRegular()) {
			return errors.New("non-regular archive entry")
		}
		if entry.FileInfo().IsDir() {
			continue
		}
		if stripRoot && len(parts) < 2 {
			return errors.New("source file outside repository root")
		}
		relative := name
		if stripRoot {
			relative = strings.Join(parts[1:], "/")
		}
		if len(relative) > 500 {
			return errors.New("source path too long")
		}
		key := strings.ToLower(relative)
		if seen[key] {
			return errors.New("duplicate archive path")
		}
		seen[key] = true
		skip := false
		relativeParts := strings.Split(relative, "/")
		for _, part := range relativeParts[:len(relativeParts)-1] {
			lowerPart := strings.ToLower(part)
			if strings.HasPrefix(part, ".") || lowerPart == "node_modules" || lowerPart == "vendor" {
				skip = true
			}
		}
		extension := strings.ToLower(path.Ext(relative))
		manifest := path.Base(relative) == "package.json"
		if skip || (!manifest && extension != ".py" && extension != ".js" && extension != ".jsx" && extension != ".ts" && extension != ".tsx" && extension != ".go") {
			continue
		}
		if entry.UncompressedSize64 > maxFileBytes {
			return errors.New("source file too large")
		}
		if manifest && entry.UncompressedSize64 > maxManifestBytes {
			return errors.New("package manifest exceeds size limit")
		}
		total += int64(entry.UncompressedSize64)
		count++
		if total > maxSourceBytes || count > maxFiles {
			return errors.New("source limit exceeded")
		}
		target := filepath.Join(destination, filepath.FromSlash(relative))
		if !filepath.IsLocal(filepath.FromSlash(relative)) {
			return errors.New("non-local path")
		}
		if err = os.MkdirAll(filepath.Dir(target), 0700); err != nil {
			return err
		}
		input, e := entry.Open()
		if e != nil {
			return e
		}
		if manifest {
			data, readErr := io.ReadAll(io.LimitReader(input, maxManifestBytes+1))
			closeErr := input.Close()
			if readErr != nil {
				return readErr
			}
			if closeErr != nil {
				return closeErr
			}
			if len(data) > maxManifestBytes {
				return errors.New("package manifest exceeds size limit")
			}
			if e = os.WriteFile(target, sanitizedManifest(data), 0600); e != nil {
				return e
			}
			continue
		}
		sourceCount++
		output, e := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if e != nil {
			input.Close()
			return e
		}
		written, e := io.Copy(output, io.LimitReader(input, maxFileBytes+1))
		closeErr := output.Close()
		input.Close()
		if e != nil {
			return e
		}
		if closeErr != nil {
			return closeErr
		}
		if written > maxFileBytes {
			return errors.New("source file too large")
		}
	}
	if sourceCount == 0 {
		return errors.New("no supported source files")
	}
	return nil
}

func commonArchiveRoot(files []*zip.File) string {
	root := ""
	for _, entry := range files {
		name := strings.TrimSuffix(entry.Name, "/")
		parts := strings.Split(name, "/")
		if name == "" || len(parts) < 2 {
			if !entry.FileInfo().IsDir() {
				return ""
			}
			continue
		}
		if root == "" {
			root = parts[0]
		} else if root != parts[0] {
			return ""
		}
	}
	return root
}
