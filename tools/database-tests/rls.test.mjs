import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { database, asUser, createRepository, alice, bob, viewer } from './bootstrap.mjs';

let db, repoID;
before(async () => { db = await database(); repoID = await createRepository(db, alice); });
after(async () => { if (db) await db.close(); });

test('migration enables and forces RLS on both tables', async () => {
  const { rows } = await db.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class
    WHERE oid IN ('public.repositories'::regclass, 'public.repository_members'::regclass)`);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => row.relrowsecurity && row.relforcerowsecurity));
});

test('creator can read repository and membership', async () => {
  await asUser(db, alice, async tx => {
    assert.equal((await tx.query('SELECT id FROM public.repositories')).rows[0].id, repoID);
    assert.equal((await tx.query('SELECT user_id FROM public.repository_members')).rows[0].user_id, alice);
  });
});

test('another user cannot read repositories or membership rows', async () => {
  await asUser(db, bob, async tx => {
    assert.deepEqual((await tx.query('SELECT * FROM public.repositories')).rows, []);
    assert.deepEqual((await tx.query('SELECT * FROM public.repository_members')).rows, []);
  });
});

test('another user cannot self-enroll into a repository', async () => {
  await assert.rejects(asUser(db, bob, tx => tx.query(
    `INSERT INTO public.repository_members (repository_id,repository_owner_id,user_id,access_level) VALUES ($1,$2,$2,'owner')`, [repoID, bob]
  )), { code: '23503' });
});

test('cannot forge created_by or enroll another identity', async () => {
  await assert.rejects(asUser(db, bob, tx => tx.query(`INSERT INTO public.repositories
    (name,owner_name,repository_url,created_by) VALUES ('forged','org','https://github.com/org/forged',$1)`, [alice])), { code: '42501' });
  await assert.rejects(asUser(db, alice, tx => tx.query(`INSERT INTO public.repository_members
    (repository_id,repository_owner_id,user_id,access_level) VALUES ($1,$3,$2,'owner')`, [repoID,bob,alice])), { code: '42501' });
});

test('anonymous reads and writes are denied', async () => {
  for (const query of ['SELECT * FROM public.repositories', 'SELECT * FROM public.repository_members',
    `INSERT INTO public.repository_members (repository_id,repository_owner_id,user_id,access_level) VALUES ('${repoID}','${bob}','${bob}','owner')`]) {
    await assert.rejects(db.transaction(async tx => { await tx.exec('SET LOCAL ROLE anon'); await tx.exec(query); }), { code: '42501' });
  }
});

test('updates and deletes are not granted to authenticated clients', async () => {
  for (const query of ["UPDATE public.repositories SET status='Archived'", 'DELETE FROM public.repositories',
    "UPDATE public.repository_members SET access_level='owner'", 'DELETE FROM public.repository_members']) {
    await assert.rejects(asUser(db, alice, tx => tx.exec(query)), { code: '42501' });
  }
});

test('membership enables read access without exposing other members', async () => {
  await db.query(`INSERT INTO public.repository_members (repository_id,repository_owner_id,user_id,access_level) VALUES ($1,$3,$2,'viewer')`, [repoID,viewer,alice]);
  await asUser(db, viewer, async tx => {
    assert.equal((await tx.query('SELECT id FROM public.repositories')).rows[0].id, repoID);
    const members = (await tx.query('SELECT user_id FROM public.repository_members')).rows;
    assert.deepEqual(members, [{ user_id: viewer }]);
  });
  await db.query('DELETE FROM public.repository_members WHERE user_id=$1', [viewer]);
  await asUser(db, viewer, async tx => assert.deepEqual((await tx.query('SELECT * FROM public.repositories')).rows, []));
});

test('duplicate registration is rejected for one creator', async () => {
  await assert.rejects(createRepository(db, alice), { code: '23505' });
});

test('failed membership insertion rolls repository creation back', async () => {
  await assert.rejects(asUser(db, alice, async tx => {
    const { rows } = await tx.query(`INSERT INTO public.repositories (name,owner_name,repository_url,created_by)
      VALUES ('rollback','org','https://github.com/org/rollback',$1) RETURNING id`, [alice]);
    await tx.query(`INSERT INTO public.repository_members (repository_id,repository_owner_id,user_id,access_level) VALUES ($1,$3,$2,'owner')`, [rows[0].id,bob,alice]);
  }), { code: '42501' });
  assert.equal((await db.query("SELECT count(*)::int AS n FROM public.repositories WHERE name='rollback'")).rows[0].n, 0);
});

test('transaction identity and role do not survive commit or rollback', async () => {
  await asUser(db, alice, tx => tx.query('SELECT 1'));
  const { rows } = await db.query("SELECT current_user, auth.uid() AS user_id");
  assert.notEqual(rows[0].current_user, 'authenticated');
  assert.equal(rows[0].user_id, null);
});
