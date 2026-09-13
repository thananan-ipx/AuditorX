import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export const alice = '11111111-1111-4111-8111-111111111111';
export const bob = '22222222-2222-4222-8222-222222222222';
export const viewer = '33333333-3333-4333-8333-333333333333';

// Auth stand-ins for a disposable test engine only. Never executed on a supplied URL.
export async function database() {
  const db = await PGlite.create();
  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN NOBYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      GRANT USAGE ON SCHEMA auth, public TO authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      INSERT INTO auth.users VALUES ('${alice}'), ('${bob}'), ('${viewer}');
      CREATE TABLE public.auditorx_test_marker (id text PRIMARY KEY);
      INSERT INTO public.auditorx_test_marker VALUES ('ephemeral-test-only');
    `);
    const migration = await readFile(new URL('../../supabase/migrations/20260828073925_repository_membership.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    const scanMigration = await readFile(new URL('../../supabase/migrations/20260828102015_durable_scan_jobs.sql', import.meta.url), 'utf8');
    await db.exec(scanMigration);
    const rulesMigration = await readFile(new URL('../../supabase/migrations/20260912144015_add_baseline_v2_ruleset.sql', import.meta.url), 'utf8');
    await db.exec(rulesMigration);
    const uploadMigration = await readFile(new URL('../../supabase/migrations/20260912152408_add_uploaded_scan_sources.sql', import.meta.url), 'utf8');
    await db.exec(uploadMigration);
    return db;
  } catch (err) {
    await db.close();
    throw err;
  }
}

export async function asUser(db, userID, callback) {
  return db.transaction(async tx => {
    await tx.exec('SET LOCAL ROLE authenticated');
    await tx.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userID]);
    return callback(tx);
  });
}

export async function createRepository(db, userID, name = 'repo') {
  return asUser(db, userID, async tx => {
    const { rows } = await tx.query(`INSERT INTO public.repositories
      (name, owner_name, repository_url, created_by) VALUES ($1, 'org', $2, $3::uuid) RETURNING id`,
      [name, `https://github.com/org/${name}`, userID]);
    await tx.query(`INSERT INTO public.repository_members (repository_id,repository_owner_id,user_id,access_level) VALUES ($1::uuid, $2::uuid, $2::uuid, 'owner')`, [rows[0].id, userID]);
    return rows[0].id;
  });
}
