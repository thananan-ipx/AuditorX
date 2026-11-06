import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FormField } from "../components/shared/form-field";
import { Feedback } from "../components/shared/feedback";
import { Progress } from "../components/ui/progress";
import { CardDescription } from "../components/ui/card";
import { Typography } from "../components/ui/typography";
import { SelectField } from "../components/shared/select-field";

test("shared fields associate labels, help and validation errors without dropping caller descriptions", () => {
  const html = renderToStaticMarkup(createElement(FormField, {
    id: "url", label: "Repository URL", name: "repository_url", type: "url", required: true,
    description: "Public GitHub URL", error: "Invalid URL", "aria-describedby": "external-help",
  }));
  assert.match(html, /for="url"/);
  assert.match(html, /id="url"/);
  assert.match(html, /name="repository_url"/);
  assert.match(html, /type="url"/);
  assert.match(html, /required=""/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /aria-describedby="external-help url-help url-error"/);
  assert.match(html, /id="url-help"/);
  assert.match(html, /role="alert"[^>]*id="url-error"/);
});

test("shared selectors preserve accessible labeling, help and disabled state", () => {
  const html = renderToStaticMarkup(createElement(SelectField, {
    id: "priority-filter", label: "Priority", description: "Filter by priority",
    value: "High", options: [{ value: "High", label: "High" }], disabled: true,
    onValueChange() {},
  }));
  assert.match(html, /for="priority-filter"/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /id="priority-filter"/);
  assert.match(html, /aria-describedby="priority-filter-help"/);
  assert.match(html, /id="priority-filter-help"/);
  assert.match(html, /disabled=""/);
});

test("shared feedback announces errors assertively and routine updates politely", () => {
  const error = renderToStaticMarkup(createElement(Feedback, { tone: "error" }, "Try again"));
  const success = renderToStaticMarkup(createElement(Feedback, { tone: "success" }, "Saved"));
  const note = renderToStaticMarkup(createElement(Feedback, { role: "note" }, "Demo workspace"));
  assert.match(error, /role="alert"/);
  assert.match(success, /role="status"/);
  assert.match(note, /role="note"/);
});

test("progress exposes the same bounded value to assistive technology and the visual indicator", () => {
  for (const [value, expected] of [[45, 45], [150, 100], [-10, 0], [Number.NaN, 0]]) {
    const html = renderToStaticMarkup(createElement(Progress, { value }));
    assert.match(html, new RegExp(`aria-valuenow="${expected}"`));
    assert.match(html, new RegExp(`translateX\\(-${100 - expected}%\\)`));
  }
  const html = renderToStaticMarkup(createElement(Progress, { value: 10, max: 20 }));
  assert.match(html, /aria-valuemax="20"/);
  assert.match(html, /translateX\(-50%\)/);
});

test("typography composition preserves semantic elements and replaces a primitive's default role", () => {
  const description = renderToStaticMarkup(createElement(CardDescription, { className: "type-code break-all" }, "abc123"));
  assert.match(description, /type-code/);
  assert.match(description, /text-muted-foreground/);
  assert.doesNotMatch(description, /type-body-sm/);
  const item = renderToStaticMarkup(createElement(Typography, { variant: "code", asChild: true }, createElement("dd", { id: "commit" }, "abc123")));
  assert.match(item, /^<dd /);
  assert.match(item, /id="commit"/);
  assert.doesNotMatch(item, /<code|<p|<span/);
  const heading = renderToStaticMarkup(createElement(Typography, { variant: "card-title", as: "h2" }, "Scan details"));
  assert.match(heading, /^<h2 /);
});
