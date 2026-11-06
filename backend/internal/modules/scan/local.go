package scan

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"io/fs"
	"os"
	"path"
	"strings"
)

// Local paths are relative to the operator-mounted root, never arbitrary host paths.
func normalizeLocalPath(input, hostRoot string) (string, bool) {
	name := strings.TrimSpace(input)
	if len(name) >= 2 && name[0] == '"' && name[len(name)-1] == '"' {
		name = name[1 : len(name)-1]
	}
	name = strings.ReplaceAll(name, "\\", "/")
	root := strings.TrimRight(strings.ReplaceAll(hostRoot, "\\", "/"), "/")
	// Match a whole directory boundary, never a similarly named sibling root.
	if root != "" && len(name) > len(root) && strings.EqualFold(name[:len(root)+1], root+"/") {
		name = name[len(root)+1:]
	}
	return name, validLocalPath(name)
}

func validLocalPath(name string) bool {
	if len(name) == 0 || len(name) > 255 || !fs.ValidPath(name) || strings.ContainsAny(name, "\\:\x00") {
		return false
	}
	for _, part := range strings.Split(name, "/") {
		if strings.HasPrefix(part, ".") || strings.EqualFold(part, "node_modules") || strings.EqualFold(part, "vendor") {
			return false
		}
	}
	return true
}

type LocalSource struct{ Root string }

func (s LocalSource) Fetch(ctx context.Context, j Job, destination string) (string, error) {
	if s.Root == "" || j.SourceName == nil || !validLocalPath(*j.SourceName) {
		return "", errors.New("local source disabled or invalid path")
	}
	root, err := os.OpenRoot(s.Root)
	if err != nil {
		return "", err
	}
	defer root.Close()
	project, err := root.OpenRoot(*j.SourceName)
	if err != nil {
		return "", err
	}
	defer project.Close()
	var archive bytes.Buffer
	zw := zip.NewWriter(&archive)
	count, visited, total := 0, 0, 0
	err = fs.WalkDir(project.FS(), ".", func(name string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		visited++
		if visited > 100000 {
			return errors.New("too many source entries")
		}
		if name == "." {
			return nil
		}
		base := entry.Name()
		if entry.IsDir() {
			if strings.HasPrefix(base, ".") || strings.EqualFold(base, "node_modules") || strings.EqualFold(base, "vendor") {
				return fs.SkipDir
			}
			return nil
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return errors.New("source symlinks are not supported")
		}
		ext := strings.ToLower(path.Ext(name))
		if base != "package.json" && ext != ".py" && ext != ".js" && ext != ".jsx" && ext != ".ts" && ext != ".tsx" && ext != ".go" {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() || info.Size() > maxFileBytes {
			return errors.New("invalid source file")
		}
		file, err := project.Open(name)
		if err != nil {
			return err
		}
		data, readErr := io.ReadAll(io.LimitReader(file, maxFileBytes+1))
		file.Close()
		if readErr != nil {
			return readErr
		}
		count++
		total += len(data)
		if len(data) > maxFileBytes || total > maxSourceBytes || count > 2000 {
			return errors.New("source limit exceeded")
		}
		out, err := zw.Create("local/" + name)
		if err != nil {
			return err
		}
		_, err = out.Write(data)
		return err
	})
	if err != nil {
		return "", err
	}
	if err = zw.Close(); err != nil {
		return "", err
	}
	// Apply the same filtering, manifest sanitization and limits as uploaded sources.
	if err = extractArchiveWithLimit(archive.Bytes(), destination, true, 2000); err != nil {
		return "", err
	}
	digest := sha256.Sum256(archive.Bytes())
	return hex.EncodeToString(digest[:]), nil
}
