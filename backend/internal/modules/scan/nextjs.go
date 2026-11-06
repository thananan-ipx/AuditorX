package scan

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const maxManifestBytes = 64 << 10

func declaresNext(data []byte) bool {
	var manifest struct {
		Dependencies    map[string]json.RawMessage `json:"dependencies"`
		DevDependencies map[string]json.RawMessage `json:"devDependencies"`
	}
	if json.Unmarshal(data, &manifest) != nil {
		return false
	}
	for _, deps := range []map[string]json.RawMessage{manifest.Dependencies, manifest.DevDependencies} {
		var version string
		if json.Unmarshal(deps["next"], &version) == nil && strings.TrimSpace(version) != "" {
			return true
		}
	}
	return false
}

// Keep only a framework marker, never package scripts, credentials, dependency
// URLs or executable configuration. A non-Next manifest also marks a package
// boundary in a monorepo.
func sanitizedManifest(data []byte) []byte {
	if declaresNext(data) {
		return []byte(`{"dependencies":{"next":"*"}}`)
	}
	return []byte(`{}`)
}

// The nearest package.json owns a source file. Next.js checks in a monorepo
// therefore do not spill into a sibling React app or Node service.
func nextjsTargets(ctx context.Context, root string) ([]string, error) {
	packages := map[string]bool{}
	files := []string{}
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if err = ctx.Err(); err != nil {
			return err
		}
		if entry.IsDir() {
			if path != root && (strings.HasPrefix(entry.Name(), ".") || strings.EqualFold(entry.Name(), "node_modules") || strings.EqualFold(entry.Name(), "vendor")) {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.Type()&fs.ModeSymlink != 0 {
			return errors.New("source symlink is not supported")
		}
		if entry.Name() == "package.json" {
			info, e := entry.Info()
			if e != nil {
				return e
			}
			if info.Size() > maxManifestBytes {
				return errors.New("package manifest exceeds size limit")
			}
			data, e := os.ReadFile(path)
			if e != nil {
				return e
			}
			packages[filepath.Dir(path)] = declaresNext(data)
		}
		switch strings.ToLower(filepath.Ext(entry.Name())) {
		case ".js", ".jsx", ".ts", ".tsx":
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	targets := []string{}
	for _, file := range files {
		for dir := filepath.Dir(file); ; dir = filepath.Dir(dir) {
			if next, exists := packages[dir]; exists {
				if next {
					relative, e := filepath.Rel(root, file)
					if e != nil {
						return nil, e
					}
					targets = append(targets, filepath.ToSlash(relative))
				}
				break
			}
			if dir == root || filepath.Dir(dir) == dir {
				break
			}
		}
	}
	sort.Strings(targets)
	return targets, nil
}
