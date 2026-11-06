import assert from 'node:assert/strict';
import { test } from 'node:test';
import { database, alice, createRepository } from './bootstrap.mjs';

test('GitHub credentials and OAuth state are private; worker credential RPC is lease-scoped', async () => {
  const db = await database();
  try {
    for (const role of ['anon', 'authenticated', 'auditorx_scan_worker']) {
      for (const table of ['github_accounts', 'github_oauth_states', 'github_repositories']) {
        const { rows } = await db.query(`SELECT has_table_privilege($1, $2, 'SELECT') AS allowed`, [role, `auth.${table}`]);
        assert.equal(rows[0].allowed, false, `${role} can read ${table}`);
      }
    }
    for (const role of ['anon', 'authenticated', 'auditorx_api']) {
      const { rows } = await db.query(`SELECT has_function_privilege($1, 'public.github_scan_credential(uuid,uuid)', 'EXECUTE') AS allowed`, [role]);
      assert.equal(rows[0].allowed, false, `${role} can call worker credential function`);
    }
    const { rows } = await db.query(`SELECT has_function_privilege('auditorx_scan_worker','public.github_scan_credential(uuid,uuid)','EXECUTE') AS allowed`);
    assert.equal(rows[0].allowed, true);
    const result = await db.transaction(async tx => {
      await tx.exec('SET LOCAL ROLE auditorx_scan_worker');
      return tx.query(`SELECT * FROM public.github_scan_credential('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')`);
    });
    assert.equal(result.rows.length, 0);
    const repository = await createRepository(db, alice, 'github-lease');
    await db.query(`INSERT INTO auth.github_accounts(user_id,github_id,login,token_ciphertext) VALUES($1::uuid,42,'fixture',decode('abcdef','hex'))`, [alice]);
    await db.query(`INSERT INTO auth.github_repositories(repository_id,github_id,installation_id) VALUES($1::uuid,9001,10)`, [repository]);
    const lease = '55555555-5555-4555-8555-555555555555';
    const { rows: jobs } = await db.query(`INSERT INTO public.scan_jobs(repository_id,requested_by,branch,status,attempts,lease_token,lease_expires_at)
      VALUES($1::uuid,$2::uuid,'main','running',1,$3::uuid,now()+interval '3 minutes') RETURNING id`, [repository, alice, lease]);
    const credential = async (token = lease) => db.transaction(async tx => {
      await tx.exec('SET LOCAL ROLE auditorx_scan_worker');
      return tx.query(`SELECT * FROM public.github_scan_credential($1::uuid,$2::uuid)`, [jobs[0].id, token]);
    });
    assert.equal((await credential()).rows[0].github_id, 9001);
    assert.equal((await credential('66666666-6666-4666-8666-666666666666')).rows.length, 0);
    await db.query(`UPDATE public.scan_jobs SET lease_expires_at=now()-interval '1 second' WHERE id=$1::uuid`, [jobs[0].id]);
    assert.equal((await credential()).rows.length, 0);
    await db.query(`UPDATE public.scan_jobs SET lease_expires_at=now()+interval '3 minutes' WHERE id=$1::uuid`, [jobs[0].id]);
    await db.query(`DELETE FROM public.repository_members WHERE repository_id=$1::uuid`, [repository]);
    assert.equal((await credential()).rows.length, 0);
  } finally { await db.close(); }
});
