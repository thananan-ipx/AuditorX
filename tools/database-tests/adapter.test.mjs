import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { database } from './bootstrap.mjs';

test('Go adapter persists, scopes users, resets sessions and rolls back atomically', { timeout: 90000 }, async () => {
  const db = await database();
  const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 4 });
  try {
    await server.start();
    console.log('Ephemeral PostgreSQL socket ready; running Go integration test.');
    const url = `postgresql://postgres@${server.getServerConn()}/postgres?sslmode=disable`;
    const result = await new Promise((resolve, reject) => {
      const child = spawn('go', ['test', '-p', '1', '-count=1', '-timeout=60s', '-run', '^TestPostgresIntegration$', '-v', './internal/modules/project/repository', './internal/modules/scan', './internal/modules/user/repository'], {
        cwd: fileURLToPath(new URL('../../backend/', import.meta.url)),
        env: { ...process.env, AUDITORX_TEST_DATABASE_URL: url },
        windowsHide: true,
        timeout: 75000,
      });
      let output = '';
      child.stdout.on('data', data => { output += data; process.stdout.write(data); });
      child.stderr.on('data', data => { output += data; process.stderr.write(data); });
      child.on('error', reject);
      child.on('close', code => resolve({ code, output }));
    });
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /--- PASS: TestPostgresIntegration/);
  } finally {
    console.log('Closing ephemeral database.');
    await server.stop();
    await db.close();
  }
});
