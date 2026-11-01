"use client";

import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

const SearchDialog = dynamic(() => import("@/features/search/components/universal-search-dialog"));

export function UniversalSearch() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.repeat && !event.defaultPrevented && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!open) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setOpen(previous => !previous);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return <>
    <Button variant="outline" aria-label={t("Search workspace")} aria-haspopup="dialog" aria-expanded={open} aria-keyshortcuts="Control+k Meta+k" onClick={event => { returnFocus.current = event.currentTarget; setOpen(true); }} className="size-9 shrink-0 rounded-full px-0 md:w-64 md:justify-start md:gap-2 md:rounded-lg md:px-3">
      <Search className="size-4" aria-hidden="true" />
      <span className="hidden type-body-sm text-muted-foreground md:inline">{t("Search workspace…")}</span>
      <kbd aria-hidden="true" className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 type-caption text-muted-foreground md:inline">Ctrl K</kbd>
    </Button>
    {open && <SearchDialog returnFocus={returnFocus} onClose={() => setOpen(false)} />}
  </>;
}
