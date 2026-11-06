import assert from "node:assert/strict";
import { test } from "node:test";
import { prioritizeFindings } from "../features/scans/prioritized-findings";
import type { Finding, PriorityLabel } from "../features/scans/types";
import type { PredictionResult } from "../features/scans/service/prediction-service";
const findings = ["a", "b", "c"].map((id, index) => ({fingerprint:id,file:`${id}.ts`,line:index+1,end_line:index+1,severity:"High",message:"Fixture",rule_id:"fixture"})) as Finding[];
const model = {predictions:[{fingerprint:"a",priority:"Low"},{fingerprint:"b",priority:"High"},{fingerprint:"c",priority:"Medium"}]} as PredictionResult;
test("fix queue sorts predicted priorities without replacing scanner severity",()=>{
 const queue=prioritizeFindings(findings,model,[]);
 assert.deepEqual(queue.map(row=>row.finding.fingerprint),["b","c","a"]);
 assert.equal(queue[2].finding.severity,"High");
 assert.equal(queue[2].priority,"Low");
});
test("only human-confirmed labels override model priorities; exclusions remain explicit",()=>{
 const labels=[{fingerprint:"a",review_status:"accepted",priority_label:"High"},{fingerprint:"b",review_status:"simulated",priority_label:"Low"},{fingerprint:"c",review_status:"excluded",priority_label:""}] as PriorityLabel[];
 const queue=prioritizeFindings(findings,model,labels);
 assert.equal(queue.find(row=>row.finding.fingerprint==="a")?.source,"human");
 assert.equal(queue.find(row=>row.finding.fingerprint==="b")?.priority,"High");
 assert.equal(queue.find(row=>row.finding.fingerprint==="c")?.excluded,true);
 assert.equal(labels[0].priority_label,"High");
});
test("unavailable model leaves priority unknown instead of disguising severity as a prediction",()=>{
 const queue=prioritizeFindings(findings,null,[]);
 assert.ok(queue.every(row=>row.priority===null && row.source==="pending"));
});
