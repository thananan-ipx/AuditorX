import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// These are frozen baselines. New standalone changes belong in new Goose files.
const baselines = [
  ['00002_repository_membership.sql', '20260828073925_repository_membership.sql'],
  ['00003_durable_scan_jobs.sql', '20260828102015_durable_scan_jobs.sql'],
  ['00004_baseline_v2_ruleset.sql', '20260912144015_add_baseline_v2_ruleset.sql'],
  ['00005_uploaded_scan_sources.sql', '20260912152408_add_uploaded_scan_sources.sql'],
];

test('Goose baselines preserve the schema and RLS covered by existing database tests', async () => {
  for (const [gooseFile, originalFile] of baselines) {
    const goose = await readFile(new URL(`../../backend/migrations/${gooseFile}`, import.meta.url), 'utf8');
    const original = await readFile(new URL(`../../supabase/migrations/${originalFile}`, import.meta.url), 'utf8');
    const up = goose.split('-- +goose Up')[1].split('-- +goose Down')[0].trim();
    assert.equal(up.replaceAll('\r\n', '\n'), original.trim().replaceAll('\r\n', '\n'), gooseFile);
  }
});
