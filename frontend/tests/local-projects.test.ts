import assert from "node:assert/strict";
import { test } from "node:test";
import { filterLocalProjects, type LocalProject } from "../features/repositories/local-projects";
import { dashboardHref, repositoryService } from "../features/repositories/service/repository-service";

const project: LocalProject = {name:"inventory-card",source_name:"apps/inventory-card",source_kind:"local",
  repository_id:"repo-1",repository_name:"workspace",access_level:"owner",scan_id:"old-scan",status:"completed",
  created_at:"2026-11-06T06:01:00Z",scan_count:2,high:1,medium:2,low:3};

test("local project discovery reads a workspace-wide page with cookies and cancellation", async t => {
  const signal = new AbortController().signal;
  t.mock.method(globalThis,"fetch",async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(new URL(String(input)).pathname + new URL(String(input)).search,"/api/v1/local-projects?page=2&page_size=100");
    assert.equal(init?.credentials,"include");
    assert.equal(init?.cache,"no-store");
    assert.equal(init?.signal,signal);
    assert.equal(init?.method,undefined);
    return Response.json({data:[project],meta:{has_next:true}});
  });
  assert.deepEqual(await repositoryService.localProjects(2,signal),{items:[project],hasNext:true});
});

test("local search preserves distinct source paths and combines with source filter", () => {
  const items = [project,{...project,scan_id:"other",source_name:"other/inventory-card",source_kind:"upload" as const}];
  assert.equal(filterLocalProjects(items,"inventory-card","all").length,2);
  assert.deepEqual(filterLocalProjects(items," APPS/INVENTORY ","local"),[project]);
  assert.equal(filterLocalProjects(items,"workspace","upload").length,1);
  assert.equal(filterLocalProjects(items,"missing","all").length,0);
});

test("local project link pins its own scan instead of opening a different project's latest scan", () => {
  assert.equal(dashboardHref("repo/1","scan?2"),"/dashboard?repository=repo%2F1&scan=scan%3F2");
  assert.equal(dashboardHref("repo/1"),"/dashboard?repository=repo%2F1");
});
