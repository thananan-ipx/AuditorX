"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Feedback, LoadingState } from "@/components/shared/feedback";
import { PagePagination } from "@/components/shared/page-pagination";
import { SelectField } from "@/components/shared/select-field";
import { useLanguage } from "@/lib/i18n";
import { dashboardHref } from "@/features/repositories/service/repository-service";
import { githubService, githubStartHref, githubLoginErrors, type GitHubConnection, type GitHubInstallation, type GitHubRepository } from "../service/github-service";

function message(error: unknown) { return error instanceof Error ? error.message : "GitHub connection is temporarily unavailable."; }

export function GitHubRepositories() {
  const { t } = useLanguage();
  const [state, setState] = useState<GitHubConnection | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void githubService.config(controller.signal).then(async config => {
      if (!config.enabled) return null;
      return githubService.connection(controller.signal);
    }).then(value => { if (!controller.signal.aborted) {
      setState(value);
      const url = new URL(window.location.href);
      setError(githubLoginErrors[url.searchParams.get("github_error") ?? ""] ?? "");
      if (url.searchParams.has("github_error")) { url.searchParams.delete("github_error"); window.history.replaceState(null, "", url); }
    } }).catch(cause => { if (!controller.signal.aborted) { setState(null); setError(message(cause)); } });
    return () => controller.abort();
  }, [revision]);

  async function disconnect() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await githubService.disconnect(); setState(null); setRevision(v => v + 1); }
    catch (cause) { setError(message(cause)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  if (!state && !error) return null;
  return <Card className="mb-5">
    <CardHeader><CardTitle className="flex items-center gap-2"><GitBranch className="size-5" aria-hidden="true" />GitHub</CardTitle><CardDescription>{t("Connect GitHub to choose repositories you have allowed AuditorX to read.")}</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {error && <Feedback tone="error">{t(error)} <Button variant="ghost" size="sm" onClick={() => setRevision(v => v + 1)}>{t("Retry")}</Button></Feedback>}
      {state && <>
        <div className="flex flex-wrap items-center gap-3">
          {state.connection.connected && <span className="type-body-sm">{t("Connected as")} <strong>{state.connection.login}</strong></span>}
          <Button asChild variant="outline"><a href={githubStartHref("connect")}>{t(state.connection.connected ? "Reconnect GitHub" : "Connect GitHub")}</a></Button>
          {state.connection.connected && <><Button asChild variant="outline"><a href={state.installation_url} target="_blank" rel="noopener noreferrer">{t("Choose repositories on GitHub")}</a></Button><Button variant="ghost" disabled={busy} onClick={() => void disconnect()}>{t("Disconnect")}</Button></>}
          <Button variant="ghost" disabled={busy} onClick={() => { setState(null); setRevision(v => v + 1); }}>{t("Refresh")}</Button>
        </div>
        {state.connection.reconnect && <Feedback tone="error">{t("GitHub access has expired. Reconnect to import or scan repositories.")}</Feedback>}
        {state.connection.connected && !state.connection.reconnect && <InstallationPicker key={`${revision}:${state.connection.login}`} />}
      </>}
    </CardContent>
  </Card>;
}

function InstallationPicker() {
  const { t } = useLanguage();
  const [items, setItems] = useState<GitHubInstallation[] | null>(null);
  const [selected, setSelected] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    void githubService.installations(page, c.signal).then(data => { if (!c.signal.aborted) { setItems(data.installations); setTotal(data.total_count); setError(""); } }).catch(cause => { if (!c.signal.aborted) setError(message(cause)); });
    return () => c.abort();
  }, [page, revision]);
  if (error) return <Feedback tone="error">{t(error)} <Button variant="ghost" size="sm" onClick={() => setRevision(v => v + 1)}>{t("Retry")}</Button></Feedback>;
  if (!items) return <LoadingState>{t("Loading GitHub accounts…")}</LoadingState>;
  return <div className="space-y-4">
    {items.length === 0 ? <p className="type-body-sm text-muted-foreground">{t("Choose repositories on GitHub, then refresh this connection. Organization access may need administrator approval.")}</p> : <>
      <SelectField id="github-installation" label={t("GitHub account or organization")} value={String(selected)} onValueChange={value => setSelected(Number(value))} options={[{value:"0",label:t("Choose an account")}, ...items.map(item => ({value:String(item.id),label:item.account.login}))]} />
      {total > 30 && <PagePagination page={page} hasNext={page * 30 < total} onPageChange={p => { setItems(null); setSelected(0); setPage(p); }} />}
      {selected > 0 && <RepositoryPicker key={selected} installation={selected} />}
    </>}
  </div>;
}

function RepositoryPicker({ installation }: { installation: number }) {
  const { t } = useLanguage();
  const [items, setItems] = useState<GitHubRepository[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<GitHubRepository | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    void githubService.repositories(installation, page, c.signal).then(data => { if (!c.signal.aborted) { setItems(data.repositories); setTotal(data.total_count); setError(""); } }).catch(cause => { if (!c.signal.aborted) setError(message(cause)); });
    return () => c.abort();
  }, [installation, page, revision]);
  if (error) return <Feedback tone="error">{t(error)} <Button variant="ghost" size="sm" onClick={() => setRevision(v => v + 1)}>{t("Retry")}</Button></Feedback>;
  if (!items) return <LoadingState>{t("Loading GitHub repositories…")}</LoadingState>;
  return <div className="space-y-4">
    <SelectField id="github-repository" label={t("GitHub repository")} value={String(selected?.id ?? 0)} onValueChange={value => setSelected(items.find(item => item.id === Number(value)) ?? null)} options={[{value:"0",label:t("Choose a repository")},...items.map(item => ({value:String(item.id),label:item.full_name+(item.private ? ` (${t("Private")})` : "")}))]} />
    {items.length === 0 && <p className="type-body-sm text-muted-foreground">{t("No repositories are available for this installation. Review access on GitHub and refresh.")}</p>}
    {total > 30 && <PagePagination page={page} hasNext={page * 30 < total} onPageChange={p => { setItems(null); setSelected(null); setPage(p); }} />}
    {selected && <ImportRepository key={selected.id} repository={selected} installation={installation} page={page} />}
  </div>;
}

function ImportRepository({ repository, installation, page }: { repository: GitHubRepository; installation: number; page: number }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [branch, setBranch] = useState(repository.default_branch);
  const [branches, setBranches] = useState<{ name: string }[] | null>(null);
  const [branchPage, setBranchPage] = useState(1);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const c = new AbortController();
    void githubService.branches(repository.id, branchPage, c.signal).then(data => { if (!c.signal.aborted) { setBranches(data); setLoadError(""); } }).catch(cause => { if (!c.signal.aborted) setLoadError(message(cause)); });
    return () => c.abort();
  }, [repository.id, branchPage, revision]);
  async function importRepository() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { const result = await githubService.import(repository.id, installation, page, branch); if (mounted.current) router.push(dashboardHref(result.id)); }
    catch (cause) { if (mounted.current) setError(message(cause)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  return <div className="space-y-3 rounded-lg border p-4" aria-busy={busy}>
    {repository.private && <p className="flex items-center gap-2 type-body-sm"><Lock className="size-4" aria-hidden="true" />{t("Private repository")}</p>}
    {loadError ? <Feedback tone="error">{t(loadError)} <Button variant="ghost" size="sm" onClick={() => setRevision(v => v + 1)}>{t("Retry")}</Button></Feedback> : !branches ? <LoadingState>{t("Loading branches…")}</LoadingState> : <>
      <SelectField id="github-branch" label={t("Branch")} disabled={busy} value={branch} onValueChange={setBranch} options={[...(!branches.some(item => item.name === branch) ? [{value:branch,label:branch}] : []),...branches.map(item => ({value:item.name,label:item.name}))]} />
      <PagePagination page={branchPage} hasNext={branches.length === 30} onPageChange={p => { setBranches(null); setBranchPage(p); }} />
    </>}
    {error && <Feedback tone="error">{t(error)}</Feedback>}
    <Button disabled={busy || !branches || !!loadError || !branch} onClick={() => void importRepository()}>{t(busy ? "Importing…" : "Import repository")}</Button>
    <p className="type-caption text-muted-foreground">{t("Import saves the selected repository and branch. Start a scan from its dashboard.")}</p>
  </div>;
}
