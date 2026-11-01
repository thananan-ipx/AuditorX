"use client";

import { useEffect, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch, Search } from "lucide-react";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Feedback, LoadingState } from "@/components/shared/feedback";
import { searchPages } from "@/components/layout/navigation";
import { ApiError } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { repositorySearchHref, searchService, type RepositoryHit } from "../service/search-service";

type Results = { query: string; phase: "ready"; items: RepositoryHit[] } | { query: string; phase: "error"; error: unknown };

// Adapted from ERP's command dialog: delayed record search, immediate menu search,
// query-scoped results and cancellation. No business records are cached persistently.
export default function UniversalSearchDialog({ onClose, returnFocus }: { onClose: () => void; returnFocus: RefObject<HTMLElement | null> }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [revision, setRevision] = useState(0);
  const query = value.trim();
  const ready = [...query].length >= 2;
  const [result, setResult] = useState<Results | null>(null);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchService.find(query, controller.signal).then(data => {
        if (!controller.signal.aborted) setResult({ query, phase: "ready", items: data.repositories });
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ query, phase: "error", error });
      });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, ready, revision]);
  const current = ready && result?.query === query ? result : null;
  const items = current?.phase === "ready" ? current.items : [];
  const pages = searchPages(query, t);
  const pending = ready && !current;
  const expired = current?.phase === "error" && current.error instanceof ApiError && current.error.status === 401;
  function navigate(href: string) { onClose(); router.push(href); }

  return <Dialog open onOpenChange={next => { if (!next) onClose(); }}>
    <DialogContent showCloseButton={false} className="w-[calc(100%-2rem)] max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl" onCloseAutoFocus={event => {
      if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); }
    }}>
      <DialogTitle className="sr-only">{t("Search workspace")}</DialogTitle>
      <DialogDescription className="sr-only">{t("Find pages and repositories you can access.")}</DialogDescription>
      <Command shouldFilter={false} label={t("Search workspace")}>
        <CommandInput autoFocus aria-label={t("Search pages or repositories")} placeholder={t("Search pages or repositories…")} value={value} onValueChange={setValue} maxLength={100} className="h-12 type-body" />
        <CommandList className="max-h-[min(60dvh,28rem)]" aria-busy={pending}>
          {pages.length > 0 && <CommandGroup heading={t(query ? "Matching pages" : "Go to page")}>
            {pages.map(page => <CommandItem key={page.href} value={`page:${page.href}`} onSelect={() => navigate(page.href)} className="gap-3 py-3">
              <page.icon aria-hidden="true" className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1"><span className="block type-label">{t(page.label)}</span><span className="block type-caption text-muted-foreground">{t(page.group)}</span></span>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </CommandItem>)}
          </CommandGroup>}
          {pending && <div className="p-3"><LoadingState>{t("Searching repositories…")}</LoadingState></div>}
          {current?.phase === "error" && <div className="p-3"><Feedback tone="error"><span>{t(expired ? "Your session has expired. Sign in again to continue." : "Repository search is unavailable. Page navigation still works.")}</span>
            <Button size="sm" variant="outline" onClick={() => {
              if (expired) { navigate("/login"); return; }
              setResult(null); setRevision(previous => previous + 1);
            }}>{t(expired ? "Sign in" : "Try again")}</Button>
          </Feedback></div>}
          {items.length > 0 && <CommandGroup heading={t("Repositories")}>
            {items.map(hit => <CommandItem key={hit.id} value={`repository:${hit.id}`} onSelect={() => navigate(repositorySearchHref(hit))} className="gap-3 py-3">
              <GitBranch className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1"><span className="block truncate type-label">{hit.title}</span><span className="block truncate type-caption text-muted-foreground">{t("Branch")}: {hit.description}</span></span>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </CommandItem>)}
          </CommandGroup>}
          {ready && current?.phase === "ready" && !items.length && !pages.length && <div className="px-4 py-10 text-center" role="status"><Search className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden="true" /><p className="type-label">{t("No search results")}</p><p className="mt-1 type-caption text-muted-foreground">{t("Try a page name, repository owner or branch.")}</p></div>}
        </CommandList>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 type-caption text-muted-foreground">
          <span>{t(ready ? "Up to 5 accessible repositories" : "Type at least 2 characters to search repositories")}</span>
          <span className="hidden sm:inline">{t("↑↓ select · Enter open · Esc close")}</span>
          <Button size="sm" variant="ghost" onClick={onClose}>{t("Close")}</Button>
        </div>
      </Command>
    </DialogContent>
  </Dialog>;
}
