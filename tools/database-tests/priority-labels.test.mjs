import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { database, asUser, createRepository, alice, bob, viewer } from './bootstrap.mjs';
let db,repo,scan;
const fingerprint='f'.repeat(64);
const insert=`INSERT INTO public.priority_labels(scan_id,fingerprint,repository_id,repository_group,review_status,priority_label,repository_criticality,exposure,impact,label_reason,reviewer)
 VALUES ($1,$2,$3,'fixture','accepted','High','normal','public','high','Reviewed source',$4) RETURNING id`;
before(async()=>{
 db=await database();repo=await createRepository(db,alice,'label-policy');
 await db.query(`INSERT INTO public.repository_members(repository_id,repository_owner_id,user_id,access_level) VALUES($1,$2,$3,'viewer')`,[repo,alice,viewer]);
 scan=(await db.query(`INSERT INTO public.scan_jobs(repository_id,requested_by,branch,status,commit_sha,scanner_version,finished_at) VALUES($1,$2,'main','completed',$3,'1.175.0',now()) RETURNING id`,[repo,alice,'a'.repeat(40)])).rows[0].id;
 await db.query(`INSERT INTO public.scan_findings(scan_id,repository_id,fingerprint,rule_id,severity,file_path,start_line,end_line,message) VALUES($1,$2,$3,'auditorx.javascript.security.dynamic-eval','High','app.ts',1,1,'Avoid eval')`,[scan,repo,fingerprint]);
});
after(async()=>{await db?.close();});
test('label table forces RLS; viewers and outsiders cannot write or forge reviewer',async()=>{
 const {rows}=await db.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='public.priority_labels'::regclass`);
 assert.ok(rows[0].relrowsecurity&&rows[0].relforcerowsecurity);
 for(const actor of [viewer,bob])await assert.rejects(asUser(db,actor,tx=>tx.query(insert,[scan,fingerprint,repo,actor])));
 await assert.rejects(asUser(db,alice,tx=>tx.query(insert,[scan,fingerprint,repo,bob])));
 await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE anon');await tx.query('SELECT * FROM public.priority_labels');}));
});
test('saved labels are append-only; members read while outsiders see none',async()=>{
 await asUser(db,alice,tx=>tx.query(insert,[scan,fingerprint,repo,alice]));
 await asUser(db,alice,tx=>tx.query(insert,[scan,fingerprint,repo,alice]));
 assert.equal((await asUser(db,viewer,tx=>tx.query('SELECT id FROM public.priority_labels'))).rows.length,2);
 assert.equal((await asUser(db,bob,tx=>tx.query('SELECT id FROM public.priority_labels'))).rows.length,0);
 await assert.rejects(asUser(db,alice,tx=>tx.query(`UPDATE public.priority_labels SET priority_label='Low'`)));
 await assert.rejects(asUser(db,alice,tx=>tx.query('DELETE FROM public.priority_labels')));
 await assert.rejects(asUser(db,alice,tx=>tx.query(`INSERT INTO public.priority_labels(id) VALUES(999)`)));
});
test('labels require a real completed finding and valid class/status pair',async()=>{
 await assert.rejects(asUser(db,alice,tx=>tx.query(insert,[scan,'0'.repeat(64),repo,alice])));
 await assert.rejects(asUser(db,alice,tx=>tx.query(insert.replace("'accepted'","'excluded'"),[scan,fingerprint,repo,alice])));
 const simulated=insert.replace("'accepted'","'simulated'").replace("'public'","'test_only'");
 await asUser(db,alice,tx=>tx.query(simulated,[scan,fingerprint,repo,alice]));
 await assert.rejects(asUser(db,alice,tx=>tx.query(insert.replace("'accepted'","'simulated'"),[scan,fingerprint,repo,alice])));
 await assert.rejects(asUser(db,alice,tx=>tx.query(simulated.replace("'High'","NULL"),[scan,fingerprint,repo,alice])));
 assert.equal((await asUser(db,alice,tx=>tx.query("SELECT id FROM public.priority_labels WHERE review_status='simulated'"))).rows.length,1);
 assert.equal((await asUser(db,alice,tx=>tx.query("SELECT id FROM public.priority_labels WHERE review_status='accepted'"))).rows.length,2);
 await db.query(`UPDATE public.scan_jobs SET status='failed' WHERE id=$1`,[scan]);
 await assert.rejects(asUser(db,alice,tx=>tx.query(insert,[scan,fingerprint,repo,alice])));
});
