package scan

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

var embeddedRuleStart = regexp.MustCompile(`(?m)^  - id: ([a-z0-9.-]+)\r?$`)
var embeddedRuleLanguages = regexp.MustCompile(`(?m)^    languages: \[([a-z, ]+)\]\r?$`)

// Rule paths are globs. Escape literal dynamic-route brackets and other glob
// characters so a path such as app/[id]/page.tsx stays inside its exact package.
func literalRulePath(path string) string {
	return strings.NewReplacer("\\", "\\\\", "[", "\\[", "]", "\\]", "*", "\\*", "?", "\\?", "!", "\\!", "#", "\\#").Replace(path)
}

func sourceLanguages(ctx context.Context, root string) ([]string, error) {
	found := map[string]bool{}
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
		switch strings.ToLower(filepath.Ext(entry.Name())) {
		case ".py":
			found["python"] = true
		case ".js", ".jsx":
			found["javascript"] = true
		case ".ts", ".tsx":
			found["typescript"] = true
		case ".go":
			found["go"] = true
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	languages := make([]string, 0, len(found))
	for language := range found {
		languages = append(languages, language)
	}
	sort.Strings(languages)
	if len(languages) == 0 {
		return nil, errors.New("no supported source languages")
	}
	return languages, nil
}

// Rules are embedded, reviewed YAML with fixed top-level block boundaries. Keep
// the rule bodies verbatim and filter only their language lists; never parse or
// load repository-supplied configuration. Catalog validation fails closed if an
// embedded file no longer matches this format.
func scopedRules(version string, languages []string, nextTargets ...string) ([]byte, []string, error) {
	rules, ok := rulesets[version]
	if !ok {
		return nil, nil, errors.New("unsupported rules version")
	}
	text := strings.ReplaceAll(string(rules), "\r\n", "\n")
	blocks := embeddedRuleStart.FindAllStringSubmatchIndex(text, -1)
	if len(blocks) != len(allowedRules[version]) || len(blocks) == 0 || strings.TrimSpace(text[:blocks[0][0]]) != "rules:" {
		return nil, nil, errors.New("invalid embedded ruleset")
	}
	present := map[string]bool{}
	for _, language := range languages {
		present[language] = true
	}
	var config strings.Builder
	config.WriteString("rules:\n")
	selected := make([]string, 0)
	seen := map[string]bool{}
	for i, match := range blocks {
		id := text[match[2]:match[3]]
		if !allowedRules[version][id] || seen[id] {
			return nil, nil, errors.New("invalid embedded rule identity")
		}
		seen[id] = true
		end := len(text)
		if i+1 < len(blocks) {
			end = blocks[i+1][0]
		}
		block := text[match[0]:end]
		isNext := strings.HasPrefix(id, "auditorx.nextjs.")
		if isNext && len(nextTargets) == 0 {
			continue
		}
		targets := nextTargets
		if id == "auditorx.nextjs.review.route-handler-access" {
			targets = []string{}
			for _, target := range nextTargets {
				p := "/" + target
				name := filepath.Base(target)
				if (strings.Contains(p, "/app/") && (name == "route.ts" || name == "route.js")) || strings.Contains(p, "/pages/api/") {
					targets = append(targets, target)
				}
			}
			if len(targets) == 0 {
				continue
			}
		}
		languageMatch := embeddedRuleLanguages.FindStringSubmatch(block)
		if len(languageMatch) != 2 {
			return nil, nil, errors.New("invalid embedded rule languages")
		}
		applicable := make([]string, 0)
		for _, language := range strings.Split(languageMatch[1], ",") {
			language = strings.TrimSpace(language)
			if present[language] {
				applicable = append(applicable, language)
			}
		}
		if len(applicable) == 0 {
			continue
		}
		config.WriteString(embeddedRuleLanguages.ReplaceAllString(block, "    languages: ["+strings.Join(applicable, ", ")+"]"))
		if !strings.HasSuffix(block, "\n") {
			config.WriteByte('\n')
		}
		if isNext {
			config.WriteString("    paths:\n      include:\n")
			for _, target := range targets {
				quoted, _ := json.Marshal(literalRulePath(target))
				config.WriteString("        - " + string(quoted) + "\n")
			}
		}
		selected = append(selected, id)
	}
	if len(selected) == 0 {
		return nil, nil, errors.New("no rules for source languages")
	}
	return []byte(config.String()), selected, nil
}
