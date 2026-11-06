import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { database, asUser, createRepository, alice, bob, viewer } from './bootstrap.mjs';
let db, repo, scan;
const context={repository_criticality:'high',exposure:'public',impact:'high'};
before(async()=>{
 db=await database();repo=await createRepository(db,alice,'automatic-priority');
 await db.query(`INSERT INTO public.repository_members(repository_id,repository_owner_id,user_id,access_level) VALUES($1,$2,$3,'viewer')`,[repo,alice,viewer]);
 scan=(await db.query(`INSERT INTO public.scan_jobs(repository_id,requested_by,branch,prediction_context) VALUES($1,$2,'main',$3) RETURNING id`,[repo,alice,context])).rows[0].id;
});
after(async()=>{await db?.close();});
test('completion queues a single durable prediction with the scan context, without labels',async()=>{
 assert.equal((await db.query('SELECT * FROM public.priority_prediction_runs')).rows.length,0);
 await db.query(`UPDATE public.scan_jobs SET status='completed',commit_sha=$2,scanner_version='test',finished_at=now() WHERE id=$1`,[scan,'a'.repeat(40)]);
 let rows=(await db.query('SELECT * FROM public.priority_prediction_runs')).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].status,'queued');assert.equal(rows[0].origin,'automatic');assert.deepEqual(rows[0].context,context);
 await db.query(`UPDATE public.scan_jobs SET status='completed' WHERE id=$1`,[scan]);
 assert.equal((await db.query('SELECT * FROM public.priority_prediction_runs')).rows.length,1);
 assert.equal((await db.query('SELECT * FROM public.priority_labels')).rows.length,0);
});
test('prediction history is private; members can read but cannot forge a model result',async()=>{
 assert.equal((await asUser(db,viewer,tx=>tx.query('SELECT id FROM public.priority_prediction_runs'))).rows.length,1);
 assert.equal((await asUser(db,bob,tx=>tx.query('SELECT id FROM public.priority_prediction_runs'))).rows.length,0);
 await assert.rejects(asUser(db,alice,tx=>tx.query('SELECT lease_token FROM public.priority_prediction_runs')));
 for(const actor of [alice,viewer,bob]){
  await assert.rejects(asUser(db,actor,tx=>tx.query(`UPDATE public.priority_prediction_runs SET result='{}',status='completed',finished_at=now()`)));
  await assert.rejects(asUser(db,actor,tx=>tx.query('DELETE FROM public.priority_prediction_runs')));
 }
 await assert.rejects(asUser(db,alice,tx=>tx.query(`INSERT INTO public.priority_prediction_runs(scan_id,repository_id,requested_by,context,status,result) VALUES($1,$2,$3,$4,'completed','{}')`,[scan,repo,alice,context])));
});
test('only editors can retry; context and requester cannot be forged',async()=>{
 await db.query(`UPDATE public.priority_prediction_runs SET status='completed',result='{"predictions":[]}',finished_at=now()`);
 const insert=`INSERT INTO public.priority_prediction_runs(scan_id,repository_id,requested_by,context) VALUES($1,$2,$3,$4)`;
 for(const actor of [viewer,bob]) await assert.rejects(asUser(db,actor,tx=>tx.query(insert,[scan,repo,actor,context])));
 await assert.rejects(asUser(db,alice,tx=>tx.query(insert,[scan,repo,bob,context])));
 await assert.rejects(asUser(db,alice,tx=>tx.query(insert,[scan,repo,alice,{...context,exposure:'test_only'}])));
 await asUser(db,alice,tx=>tx.query(insert,[scan,repo,alice,context]));
 assert.equal((await db.query('SELECT * FROM public.priority_prediction_runs')).rows.length,2);
 await assert.rejects(asUser(db,alice,tx=>tx.query(insert,[scan,repo,alice,context])));
});
test('scan context rejects unknown keys and invalid enum values',async()=>{
 await assert.rejects(db.query(`UPDATE public.scan_jobs SET prediction_context=$2 WHERE id=$1`,[scan,{...context,priority_label:'High'}]));
 await assert.rejects(db.query(`UPDATE public.scan_jobs SET prediction_context=$2 WHERE id=$1`,[scan,{...context,impact:'critical'}]));
});
