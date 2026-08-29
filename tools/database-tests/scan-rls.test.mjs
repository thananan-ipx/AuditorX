import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { database, asUser, createRepository, alice, bob, viewer } from './bootstrap.mjs';

let db, repo, scan;
before(async () => {
  db = await database();
  repo = await createRepository(db, alice, 'scan-policy');
  await db.query(`INSERT INTO public.repository_members(repository_id,repository_owner_id,user_id,access_level) VALUES ($1,$2,$3,'viewer')`, [repo, alice, viewer]);
  scan = (await asUser(db, alice, tx => tx.query(`INSERT INTO public.scan_jobs(repository_id,requested_by,branch) VALUES ($1,$2,'main') RETURNING id`, [repo, alice]))).rows[0].id;
});
after(async () => { await db?.close(); });

test('scan tables enforce RLS and deny anonymous access', async () => {
  const { rows } = await db.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('public.scan_jobs'::regclass,'public.scan_findings'::regclass)`);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => row.relrowsecurity && row.relforcerowsecurity));
  await assert.rejects(db.transaction(async tx => { await tx.exec('SET LOCAL ROLE anon'); await tx.query('SELECT id FROM public.scan_jobs'); }));
});
test('members can read status but not other users or lease tokens', async () => {
  assert.equal((await asUser(db, alice, tx => tx.query('SELECT id FROM public.scan_jobs'))).rows.length, 1);
  assert.equal((await asUser(db, viewer, tx => tx.query('SELECT id FROM public.scan_jobs'))).rows.length, 1);
  assert.equal((await asUser(db, bob, tx => tx.query('SELECT id FROM public.scan_jobs'))).rows.length, 0);
  await assert.rejects(asUser(db, alice, tx => tx.query('SELECT lease_token FROM public.scan_jobs')));
});
test('clients cannot forge scan status, actor, branch, rules or result rows', async () => {
  await assert.rejects(asUser(db, alice, tx => tx.query(`INSERT INTO public.scan_jobs(repository_id,requested_by,branch,status) VALUES ($1,$2,'main','completed')`, [repo, alice])));
  await assert.rejects(asUser(db, alice, tx => tx.query(`INSERT INTO public.scan_jobs(repository_id,requested_by,branch) VALUES ($1,$2,'main')`, [repo, bob])));
  await assert.rejects(asUser(db, alice, tx => tx.query(`INSERT INTO public.scan_jobs(repository_id,requested_by,branch) VALUES ($1,$2,'another')`, [repo, alice])));
  await assert.rejects(asUser(db, alice, tx => tx.query(`UPDATE public.scan_jobs SET status='completed' WHERE id=$1`, [scan])));
  await assert.rejects(asUser(db, alice, tx => tx.query(`UPDATE public.scan_jobs SET rules_version='other' WHERE id=$1`, [scan])));
  await assert.rejects(asUser(db, alice, tx => tx.query(`INSERT INTO public.scan_findings(scan_id) VALUES ($1)`, [scan])));
});
test('viewers and outsiders cannot enqueue or cancel scans', async () => {
  for (const actor of [viewer,bob]) {
    await assert.rejects(asUser(db, actor, tx => tx.query(`INSERT INTO public.scan_jobs(repository_id,requested_by,branch) VALUES ($1,$2,'main')`, [repo,actor])));
    const result = await asUser(db, actor, tx => tx.query(`UPDATE public.scan_jobs SET status='cancelled' WHERE id=$1 RETURNING id`, [scan]));
    assert.equal(result.rows.length, 0);
  }
});
test('one active scan per repository, cancellation frees slot', async () => {
  await assert.rejects(asUser(db, alice, tx => tx.query(`INSERT INTO public.scan_jobs(repository_id,requested_by,branch) VALUES ($1,$2,'main')`, [repo,alice])));
  await asUser(db, alice, tx => tx.query(`UPDATE public.scan_jobs SET status='cancelled',finished_at=now() WHERE id=$1`, [scan]));
  const result = await asUser(db, alice, tx => tx.query(`INSERT INTO public.scan_jobs(repository_id,requested_by,branch) VALUES ($1,$2,'main') RETURNING id`, [repo,alice]));
  assert.equal(result.rows.length, 1);
});
