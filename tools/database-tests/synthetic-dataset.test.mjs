import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { database, asUser, alice } from './bootstrap.mjs';

test('synthetic dataset persists complete labeled rows and original export checksums behind read-only RLS', async () => {
  const db = await database();
  try {
    const { rows } = await asUser(db, alice, tx => tx.query("SELECT payload FROM public.synthetic_training_datasets WHERE id='synthetic-priority-v1'"));
    const data = rows[0].payload;
    assert.equal(data.dataset_kind, 'synthetic');
    assert.equal(data.samples.length, 108);
    assert.equal(new Set(data.samples.map(s => s.sample_id)).size, 108);
    assert.deepEqual(Object.fromEntries(['High', 'Medium', 'Low'].map(c => [c, data.samples.filter(s => s.priority_label === c).length])), { High: 29, Medium: 48, Low: 31 });
    assert.ok(data.samples.every(s => s.dataset_kind === 'synthetic' && s.human_reviewed === 'false' && s.label_source === 'simulated_rubric_v1'));
    const groups = ['train', 'validation', 'test'].map(split => new Set(data.samples.filter(s => s.split === split).map(s => s.repository_group)));
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) assert.ok([...groups[a]].every(g => !groups[b].has(g)));
    for (const [file, hash] of Object.entries(data.manifest.sha256)) assert.equal(createHash('sha256').update(data.files[file], 'utf8').digest('hex'), hash);
    await assert.rejects(db.transaction(async tx => { await tx.exec('SET LOCAL ROLE anon'); await tx.query('SELECT * FROM public.synthetic_training_datasets'); }));
    await assert.rejects(asUser(db, alice, tx => tx.query("DELETE FROM public.synthetic_training_datasets")));
    await assert.rejects(asUser(db, alice, tx => tx.query("UPDATE public.synthetic_training_datasets SET payload='{}'::jsonb")));
    await assert.rejects(asUser(db, alice, tx => tx.query("INSERT INTO public.synthetic_training_datasets(id,payload) VALUES('fake','{}')")));
  } finally { await db.close(); }
});
