"""Create paired Next.js scanner fixtures with explicitly fictional context."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "examples/nextjs-scan-lab"


def main():
    if TARGET.exists():
        raise SystemExit("Lab already exists; refusing to overwrite it.")
    files = {
        "package.json": json.dumps({"name":"auditorx-nextjs-scan-lab","version":"1.0.0","private":True,"scripts":{"dev":"next dev --hostname 127.0.0.1 --port 3012","build":"next build","start":"next start --hostname 127.0.0.1 --port 3012","typecheck":"next typegen && tsc --noEmit"},"dependencies":{"next":"16.4.5","react":"19.2.8","react-dom":"19.2.8"},"devDependencies":{"typescript":"6.0.3","@types/node":"26.2.0","@types/react":"19.2.18","@types/react-dom":"19.2.4"}},indent=2),
        "tsconfig.json": json.dumps({"compilerOptions":{"target":"ES2020","lib":["dom","dom.iterable","esnext"],"strict":True,"noEmit":True,"esModuleInterop":True,"module":"esnext","moduleResolution":"bundler","resolveJsonModule":True,"isolatedModules":True,"jsx":"react-jsx","incremental":True,"plugins":[{"name":"next"}],"paths":{"@/*":["./*"]}},"include":["next-env.d.ts","**/*.ts","**/*.tsx",".next/types/**/*.ts",".next/dev/types/**/*.ts"],"exclude":["node_modules"]},indent=2),
        ".gitignore": "node_modules/\n.next/\n*.tsbuildinfo\n.env.local\nnext-env.d.ts\n",
        ".env.example": "# Fictional placeholders only; no external account is used.\nNEXT_PUBLIC_LAB_PAYMENT_SECRET=FAKE-LAB-SECRET-NOT-A-CREDENTIAL\nLAB_DEMO_PASSWORD=FAKE-LOCAL-PASSWORD\n",
        "next.config.ts": 'import type { NextConfig } from "next";\nconst config: NextConfig = {};\nexport default config;\n',
        "app/layout.tsx": 'import "./globals.css";\nexport const metadata = { title: "AuditorX Next.js Scan Lab" };\nexport default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }\n',
        "app/globals.css": 'body{font:16px/1.6 system-ui,sans-serif;max-width:1000px;margin:40px auto;padding:0 24px;background:#f7f8f5;color:#18372d}a{color:#245f4c}section,article{background:white;border:1px solid #d7dfd9;border-radius:12px;padding:20px;margin:16px 0}code{background:#eef2ed;padding:2px 5px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #ddd}input,button{padding:8px;margin:6px}small{color:#52695e}',
        "lib/demo-data.ts": '''// Fictional, in-memory data. This is not a production database or auth system.
export const demoOrders = new Map([
  ["order-1", { owner: "alice", amount: 100, status: "pending" }],
  ["order-2", { owner: "bob", amount: 200, status: "pending" }],
]);
export function getDemoActor() { return "alice"; }
// A mock SQL sink for static pattern matching; it does not execute SQL.
export const demoDB = { async query(sql: string, params: unknown[] = []) { return { sql, params, executed: false }; } };
export function demoProfile(userId: string) { return { userId, note: "Fictional private profile for " + userId }; }
''',
        "app/unsafe/html/page.tsx": '''// LAB: intentionally renders untrusted HTML. Test data only.
export default async function Page({ searchParams }: { searchParams: Promise<{ html?: string }> }) {
  const query = await searchParams;
  return <main><h1>Unsafe HTML example</h1><div dangerouslySetInnerHTML={{ __html: query.html ?? "Demo" }} /></main>;
}
''',
        "app/fixed/html/page.tsx": '''// Fixed: React renders the request value as escaped text.
export default async function Page({ searchParams }: { searchParams: Promise<{ html?: string }> }) {
  const query = await searchParams;
  return <main><h1>Escaped text example</h1><p>{query.html ?? "Demo"}</p></main>;
}
''',
        "app/api/unsafe/redirect/route.ts": '''import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  return NextResponse.redirect(new URL(next, request.url));
}
''',
        "app/api/fixed/redirect/route.ts": '''import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  // A constant destination allowlist also rejects slash-backslash normalization.
  const destination = next === "/fixed/html" ? "/fixed/html" : "/";
  return NextResponse.redirect(new URL(destination, request.url));
}
''',
        "app/unsafe/public-secret/page.tsx": '''"use client";
// This value is deliberately fake. No external credential exists.
export default function Page() {
  const browserValue = process.env.NEXT_PUBLIC_LAB_PAYMENT_SECRET ?? "FAKE-LAB-SECRET";
  return <main><h1>Public secret-name fixture</h1><pre>{browserValue}</pre></main>;
}
''',
        "app/fixed/public-secret/page.tsx": '''// Server-only value is used here and never included in the response.
export default function Page() {
  const configured = Boolean(process.env.LAB_DEMO_PASSWORD);
  return <main><h1>Server-only configuration</h1><p>{configured ? "Configured" : "Not configured"}</p></main>;
}
''',
        "app/api/unsafe/logging/route.ts": '''import { NextRequest } from "next/server";
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  console.log("LAB credential:", password);
  return Response.json({ ok: true, labOnly: true });
}
''',
        "app/api/fixed/logging/route.ts": '''export async function POST() {
  console.info("LAB sign-in attempt; credentials omitted");
  return Response.json({ ok: true, labOnly: true });
}
''',
        "lib/unsafe/credentials.ts": '''// Fake credential only, deliberately embedded for scanner coverage.
const password = "FAKE-LAB-ONLY-PASSWORD";
export function matchesDemoPassword(candidate: string) { return candidate === password; }
''',
        "lib/fixed/credentials.ts": '''export function matchesDemoPassword(candidate: string) {
  const expected = process.env.LAB_DEMO_PASSWORD;
  return Boolean(expected) && candidate === expected;
}
''',
        "app/api/unsafe/sql/route.ts": '''import { NextRequest } from "next/server";
import { demoDB } from "@/lib/demo-data";
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "alice";
  const preview = await demoDB.query(`SELECT * FROM demo_users WHERE name = '${name}'`);
  return Response.json(preview);
}
''',
        "app/api/fixed/sql/route.ts": '''import { NextRequest } from "next/server";
import { demoDB } from "@/lib/demo-data";
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "alice";
  const preview = await demoDB.query("SELECT * FROM demo_users WHERE name = $1", [name]);
  return Response.json(preview);
}
''',
        "app/api/unsafe/eval/route.ts": '''import { NextRequest } from "next/server";
export async function GET(request: NextRequest) {
  const expression = request.nextUrl.searchParams.get("expression") ?? "2 + 2";
  return Response.json({ result: String(eval(expression)) });
}
''',
        "app/api/fixed/eval/route.ts": '''import { NextRequest } from "next/server";
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("number") ?? "0";
  if (!/^-?\\d+(?:\\.\\d+)?$/.test(raw)) return Response.json({ error: "Numeric input required" }, { status: 400 });
  const value = Number(raw);
  if (!Number.isFinite(value)) return Response.json({ error: "Finite input required" }, { status: 400 });
  return Response.json({ result: value * 2 });
}
''',
        "app/api/unsafe/shell/route.ts": '''import { NextRequest } from "next/server";
import * as child_process from "node:child_process";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text") ?? "lab";
  // Never use this pattern with real request data in a deployed service.
  const output = await new Promise<string>((resolve, reject) => child_process.exec("echo " + text, (error, stdout) => error ? reject(error) : resolve(stdout)));
  return Response.json({ output });
}
''',
        "app/api/fixed/shell/route.ts": '''import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text") ?? "lab";
  // Executable and program are fixed; input is a separate argument, not shell code.
  const output = await new Promise<string>((resolve, reject) => execFile(process.execPath, ["-e", "process.stdout.write(process.argv[1] ?? '')", text], (error, stdout) => error ? reject(error) : resolve(stdout)));
  return Response.json({ output });
}
''',
        "app/unsafe/ownership/actions.ts": '''"use server";
import { demoOrders } from "@/lib/demo-data";
import { revalidatePath } from "next/cache";
export async function updateOrder(form: FormData) {
  const id = String(form.get("orderId"));
  const order = demoOrders.get(id);
  if (order) demoOrders.set(id, { ...order, amount: Number(form.get("amount")) });
  revalidatePath("/unsafe/ownership");
}
''',
        "app/fixed/ownership/actions.ts": '''"use server";
import { demoOrders, getDemoActor } from "@/lib/demo-data";
import { revalidatePath } from "next/cache";
export async function updateOrder(form: FormData) {
  const id = String(form.get("orderId"));
  const amount = Number(form.get("amount"));
  const order = demoOrders.get(id);
  if (!order || order.owner !== getDemoActor()) throw new Error("Not your demo order");
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid amount");
  demoOrders.set(id, { ...order, amount });
  revalidatePath("/fixed/ownership");
}
''',
        "app/unsafe/status/actions.ts": '''"use server";
import { demoOrders, getDemoActor } from "@/lib/demo-data";
export async function updateStatus(form: FormData) {
  const id = String(form.get("orderId"));
  const order = demoOrders.get(id);
  if (!order || order.owner !== getDemoActor()) throw new Error("Not your demo order");
  demoOrders.set(id, { ...order, status: String(form.get("status")) });
}
''',
        "app/fixed/status/actions.ts": '''"use server";
import { demoOrders, getDemoActor } from "@/lib/demo-data";
export async function updateStatus(form: FormData) {
  const id = String(form.get("orderId"));
  const status = String(form.get("status"));
  const order = demoOrders.get(id);
  if (!order || order.owner !== getDemoActor()) throw new Error("Not your demo order");
  if (!["pending", "cancelled"].includes(status)) throw new Error("Invalid status");
  if (order.status !== "pending") throw new Error("Invalid transition");
  demoOrders.set(id, { ...order, status });
}
''',
        "lib/unsafe/cache.ts": '''import { unstable_cache } from "next/cache";
import { demoProfile } from "@/lib/demo-data";
export async function loadDemoProfile(userId: string) {
  const load = unstable_cache(async () => demoProfile(userId), ["lab-private-profile"]);
  return load();
}
''',
        "lib/fixed/cache.ts": '''import { unstable_cache } from "next/cache";
import { demoProfile } from "@/lib/demo-data";
const load = unstable_cache(async (userId: string) => demoProfile(userId), ["lab-profile-by-user"]);
export async function loadDemoProfile(userId: string) { return load(userId); }
''',
        "fixtures/unsafe/client-boundary.tsx": '''"use client";
// Scan-only fixture, intentionally not imported into the runnable app.
import fs from "node:fs";
export default function ClientBoundary() { return <p>{String(fs.existsSync("lab-only.txt"))}</p>; }
''',
        "fixtures/fixed/client-boundary.tsx": '''"use client";
export default function ClientBoundary({ exists }: { exists: boolean }) { return <p>{String(exists)}</p>; }
''',
    }
    cases = []
    def case(name, rule, unsafe, fixed, priority, notes):
        cases.append({"family":name,"group":"nextjs-lab-"+name,"expected_rule":rule,"unsafe_file":unsafe,"fixed_file":fixed,"proposed_priority":priority,"label_source":"authored_lab_scenario_not_human_ground_truth","actual_exposure":"test_only","notes":notes})
    prefix = "auditorx."
    case("html",prefix+"nextjs.security.request-html","app/unsafe/html/page.tsx","app/fixed/html/page.tsx","High","Hypothetical public HTML preview; fixed variant renders escaped text.")
    case("redirect",prefix+"nextjs.security.request-redirect","app/api/unsafe/redirect/route.ts","app/api/fixed/redirect/route.ts","Medium","User-controlled destination versus a constant local allowlist.")
    case("public-secret",prefix+"nextjs.security.public-secret","app/unsafe/public-secret/page.tsx","app/fixed/public-secret/page.tsx","High","Secret-like public name; the actual value is fake and has no authority.")
    case("logging",prefix+"javascript.coding-standard.sensitive-logging","app/api/unsafe/logging/route.ts","app/api/fixed/logging/route.ts","Medium","Hypothetical real credential logging; use fake form values only.")
    case("credentials",prefix+"javascript.security.hardcoded-secret","lib/unsafe/credentials.ts","lib/fixed/credentials.ts","Low","Fake hardcoded password fixture, not a leaked real credential.")
    case("sql",prefix+"javascript.security.sql-template-interpolation","app/api/unsafe/sql/route.ts","app/api/fixed/sql/route.ts","High","Mock SQL sink only: proves scanner coverage, not a working SQL injection.")
    case("eval",prefix+"javascript.security.dynamic-eval","app/api/unsafe/eval/route.ts","app/api/fixed/eval/route.ts","High","Request text executed as code versus a constrained numeric parser.")
    case("shell",prefix+"javascript.security.shell-command-execution","app/api/unsafe/shell/route.ts","app/api/fixed/shell/route.ts","High","Shell concatenation versus fixed program with separate input argument.")
    case("ownership",prefix+"nextjs.review.server-action-access","app/unsafe/ownership/actions.ts","app/fixed/ownership/actions.ts","High","Toy identity is fixed to Alice; compare missing versus explicit ownership check. Advisory expected on BOTH files.")
    case("status",prefix+"nextjs.review.server-action-access","app/unsafe/status/actions.ts","app/fixed/status/actions.ts","Low","In-memory workflow with and without status/transition validation. Advisory expected on BOTH files.")
    case("cache",prefix+"nextjs.review.shared-cache","lib/unsafe/cache.ts","lib/fixed/cache.ts","Medium","User ID captured in closure versus supplied as a cache argument. Advisory expected on BOTH files.")
    case("client-boundary",prefix+"nextjs.security.client-server-import","fixtures/unsafe/client-boundary.tsx","fixtures/fixed/client-boundary.tsx","Low","Scan-only example of client importing fs; outside the app import graph so the app can build.")
    for variant in ["unsafe","fixed"]:
        for name, action, field in [("ownership","updateOrder","amount"),("status","updateStatus","status")]:
            default = "100" if field == "amount" else "pending"
            files[f"app/{variant}/{name}/page.tsx"] = f'''import {{ {action} }} from "./actions";
export default function Page() {{ return <main><h1>{variant}: {name}</h1><p>Fictional orders; demo actor is Alice.</p><form action={{{action}}}><input name="orderId" defaultValue="order-1" /><input name="{field}" defaultValue="{default}" /><button>Update demo record</button></form></main>; }}
'''
        files[f"app/{variant}/cache/page.tsx"] = f'''import {{ loadDemoProfile }} from "@/lib/{variant}/cache";
export default async function Page({{ searchParams }}: {{ searchParams: Promise<{{ user?: string }}> }}) {{ const query=await searchParams; const profile=await loadDemoProfile(query.user === "bob" ? "bob" : "alice"); return <main><h1>{variant} cache fixture</h1><pre>{{JSON.stringify(profile)}}</pre></main>; }}
'''
    files["app/page.tsx"] = '''import cases from "../cases.json";
export default function Page() { return <main><h1>AuditorX · Next.js Scan Lab</h1><section><strong>Intentionally flawed teaching project. Fictional data only.</strong><p>Compare unsafe and fixed source files, scan with AuditorX, then review labels. Development binds to 127.0.0.1:3012. The client/fs example is scan-only.</p><p>All proposed priorities describe hypothetical teaching scenarios, not production findings.</p></section><table><thead><tr><th>Family</th><th>Unsafe source</th><th>Fixed source</th><th>Suggested priority</th></tr></thead><tbody>{cases.cases.map(item => <tr key={item.family}><td>{item.family}</td><td><code>{item.unsafe_file}</code></td><td><code>{item.fixed_file}</code></td><td>{item.proposed_priority}</td></tr>)}</tbody></table></main>; }
'''
    files["cases.json"] = json.dumps({"schema_version":"nextjs-lab-cases-v1","dataset_kind":"authored_source_lab","actual_context":"Local test project with fictional data; hypothetical priorities require review.","split_grouping":"Keep unsafe/fixed and derived variants of a family together. One small authored project is not a real-project benchmark.","cases":cases},indent=2)
    files["README.md"] = '''# AuditorX Next.js Scan Lab

โปรเจกต์ Next.js ที่ตั้งใจใส่ข้อบกพร่อง 12 กลุ่ม พร้อมไฟล์คู่แก้แล้ว 12 ไฟล์
ใช้ข้อมูลและ credential ปลอมทั้งหมด สำหรับทดลอง scanner และเก็บชุดข้อมูลจากซอร์ส
อย่านำโปรเจกต์นี้ไป deploy เป็นบริการจริง; dev/start ผูกเฉพาะ 127.0.0.1:3012

## ใช้งาน

```powershell
npm ci
npm run build
npm run dev
```

หน้าแรกแสดงรายชื่อ source pairs โปรเจกต์นี้ไม่มี external database/account
orders/profiles อยู่ในหน่วยความจำ และ demo actor ถูกกำหนดเป็น Alice สำหรับเทียบ ownership
SQL เป็น mock sink ที่ไม่ execute SQL; client-boundary เป็น fixture นอก app import graph
จึงเป็นการทดสอบรูปแบบโค้ด ไม่ได้ยืนยันว่าแต่ละ finding exploit ได้จริง

## สแกนจาก AuditorX

ใส่พาธ `auditor-x/examples/nextjs-scan-lab` ใน Dashboard → สแกนจากพาธ
worker อ่าน source ผ่าน volume เดิม ไม่ต้องอัปโหลดหรือรันแอปนี้

`cases.json` ระบุ expected rule, source คู่ unsafe/fixed, group และ proposed priority
ข้อเสนอ High/Medium/Low อิงสถานการณ์สอนที่สมมติ ไม่ใช่ human ground truth และไม่ใช่
การจัดความเสี่ยง production ของแอป local นี้ ต้องคง provenance นี้เมื่อทำ dataset

กฎ Manual review ต้องแจ้งทั้ง unsafe และ fixed ได้ ให้ตรวจโค้ดแล้ว excluded ฝั่ง fixed
API handler advisory อาจซ้ำกับ security finding ใน route เดียวกัน ห้ามนับซ้ำเพื่อเพิ่มข้อมูล
ให้ group คู่ก่อน/หลังแก้และโค้ดที่แตกมาจากต้นแบบเดียวกันไว้ split เดียวกัน
12 กลุ่มในโปรเจกต์เดียวนี้มีไว้ทดสอบ pipeline ยังไม่พออ้าง generalization กับโปรเจกต์จริง
'''
    for name, content in files.items():
        target = TARGET / name
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(content.rstrip()+"\n",encoding="utf-8")
    print(f"Created {TARGET}: {len(cases)} paired cases, {len(files)} files")


if __name__ == "__main__":
    main()
